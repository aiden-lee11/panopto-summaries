const preferredProviderEl = document.getElementById("preferredProvider");
const openaiApiKeyEl = document.getElementById("openaiApiKey");
const openaiModelEl = document.getElementById("openaiModel");
const geminiApiKeyEl = document.getElementById("geminiApiKey");
const geminiModelEl = document.getElementById("geminiModel");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "preferredProvider",
    "openaiApiKey",
    "openaiModel",
    "geminiApiKey",
    "geminiModel"
  ]);
  const preferredProvider =
    settings.preferredProvider === "gemini" ? "gemini" : "openai";
  preferredProviderEl.value = preferredProvider;
  openaiApiKeyEl.value = settings.openaiApiKey || "";
  openaiModelEl.value = settings.openaiModel || "gpt-5-mini";
  geminiApiKeyEl.value = settings.geminiApiKey || "";
  geminiModelEl.value = settings.geminiModel || "gemini-2.0-flash";
}

async function saveSettings() {
  const preferredProvider = preferredProviderEl.value === "gemini" ? "gemini" : "openai";
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

loadSettings().catch((error) => {
  setStatus(error?.message || "Failed to load settings.");
});
