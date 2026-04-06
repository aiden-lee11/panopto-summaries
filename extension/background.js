import {
  PROMPT_PRESETS,
  SETTINGS_STORAGE_KEYS,
  normalizePromptBehavior,
  normalizePromptPreset,
  normalizeStoredSettings
} from "./shared.js";

const BASE_QUALITY_RULES = [
  "Use only transcript content; do not invent facts.",
  "Auto-generated captions may contain errors. Correct only obvious speech-to-text mistakes.",
  "Remove filler/noise when summarizing.",
  "Preserve important terminology, theories, names, definitions, and arguments.",
  "If information is unclear, say so briefly instead of guessing."
];

function buildPromptInstructions({
  promptPreset,
  promptBehavior,
  customInstruction
}) {
  const rulesBlock = BASE_QUALITY_RULES.map((rule) => `- ${rule}`).join("\n");
  const normalizedPreset = normalizePromptPreset(promptPreset);
  const normalizedBehavior = normalizePromptBehavior(promptBehavior);
  const trimmedCustom = (customInstruction || "").trim();
  const effectiveCustom =
    normalizedBehavior === "no_custom_prompt" ? "" : trimmedCustom;

  if (normalizedPreset === "custom_instruction_only") {
    if (effectiveCustom) {
      return `You are an expert teaching assistant.

Primary objective from user:
${effectiveCustom}

Quality rules:
${rulesBlock}

Respect the user's requested format and length while following the rules.`;
    }

    return `You are an expert teaching assistant.

No custom instruction was provided.
Default to concise markdown bullet points (12-20 bullets, most important first).

Quality rules:
${rulesBlock}`;
  }

  if (normalizedBehavior === "custom_only" && effectiveCustom) {
    return `You are an expert teaching assistant.

Primary objective from user:
${effectiveCustom}

Quality rules:
${rulesBlock}

Respect the user's requested format and length while following the rules.`;
  }

  const presetInstructions = PROMPT_PRESETS[normalizedPreset];
  if (normalizedBehavior === "append_guidance" && effectiveCustom) {
    return `You are an expert teaching assistant.

Default output mode:
${presetInstructions}

Additional user guidance (treat as highest-priority formatting/content guidance when possible):
${effectiveCustom}

Quality rules:
${rulesBlock}`;
  }

  return `You are an expert teaching assistant.

Default output mode:
${presetInstructions}

Quality rules:
${rulesBlock}`;
}

function readOutputText(responseJson) {
  if (typeof responseJson?.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const output = responseJson?.output;
  if (!Array.isArray(output)) return "";

  const chunks = [];
  for (const item of output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function readGeminiOutputText(responseJson) {
  const candidates = responseJson?.candidates;
  if (!Array.isArray(candidates) || !candidates.length) return "";
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);
  return normalizeStoredSettings(stored);
}

async function summarizeWithOpenAI(
  transcriptText,
  promptInstructions,
  model,
  apiKey,
  signal
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: promptInstructions }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Transcript:\n${transcriptText}` }]
        }
      ]
    }),
    signal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const outputMarkdown = readOutputText(json);
  if (!outputMarkdown) {
    throw new Error("No summary text returned from OpenAI.");
  }
  return outputMarkdown;
}

async function summarizeWithGemini(
  transcriptText,
  promptInstructions,
  model,
  apiKey,
  signal
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${promptInstructions}\n\nTranscript:\n${transcriptText}`
              }
            ]
          }
        ]
      }),
      signal
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const outputMarkdown = readGeminiOutputText(json);
  if (!outputMarkdown) {
    throw new Error("No summary text returned from Gemini.");
  }
  return outputMarkdown;
}

async function summarizeLecture(transcriptText, provider, promptConfig) {
  const settings = await getSettings();
  const selectedProvider =
    provider === "gemini" || provider === "openai"
      ? provider
      : settings.preferredProvider;
  const promptInstructions = buildPromptInstructions({
    promptPreset: promptConfig?.promptPreset || settings.defaultPromptPreset,
    promptBehavior: promptConfig?.promptBehavior || settings.defaultPromptBehavior,
    customInstruction:
      promptConfig?.customInstruction ?? settings.defaultCustomInstruction
  });

  if (selectedProvider === "openai" && !settings.openaiApiKey) {
    throw new Error(
      "Missing OpenAI API key. Open extension Settings and add your OpenAI key."
    );
  }
  if (selectedProvider === "gemini" && !settings.geminiApiKey) {
    throw new Error(
      "Missing Gemini API key. Open extension Settings and add your Gemini key."
    );
  }

  const modelUsed =
    selectedProvider === "gemini" ? settings.geminiModel : settings.openaiModel;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    let outputMarkdown;
    if (selectedProvider === "gemini") {
      outputMarkdown = await summarizeWithGemini(
        transcriptText,
        promptInstructions,
        settings.geminiModel,
        settings.geminiApiKey,
        controller.signal
      );
    } else {
      outputMarkdown = await summarizeWithOpenAI(
        transcriptText,
        promptInstructions,
        settings.openaiModel,
        settings.openaiApiKey,
        controller.signal
      );
    }
    return { outputMarkdown, model: modelUsed };
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SUMMARIZE_TRANSCRIPT") {
    return;
  }

  const transcriptText = message?.payload?.transcriptText || "";
  if (!transcriptText.trim()) {
    sendResponse({ ok: false, error: "No transcript text was provided." });
    return;
  }

  summarizeLecture(transcriptText, message?.provider, {
    promptPreset: message?.promptPreset,
    promptBehavior: message?.promptBehavior,
    customInstruction: message?.customInstruction
  })
    .then(({ outputMarkdown, model }) =>
      sendResponse({ ok: true, outputMarkdown, model })
    )
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Unexpected summarization error."
      });
    });

  return true;
});
