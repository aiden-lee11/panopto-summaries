import { GEMINI_MODEL, OPENAI_MODEL } from "./config.js";

export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_PROMPT_PRESET = "bullet_points";
export const DEFAULT_PROMPT_BEHAVIOR = "custom_only";

export const PROMPT_STORAGE_KEYS = [
  "preferredProvider",
  "defaultPromptPreset",
  "defaultPromptBehavior",
  "defaultCustomInstruction"
];

export const SETTINGS_STORAGE_KEYS = [
  ...PROMPT_STORAGE_KEYS,
  "openaiApiKey",
  "openaiModel",
  "geminiApiKey",
  "geminiModel"
];

export const PROMPT_PRESETS = {
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

export const PROMPT_PRESET_ALIASES = {
  bullets_only: "bullet_points",
  executive_summary: "summary",
  exam_prep: "quiz_creator"
};

export function normalizeProvider(value) {
  return value === "gemini" ? "gemini" : DEFAULT_PROVIDER;
}

export function normalizePromptPreset(value) {
  const resolved = PROMPT_PRESET_ALIASES[value] || value;
  if (resolved === "custom_instruction_only") {
    return resolved;
  }
  return Object.prototype.hasOwnProperty.call(PROMPT_PRESETS, resolved)
    ? resolved
    : DEFAULT_PROMPT_PRESET;
}

export function normalizePromptBehavior(value) {
  if (value === "append_guidance" || value === "no_custom_prompt") {
    return value;
  }
  return DEFAULT_PROMPT_BEHAVIOR;
}

export function shouldHideCustomInstruction(promptBehavior) {
  return normalizePromptBehavior(promptBehavior) === "no_custom_prompt";
}

export function normalizeStoredSettings(stored = {}) {
  return {
    preferredProvider: normalizeProvider(stored.preferredProvider),
    defaultPromptPreset: normalizePromptPreset(stored.defaultPromptPreset),
    defaultPromptBehavior: normalizePromptBehavior(stored.defaultPromptBehavior),
    defaultCustomInstruction: stored.defaultCustomInstruction || "",
    openaiApiKey: stored.openaiApiKey || "",
    openaiModel: stored.openaiModel || OPENAI_MODEL,
    geminiApiKey: stored.geminiApiKey || "",
    geminiModel: stored.geminiModel || GEMINI_MODEL
  };
}
