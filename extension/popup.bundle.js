// extension/shared.js
var DEFAULT_PROVIDER = "openai";
var DEFAULT_PROMPT_PRESET = "bullet_points";
var DEFAULT_PROMPT_BEHAVIOR = "custom_only";
var PROMPT_STORAGE_KEYS = [
  "preferredProvider",
  "defaultPromptPreset",
  "defaultPromptBehavior",
  "defaultCustomInstruction"
];
var SETTINGS_STORAGE_KEYS = [
  ...PROMPT_STORAGE_KEYS,
  "openaiApiKey",
  "openaiModel",
  "geminiApiKey",
  "geminiModel"
];
var PROMPT_PRESETS = {
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
var PROMPT_PRESET_ALIASES = {
  bullets_only: "bullet_points",
  executive_summary: "summary",
  exam_prep: "quiz_creator"
};
function normalizeProvider(value) {
  return value === "gemini" ? "gemini" : DEFAULT_PROVIDER;
}
function normalizePromptPreset(value) {
  const resolved = PROMPT_PRESET_ALIASES[value] || value;
  if (resolved === "custom_instruction_only") {
    return resolved;
  }
  return Object.prototype.hasOwnProperty.call(PROMPT_PRESETS, resolved) ? resolved : DEFAULT_PROMPT_PRESET;
}
function normalizePromptBehavior(value) {
  if (value === "append_guidance" || value === "no_custom_prompt") {
    return value;
  }
  return DEFAULT_PROMPT_BEHAVIOR;
}
function shouldHideCustomInstruction(promptBehavior) {
  return normalizePromptBehavior(promptBehavior) === "no_custom_prompt";
}

// extension/popup.js
var summarizeBtn = document.getElementById("summarizeBtn");
var copyLectureCaptionsBtn = document.getElementById("copyLectureCaptionsBtn");
var settingsBtn = document.getElementById("settingsBtn");
var statusEl = document.getElementById("status");
var outputEl = document.getElementById("output");
var providerEls = Array.from(document.querySelectorAll('input[name="provider"]'));
var promptPresetEl = document.getElementById("promptPreset");
var promptBehaviorEl = document.getElementById("promptBehavior");
var customInstructionGroupEl = document.getElementById("customInstructionGroup");
var customInstructionEl = document.getElementById("customInstruction");
var historyListEl = document.getElementById("historyList");
var latestResult = null;
var HISTORY_KEY = "summaryHistory";
var MAX_HISTORY = 5;
function setStatus(message) {
  statusEl.textContent = message;
}
function setOutput(message) {
  outputEl.textContent = message;
}
function updateCustomInstructionVisibility() {
  const hide = shouldHideCustomInstruction(promptBehaviorEl?.value);
  if (customInstructionGroupEl) {
    customInstructionGroupEl.style.display = hide ? "none" : "";
  }
}
function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function applyInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}
function markdownToHtml(markdown) {
  const lines = (markdown || "").replace(/\r\n/g, `
`).split(`
`);
  const out = [];
  let inCodeBlock = false;
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      closeLists();
      if (!inCodeBlock) {
        inCodeBlock = true;
        out.push("<pre><code>");
      } else {
        inCodeBlock = false;
        out.push("</code></pre>");
      }
      continue;
    }
    if (inCodeBlock) {
      out.push(`${escapeHtml(rawLine)}
`);
      continue;
    }
    if (!line.trim()) {
      closeLists();
      out.push("<p></p>");
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        inUl = true;
        out.push("<ul>");
      }
      out.push(`<li>${applyInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        inOl = true;
        out.push("<ol>");
      }
      out.push(`<li>${applyInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${applyInlineMarkdown(line)}</p>`);
  }
  closeLists();
  if (inCodeBlock) {
    out.push("</code></pre>");
  }
  return out.join(`
`);
}
function openRenderedSummaryTab(result) {
  const summaryHtml = markdownToHtml(result.summaryMarkdown || "");
  const sourceTitle = escapeHtml(result.sourceTitle || "Panopto Lecture");
  const generatedAt = escapeHtml(new Date(result.generatedAt).toLocaleString());
  const provider = escapeHtml(result.provider || "unknown");
  const model = escapeHtml(result.model || "—");
  const captionCount = Number.isFinite(result.captionCount) ? result.captionCount : 0;
  const transcriptText = escapeHtml(result.transcriptText || "");
  const payloadEncoded = escapeHtml(JSON.stringify({
    generatedAt: result.generatedAt,
    provider: result.provider,
    model: result.model || "",
    captionCount: result.captionCount,
    sourceTitle: result.sourceTitle || "Panopto Lecture",
    summaryMarkdown: result.summaryMarkdown || "",
    transcriptText: result.transcriptText || ""
  }));
  const summaryTabScriptUrl = chrome.runtime.getURL("summary-tab.bundle.js");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${sourceTitle} - Summary</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        max-width: 920px;
        margin: 28px auto;
        padding: 0 20px;
        color: #111;
        line-height: 1.5;
      }
      h1, h2, h3 { margin: 0.9em 0 0.4em; }
      .meta {
        margin-bottom: 14px;
        color: #444;
        font-size: 13px;
      }
      details {
        margin-top: 18px;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
      }
      .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 10px 0;
      }
      button {
        border: 1px solid #ddd;
        background: #fff;
        color: #111;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
      }
      pre {
        background: #f6f6f6;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        overflow-x: auto;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      #summary-payload {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <h1>${sourceTitle}</h1>
    <div class="meta">Generated: ${generatedAt} | Provider: ${provider} | Model: ${model}</div>
    <div class="toolbar">
      <button type="button" id="exportMdBtn">Export .md</button>
      <button type="button" id="exportPdfBtn">Export PDF</button>
    </div>
    ${summaryHtml}
    <details>
      <summary>Captions (sanitized transcript)</summary>
      <div class="meta">Lines: ${captionCount}</div>
      <div class="toolbar">
        <button id="copyCaptionsBtn" type="button">Copy captions</button>
      </div>
      <pre id="captions">${transcriptText}</pre>
    </details>
    <pre id="summary-payload">${payloadEncoded}</pre>
    <script src="${summaryTabScriptUrl}"></script>
  </body>
</html>`;
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Popup blocked. Allow popups to open summary tab.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
function formatDate(ts) {
  return new Date(ts).toLocaleString();
}
async function getHistory() {
  const stored = await chrome.storage.local.get([HISTORY_KEY]);
  if (!Array.isArray(stored[HISTORY_KEY])) {
    return [];
  }
  return stored[HISTORY_KEY];
}
async function saveHistoryEntry(result) {
  const entry = {
    id: `${result.generatedAt}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: result.generatedAt,
    provider: result.provider,
    model: result.model,
    captionCount: result.captionCount,
    sourceTitle: result.sourceTitle,
    summaryMarkdown: result.summaryMarkdown,
    transcriptSnippet: (result.transcriptText || "").slice(0, 12000)
  };
  const history = await getHistory();
  const updated = [entry, ...history].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: updated });
  return updated;
}
function renderHistory(history) {
  historyListEl.innerHTML = "";
  if (!history.length) {
    historyListEl.textContent = "No saved summaries yet.";
    historyListEl.className = "history-empty";
    return;
  }
  historyListEl.className = "";
  for (const item of history) {
    const btn = document.createElement("button");
    btn.className = "history-item";
    btn.type = "button";
    btn.textContent = `${formatDate(item.generatedAt)} • ${item.provider} • ${item.sourceTitle}`;
    btn.addEventListener("click", () => {
      latestResult = {
        provider: item.provider,
        model: item.model,
        captionCount: item.captionCount,
        transcriptText: item.transcriptSnippet || "",
        summaryMarkdown: item.summaryMarkdown,
        sourceTitle: item.sourceTitle,
        generatedAt: item.generatedAt
      };
      setOutput("");
      setStatus("Opening summary tab…");
      openRenderedSummaryTab(latestResult);
      setStatus("Summary opened in a new tab.");
    });
    historyListEl.appendChild(btn);
  }
}
async function refreshHistory() {
  const history = await getHistory();
  renderHistory(history);
}
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}
async function getActivePanoptoTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id || !tab.url) {
    throw new Error("Could not read active tab.");
  }
  if (!tab.url.includes("panopto.com")) {
    throw new Error("Open a Panopto lecture tab first.");
  }
  return tab;
}
async function extractTranscript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_TRANSCRIPT" });
  } catch (error) {
    const message = error?.message || String(error || "");
    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_TRANSCRIPT" });
  }
}
async function extractTranscriptFromActiveLecture() {
  setStatus("Checking active tab...");
  const tab = await getActivePanoptoTab();
  setStatus("Extracting captions...");
  const extracted = await extractTranscript(tab.id);
  if (!extracted?.ok) {
    throw new Error(extracted?.error || "Caption extraction failed.");
  }
  return { tab, extracted };
}
async function summarizeTranscript(transcriptPayload) {
  const provider = getSelectedProvider();
  const promptConfig = getPromptConfigFromPopup();
  try {
    return await chrome.runtime.sendMessage({
      type: "SUMMARIZE_TRANSCRIPT",
      payload: transcriptPayload,
      provider,
      promptPreset: promptConfig.promptPreset,
      promptBehavior: promptConfig.promptBehavior,
      customInstruction: promptConfig.customInstruction
    });
  } catch (error) {
    const message = error?.message || String(error || "");
    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }
    throw new Error("Extension background is not available. Reload the extension in chrome://extensions (and refresh the Panopto tab), then try again.");
  }
}
function getPromptConfigFromPopup() {
  return {
    promptPreset: normalizePromptPreset(promptPresetEl?.value),
    promptBehavior: normalizePromptBehavior(promptBehaviorEl?.value),
    customInstruction: customInstructionEl?.value?.trim() || ""
  };
}
function getSelectedProvider() {
  const selected = providerEls.find((el) => el.checked);
  return selected?.value || "openai";
}
async function loadPreferredProvider() {
  const settings = await chrome.storage.local.get(PROMPT_STORAGE_KEYS);
  const preferred = normalizeProvider(settings.preferredProvider);
  for (const input of providerEls) {
    input.checked = input.value === preferred;
  }
  if (promptPresetEl) {
    promptPresetEl.value = normalizePromptPreset(settings.defaultPromptPreset);
  }
  if (promptBehaviorEl) {
    promptBehaviorEl.value = normalizePromptBehavior(settings.defaultPromptBehavior);
  }
  if (customInstructionEl) {
    customInstructionEl.value = settings.defaultCustomInstruction || "";
  }
  updateCustomInstructionVisibility();
}
function savePreferredProvider() {
  const provider = getSelectedProvider();
  chrome.storage.local.set({ preferredProvider: provider }).catch(() => {});
}
async function onSummarizeClick() {
  try {
    setOutput("Working...");
    const { tab, extracted } = await extractTranscriptFromActiveLecture();
    const selectedProvider = getSelectedProvider();
    setStatus(`Extracted ${extracted.captionCount} lines. Summarizing with ${selectedProvider}...`);
    const summary = await summarizeTranscript(extracted);
    if (!summary?.ok) {
      throw new Error(summary?.error || "Summarization failed.");
    }
    setStatus("Done.");
    latestResult = {
      provider: selectedProvider,
      model: summary.model,
      captionCount: extracted.captionCount,
      transcriptText: extracted.transcriptText,
      summaryMarkdown: summary.outputMarkdown,
      sourceTitle: tab.title || "Panopto Lecture",
      generatedAt: Date.now()
    };
    openRenderedSummaryTab(latestResult);
    setOutput("Summary opened in a new tab.");
    await saveHistoryEntry(latestResult);
    await refreshHistory();
  } catch (error) {
    setStatus("Error");
    setOutput(error.message || String(error));
  }
}
async function onCopyLectureCaptionsClick() {
  try {
    setOutput("Working...");
    const { extracted } = await extractTranscriptFromActiveLecture();
    await navigator.clipboard.writeText(extracted.transcriptText || "");
    setStatus(`Copied ${extracted.captionCount} caption lines.`);
    setOutput("Captions copied to clipboard.");
  } catch (error) {
    setStatus("Error");
    setOutput(error.message || String(error));
  }
}
summarizeBtn.addEventListener("click", onSummarizeClick);
copyLectureCaptionsBtn?.addEventListener("click", onCopyLectureCaptionsClick);
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
for (const input of providerEls) {
  input.addEventListener("change", savePreferredProvider);
}
promptBehaviorEl?.addEventListener("change", updateCustomInstructionVisibility);
loadPreferredProvider().catch(() => {
  setStatus("Ready.");
});
updateCustomInstructionVisibility();
refreshHistory().catch(() => {
  historyListEl.textContent = "Failed to load saved summaries.";
});
