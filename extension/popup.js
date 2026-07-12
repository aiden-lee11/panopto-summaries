import {
  HISTORY_STORAGE_KEY,
  PROMPT_STORAGE_KEYS,
  SETTINGS_STORAGE_KEYS,
  normalizeProvider,
  normalizePromptBehavior,
  normalizePromptPreset,
  normalizeStoredSettings,
  shouldHideCustomInstruction
} from "./shared.js";

const summarizeBtn = document.getElementById("summarizeBtn");
const copyLectureCaptionsBtn = document.getElementById("copyLectureCaptionsBtn");
const settingsBtn = document.getElementById("settingsBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const providerEls = Array.from(document.querySelectorAll('input[name="provider"]'));
const promptPresetEl = document.getElementById("promptPreset");
const promptBehaviorEl = document.getElementById("promptBehavior");
const customInstructionGroupEl = document.getElementById("customInstructionGroup");
const customInstructionEl = document.getElementById("customInstruction");
const historyListEl = document.getElementById("historyList");

let latestResult = null;
const MAX_HISTORY = 5;

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
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function markdownToHtml(markdown) {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
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
      out.push(`${escapeHtml(rawLine)}\n`);
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

  return out.join("\n");
}

async function openRenderedSummaryTab(result) {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);
  const settings = normalizeStoredSettings(stored);
  const exportSettingsForTab = {
    obsidianExportFrontmatter: settings.obsidianExportFrontmatter,
    obsidianExportTags: settings.obsidianExportTags,
    obsidianExportMetaInFrontmatter: settings.obsidianExportMetaInFrontmatter
  };
  const exportSettingsEncoded = escapeHtml(JSON.stringify(exportSettingsForTab));

  const summaryHtml = markdownToHtml(result.summaryMarkdown || "");
  const sourceTitle = escapeHtml(result.sourceTitle || "Panopto Lecture");
  const generatedAt = escapeHtml(new Date(result.generatedAt).toLocaleString());
  const provider = escapeHtml(result.provider || "unknown");
  const model = escapeHtml(result.model || "—");
  const captionCount = Number.isFinite(result.captionCount) ? result.captionCount : 0;
  const transcriptText = escapeHtml(result.transcriptText || "");
  const captionsSectionHtml = transcriptText
    ? `<details>
      <summary>Captions (sanitized transcript)</summary>
      <div class="meta">Lines: ${captionCount}</div>
      <div class="toolbar">
        <button id="copyCaptionsBtn" type="button">Copy captions</button>
      </div>
      <pre id="captions">${transcriptText}</pre>
    </details>`
    : `<details>
      <summary>Captions (sanitized transcript)</summary>
      <div class="meta">Transcript text was not retained in local history.</div>
    </details>`;
  const payloadEncoded = escapeHtml(
    JSON.stringify({
      generatedAt: result.generatedAt,
      provider: result.provider,
      model: result.model || "",
      captionCount: result.captionCount,
      sourceTitle: result.sourceTitle || "Panopto Lecture",
      summaryMarkdown: result.summaryMarkdown || "",
      transcriptText: result.transcriptText || ""
    })
  );
  const summaryTabScriptUrl = chrome.runtime.getURL("summary-tab.js");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${sourceTitle} - Summary</title>
    <style>
      :root {
        color-scheme: light dark;
        --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        --accent: #2b6cf0;
        --accent-hover: #1f5be0;
        --bg: #ffffff;
        --bg-elev: #f4f6f9;
        --text: #1a1c1f;
        --text-muted: #5b6572;
        --border: #e4e7ec;
        --border-strong: #d0d5dd;
        --radius: 10px;
        --focus: 0 0 0 3px rgba(43, 108, 240, 0.28);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --accent: #4d86ff;
          --accent-hover: #6a99ff;
          --bg: #16181d;
          --bg-elev: #22262e;
          --text: #e8eaed;
          --text-muted: #9aa3b0;
          --border: #2b2f38;
          --border-strong: #3a3f4a;
          --focus: 0 0 0 3px rgba(77, 134, 255, 0.4);
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: var(--font);
        max-width: 860px;
        margin: 0 auto;
        padding: 40px 24px 64px;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 26px;
        font-weight: 680;
        letter-spacing: -0.015em;
      }
      h2, h3 { margin: 1.4em 0 0.5em; font-weight: 650; }
      h2 { font-size: 18px; }
      h3 { font-size: 15px; }
      ul, ol { padding-left: 22px; }
      li { margin-bottom: 4px; }
      p { margin: 0.6em 0; }
      strong { font-weight: 650; }
      .meta {
        margin: 0 0 20px;
        color: var(--text-muted);
        font-size: 13px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--border);
      }
      details {
        margin-top: 24px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 12px 16px;
        background: var(--bg-elev);
      }
      summary {
        cursor: pointer;
        font-weight: 600;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin: 0 0 24px;
        padding: 12px;
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }
      .toolbar-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .toolbar-separator {
        width: 1px;
        align-self: stretch;
        background: var(--border-strong);
      }
      .toolbar-note {
        color: var(--text-muted);
        font-size: 13px;
      }
      button {
        border: 1px solid var(--border-strong);
        background: var(--bg);
        color: var(--text);
        border-radius: 8px;
        padding: 8px 14px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      }
      button:hover {
        background: var(--bg-elev);
        border-color: var(--accent);
      }
      button:focus-visible {
        outline: none;
        box-shadow: var(--focus);
      }
      #exportMdBtn, #exportObsidianBtn {
        background: var(--accent);
        border-color: transparent;
        color: #fff;
      }
      #exportMdBtn:hover, #exportObsidianBtn:hover {
        background: var(--accent-hover);
      }
      pre {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--mono);
        font-size: 13px;
      }
      code {
        font-family: var(--mono);
      }
      #summary-payload,
      #export-settings-payload {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <h1>${sourceTitle}</h1>
    <div class="meta">Generated: ${generatedAt} | Provider: ${provider} | Model: ${model}</div>
    <div class="toolbar">
      <div class="toolbar-group">
        <button type="button" id="exportMdBtn">Export .md</button>
        <button type="button" id="exportObsidianBtn">Export to Obsidian</button>
      </div>
      <div class="toolbar-separator" aria-hidden="true"></div>
      <div class="toolbar-group">
        <button type="button" id="connectObsidianBtn">Connect Obsidian Vault</button>
        <span class="toolbar-note" id="obsidianVaultStatus">No vault connected.</span>
        <button type="button" id="changeObsidianVaultBtn" hidden>Change</button>
      </div>
    </div>
    ${summaryHtml}
    ${captionsSectionHtml}
    <pre id="summary-payload">${payloadEncoded}</pre>
    <pre id="export-settings-payload">${exportSettingsEncoded}</pre>
    <script type="module" src="${summaryTabScriptUrl}"></script>
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
  const stored = await chrome.storage.local.get([HISTORY_STORAGE_KEY]);
  if (!Array.isArray(stored[HISTORY_STORAGE_KEY])) {
    return [];
  }
  return stored[HISTORY_STORAGE_KEY];
}

