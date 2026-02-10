const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_PROMPT_PRESET = "bullet_points";
const DEFAULT_PROMPT_BEHAVIOR = "custom_only";

const BASE_QUALITY_RULES = [
  "Use only transcript content; do not invent facts.",
  "Auto-generated captions may contain errors. Correct only obvious speech-to-text mistakes.",
  "Remove filler/noise when summarizing.",
  "Preserve important terminology, theories, names, definitions, and arguments.",
  "If information is unclear, say so briefly instead of guessing."
];

const PROMPT_PRESETS = {
  bullet_points: `Output only markdown bullet points.
- No heading, no preamble, no closing note.
- Return 12-20 bullets, most important points first.`,
  summary: `Output a concise markdown summary:
- 1 short paragraph overview
- 8-12 bullets for main points
- 1 short closing line with key takeaway`,
  quiz_creator: `Create a quiz from this lecture in markdown:
## Multiple Choice
- 8 questions, each with 4 options
- Mark the correct option under each question

## Short Answer
- 5 questions
- Include a brief answer key`,
  study_guide: `Output a markdown study guide with these sections:
## Core Concepts
## Key Mechanisms
## Important Examples
## Likely Exam Questions
Keep each section concise and useful for review.`,
  detailed_notes: `Output detailed markdown notes:
## Main Themes
## Topic-by-Topic Notes
## Evidence and Examples
## Open Questions
Keep structure clear and complete without fluff.`
};

const PROMPT_PRESET_ALIASES = {
  bullets_only: "bullet_points",
  executive_summary: "summary",
  exam_prep: "quiz_creator"
};

function normalizePromptPreset(value) {
  const resolved = PROMPT_PRESET_ALIASES[value] || value;
  if (resolved === "custom_instruction_only") {
    return resolved;
  }
  return Object.prototype.hasOwnProperty.call(PROMPT_PRESETS, resolved)
    ? resolved
    : DEFAULT_PROMPT_PRESET;
}

function normalizePromptBehavior(value) {
  if (value === "append_guidance" || value === "no_custom_prompt") {
    return value;
  }
  return DEFAULT_PROMPT_BEHAVIOR;
}

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
  const stored = await chrome.storage.local.get([
    "preferredProvider",
    "defaultPromptPreset",
    "defaultPromptBehavior",
    "defaultCustomInstruction",
    "openaiApiKey",
    "openaiModel",
    "geminiApiKey",
    "geminiModel"
  ]);
  return {
    preferredProvider: stored.preferredProvider || "openai",
    defaultPromptPreset: normalizePromptPreset(stored.defaultPromptPreset),
    defaultPromptBehavior: normalizePromptBehavior(stored.defaultPromptBehavior),
    defaultCustomInstruction: stored.defaultCustomInstruction || "",
    openaiApiKey: stored.openaiApiKey || "",
    openaiModel: stored.openaiModel || DEFAULT_OPENAI_MODEL,
    geminiApiKey: stored.geminiApiKey || "",
    geminiModel: stored.geminiModel || DEFAULT_GEMINI_MODEL
  };
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
      "Missing OpenAI API key. Open extension Settings and paste the key from your .env file."
    );
  }
  if (selectedProvider === "gemini" && !settings.geminiApiKey) {
    throw new Error(
      "Missing Gemini API key. Open extension Settings and paste the Gemini key from your .env file."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    if (selectedProvider === "gemini") {
      return await summarizeWithGemini(
        transcriptText,
        promptInstructions,
        settings.geminiModel,
        settings.geminiApiKey,
        controller.signal
      );
    }

    return await summarizeWithOpenAI(
      transcriptText,
      promptInstructions,
      settings.openaiModel,
      settings.openaiApiKey,
      controller.signal
    );
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
    .then((outputMarkdown) => sendResponse({ ok: true, outputMarkdown }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Unexpected summarization error."
      });
    });

  return true;
});
