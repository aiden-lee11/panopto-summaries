import {
  SETTINGS_STORAGE_KEYS,
  normalizePromptBehavior,
  normalizePromptPreset,
  normalizeProvider,
  normalizeStoredSettings,
  shouldHideCustomInstruction
} from "./shared.js";

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
  defaultCustomInstructionGroupEl.style.display = shouldHideCustomInstruction(
    defaultPromptBehaviorEl.value
  )
    ? "none"
    : "";
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);
  const settings = normalizeStoredSettings(stored);
  preferredProviderEl.value = settings.preferredProvider;
  defaultPromptPresetEl.value = settings.defaultPromptPreset;
  defaultPromptBehaviorEl.value = settings.defaultPromptBehavior;
  defaultCustomInstructionEl.value = settings.defaultCustomInstruction || "";
  updateCustomInstructionVisibility();
  openaiApiKeyEl.value = settings.openaiApiKey || "";
  openaiModelEl.value = settings.openaiModel;
  geminiApiKeyEl.value = settings.geminiApiKey || "";
  geminiModelEl.value = settings.geminiModel;
}

async function saveSettings() {
  const currentSettings = normalizeStoredSettings();
  const preferredProvider = normalizeProvider(preferredProviderEl.value);
  const defaultPromptPreset = normalizePromptPreset(defaultPromptPresetEl.value);
  const defaultPromptBehavior = normalizePromptBehavior(defaultPromptBehaviorEl.value);
  const defaultCustomInstruction = defaultCustomInstructionEl.value.trim();
  const openaiApiKey = openaiApiKeyEl.value.trim();
  const openaiModel = openaiModelEl.value.trim() || currentSettings.openaiModel;
  const geminiApiKey = geminiApiKeyEl.value.trim();
  const geminiModel = geminiModelEl.value.trim() || currentSettings.geminiModel;

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