async function saveHistoryEntry(result) {
  const entry = {
    id: `${result.generatedAt}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: result.generatedAt,
    provider: result.provider,
    model: result.model,
    captionCount: result.captionCount,
    sourceTitle: result.sourceTitle,
    summaryMarkdown: result.summaryMarkdown
  };

  const history = await getHistory();
  const updated = [entry, ...history].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: updated });
  return updated;
}

async function clearHistory() {
  await chrome.storage.local.remove(HISTORY_STORAGE_KEY);
  latestResult = null;
  setOutput("");
  setStatus("Saved summary history cleared.");
  renderHistory([]);
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
        transcriptText: "",
        summaryMarkdown: item.summaryMarkdown,
        sourceTitle: item.sourceTitle,
        generatedAt: item.generatedAt
      };
      setOutput("");
      setStatus("Opening summary tab…");
      openRenderedSummaryTab(latestResult)
        .then(() => setStatus("Summary opened in a new tab."))
        .catch((error) => {
          setStatus("Error");
          setOutput(error?.message || String(error));
        });
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
    throw new Error(
      "Extension background is not available. Reload the extension in chrome://extensions (and refresh the Panopto tab), then try again."
    );
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
  chrome.storage.local.set({ preferredProvider: provider }).catch(() => {
    // Non-fatal; summary can still run with the in-memory selection.
  });
}

async function onSummarizeClick() {
  try {
    setOutput("Working...");
    const { tab, extracted } = await extractTranscriptFromActiveLecture();

    const selectedProvider = getSelectedProvider();
    setStatus(
      `Extracted ${extracted.captionCount} lines. Summarizing with ${selectedProvider}...`
    );
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
    await openRenderedSummaryTab(latestResult);
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
clearHistoryBtn?.addEventListener("click", () => {
  clearHistory().catch((error) => {
    setStatus("Error");
    setOutput(error.message || String(error));
  });
});
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
