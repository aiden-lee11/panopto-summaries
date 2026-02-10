const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const SUMMARY_INSTRUCTIONS = `You are an expert teaching assistant.

Summarize the lecture transcript as concise, high-signal bullet points only.

Rules:
- Use only transcript content; do not invent facts.
- Auto-generated captions may contain mistakes. Correct obvious speech-to-text errors only when confidence is high.
- Remove filler/noise ("um", repeated words, false starts) in the final summary.
- Preserve important terminology, theories, names, definitions, and arguments.
- Output only markdown bullet points.
- No title, no headings, no numbering, no preamble, no closing note.
- Return 12-20 bullets, most important points first.`;

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
    "openaiApiKey",
    "openaiModel",
    "geminiApiKey",
    "geminiModel"
  ]);
  return {
    preferredProvider: stored.preferredProvider || "openai",
    openaiApiKey: stored.openaiApiKey || "",
    openaiModel: stored.openaiModel || DEFAULT_OPENAI_MODEL,
    geminiApiKey: stored.geminiApiKey || "",
    geminiModel: stored.geminiModel || DEFAULT_GEMINI_MODEL
  };
}

async function summarizeWithOpenAI(transcriptText, model, apiKey, signal) {
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
          content: [{ type: "input_text", text: SUMMARY_INSTRUCTIONS }]
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

async function summarizeWithGemini(transcriptText, model, apiKey, signal) {
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
                text: `${SUMMARY_INSTRUCTIONS}\n\nTranscript:\n${transcriptText}`
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

async function summarizeLecture(transcriptText, provider) {
  const settings = await getSettings();
  const selectedProvider =
    provider === "gemini" || provider === "openai"
      ? provider
      : settings.preferredProvider;

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
        settings.geminiModel,
        settings.geminiApiKey,
        controller.signal
      );
    }

    return await summarizeWithOpenAI(
      transcriptText,
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

  summarizeLecture(transcriptText, message?.provider)
    .then((outputMarkdown) => sendResponse({ ok: true, outputMarkdown }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Unexpected summarization error."
      });
    });

  return true;
});
