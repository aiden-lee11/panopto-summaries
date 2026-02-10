const preferredProviderEl = document.getElementById("preferredProvider");
const defaultPromptPresetEl = document.getElementById("defaultPromptPreset");
const defaultPromptBehaviorEl = document.getElementById("defaultPromptBehavior");
const defaultCustomInstructionGroupEl = document.getElementById(
  "defaultCustomInstructionGroup"
);
const defaultCustomInstructionEl = document.getElementById("defaultCustomInstruction");
const openaiApiKeyEl = document.getElementById("openaiApiKey");
const openaiModelEl = document.getElementById("openaiModel");
const geminiApiKeyEl = document.getElementById("geminiApiKey");
const geminiModelEl = document.getElementById("geminiModel");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

function updateCustomInstructionVisibility() {
  const hide = defaultPromptBehaviorEl.value === "no_custom_prompt";
  defaultCustomInstructionGroupEl.style.display = hide ? "none" : "";
}

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "preferredProvider",
    "defaultPromptPreset",
    "defaultPromptBehavior",
    "defaultCustomInstruction",
    "openaiApiKey",
    "openaiModel",
    "geminiApiKey",
    "geminiModel"
  ]);
  const preferredProvider =
    settings.preferredProvider === "gemini" ? "gemini" : "openai";
  preferredProviderEl.value = preferredProvider;
  defaultPromptPresetEl.value = settings.defaultPromptPreset || "bullet_points";
  defaultPromptBehaviorEl.value =
    settings.defaultPromptBehavior === "append_guidance" ||
    settings.defaultPromptBehavior === "no_custom_prompt"
      ? settings.defaultPromptBehavior
      : "custom_only";
  defaultCustomInstructionEl.value = settings.defaultCustomInstruction || "";
  updateCustomInstructionVisibility();
  openaiApiKeyEl.value = settings.openaiApiKey || "";
  openaiModelEl.value = settings.openaiModel || "gpt-5-mini";
  geminiApiKeyEl.value = settings.geminiApiKey || "";
  geminiModelEl.value = settings.geminiModel || "gemini-2.0-flash";
}

async function saveSettings() {
  const preferredProvider = preferredProviderEl.value === "gemini" ? "gemini" : "openai";
  const defaultPromptPreset = defaultPromptPresetEl.value || "bullet_points";
  const defaultPromptBehavior =
    defaultPromptBehaviorEl.value === "append_guidance" ||
    defaultPromptBehaviorEl.value === "no_custom_prompt"
      ? defaultPromptBehaviorEl.value
      : "custom_only";
  const defaultCustomInstruction = defaultCustomInstructionEl.value.trim();
  const openaiApiKey = openaiApiKeyEl.value.trim();
  const openaiModel = openaiModelEl.value.trim() || "gpt-5-mini";
  const geminiApiKey = geminiApiKeyEl.value.trim();
  const geminiModel = geminiModelEl.value.trim() || "gemini-2.0-flash";

  if (!openaiApiKey && !geminiApiKey) {
    setStatus("Please provide at least one API key.");
    return;
  }

  await chrome.storage.local.set({
    preferredProvider,
    defaultPromptPreset,
    defaultPromptBehavior,
    defaultCustomInstruction,
    openaiApiKey,
    openaiModel,
    geminiApiKey,
    geminiModel
  });

  setStatus("Saved.");
}

saveBtn.addEventListener("click", () => {
  saveSettings().catch((error) => {
    setStatus(error?.message || "Failed to save settings.");
  });
});

defaultPromptBehaviorEl.addEventListener("change", updateCustomInstructionVisibility);

loadSettings().catch((error) => {
  setStatus(error?.message || "Failed to load settings.");
});
