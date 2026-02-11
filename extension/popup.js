import { jsPDF } from "jspdf";

const summarizeBtn = document.getElementById("summarizeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const providerEls = Array.from(document.querySelectorAll('input[name="provider"]'));
const promptPresetEl = document.getElementById("promptPreset");
const promptBehaviorEl = document.getElementById("promptBehavior");
const customInstructionGroupEl = document.getElementById("customInstructionGroup");
const customInstructionEl = document.getElementById("customInstruction");
const exportBtn = document.getElementById("exportBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const forkBtn = document.getElementById("forkBtn");
const historyListEl = document.getElementById("historyList");

let latestResult = null;
const HISTORY_KEY = "summaryHistory";
const MAX_HISTORY = 5;
const FORK_DEBUG_KEY = "lastForkDebug";
const CHATGPT_FORK_URL = "https://chatgpt.com/?model=auto";

function setStatus(message) {
  statusEl.textContent = message;
}

function setOutput(message) {
  outputEl.textContent = message;
}

function updateCustomInstructionVisibility() {
  const hide = promptBehaviorEl?.value === "no_custom_prompt";
  if (customInstructionGroupEl) {
    customInstructionGroupEl.style.display = hide ? "none" : "";
  }
}

function pushForkDebug(event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    data
  };
  console.log("[fork-debug]", entry);

  chrome.storage.local
    .get([FORK_DEBUG_KEY])
    .then((stored) => {
      const current = Array.isArray(stored[FORK_DEBUG_KEY]) ? stored[FORK_DEBUG_KEY] : [];
      const next = [...current, entry].slice(-40);
      return chrome.storage.local.set({ [FORK_DEBUG_KEY]: next });
    })
    .catch((error) => {
      console.warn("[fork-debug] failed to persist", error);
    });
}

function sanitizeFilename(input) {
  return (input || "panopto-lecture")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function deriveSummaryTopicSlug(summaryMarkdown) {
  const lines = (summaryMarkdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const sourceLine = (bulletLines[0] || lines[0] || "lecture-summary").replace(
    /^[-*]\s+/,
    ""
  );

  const words = sourceLine
    .replace(/[`~*_#[\](){}:;,.!?'"|\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join("-");

  return sanitizeFilename(words || "lecture-summary");
}

function buildExportFilename(result) {
  const date = new Date(result.generatedAt).toISOString().slice(0, 10);
  const topic = deriveSummaryTopicSlug(result.summaryMarkdown);
  return `${date}-${topic}.md`;
}

function buildPdfFilename(result) {
  const date = new Date(result.generatedAt).toISOString().slice(0, 10);
  const topic = deriveSummaryTopicSlug(result.summaryMarkdown);
  return `${date}-${topic}.pdf`;
}

function buildContextMarkdown(result) {
  const metaLines = [
    `- Generated at: ${new Date(result.generatedAt).toISOString()}`,
    `- Source provider: ${result.provider}`,
    `- Caption lines: ${result.captionCount}`
  ];

  return [
    "# Panopto Lecture Summary Context",
    "",
    "## Metadata",
    ...metaLines,
    "",
    "## Summary",
    result.summaryMarkdown || "(empty)",
    "",
    "## Sanitized Transcript",
    "```text",
    result.transcriptText || "",
    "```",
    ""
  ].join("\n");
}

function buildForkPromptText(result) {
  const summary = (result.summaryMarkdown || "").trim();
  const transcript = (result.transcriptText || "").trim();
  return [
    "",
    "",
    "",
    "below is a summary of the lecture to reference",
    "",
    summary || "(empty summary)",
    "",
    "sanitized transcript excerpt (for extra context):",
    "```text",
    transcript,
    "```"
  ].join("\n");
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

function openRenderedSummaryTab(result) {
  const summaryHtml = markdownToHtml(result.summaryMarkdown || "");
  const sourceTitle = escapeHtml(result.sourceTitle || "Panopto Lecture");
  const generatedAt = escapeHtml(new Date(result.generatedAt).toLocaleString());
  const provider = escapeHtml(result.provider || "unknown");

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
    </style>
  </head>
  <body>
    <h1>${sourceTitle}</h1>
    <div class="meta">Generated: ${generatedAt} | Provider: ${provider}</div>
    ${summaryHtml}
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

function moveCaretToStartContentEditable(el) {
  try {
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch (_error) {
    return false;
  }
}

async function waitForTabLoad(tabId, timeoutMs = 20000) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("Timed out waiting for ChatGPT tab to load."));
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function injectPromptIntoChatGpt(tabId, promptText) {
  const executionResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (text) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      function moveCaretToStart(el) {
        if (!el) return false;
        el.focus();
        if (el instanceof HTMLTextAreaElement) {
          try {
            el.setSelectionRange(0, 0);
            return el.selectionStart === 0;
          } catch (_error) {
            return false;
          }
        }
        try {
          const selection = window.getSelection();
          if (!selection) return false;
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return selection.anchorOffset === 0;
        } catch (_error) {
          return false;
        }
      }
      function installCaretGuard(selector, durationMs = 3500) {
        const startedAt = Date.now();
        const tick = () => {
          const el = document.querySelector(selector);
          if (el) {
            moveCaretToStart(el);
          }
          if (Date.now() - startedAt >= durationMs) {
            clearInterval(intervalId);
            document.removeEventListener("selectionchange", onSelectionChange, true);
          }
        };
        const onSelectionChange = () => {
          const active = document.activeElement;
          if (!active) return;
          if (active.matches?.(selector)) {
            moveCaretToStart(active);
          }
        };
        const intervalId = setInterval(tick, 120);
        document.addEventListener("selectionchange", onSelectionChange, true);
        tick();
      }
      const selectors = [
        "#prompt-textarea",
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Send a message"]',
        'div#prompt-textarea[contenteditable="true"]',
        'textarea[data-id="root"]',
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"][data-lexical-editor="true"]'
      ];
      const newChatSelectors = [
        'a[href="/"]',
        'button[aria-label*="New chat"]',
        'button[data-testid*="new-chat"]',
        '[data-testid="create-new-chat-button"]'
      ];
      let clickedNewChat = false;

      const start = Date.now();
      const maxWaitMs = 15000;

      while (Date.now() - start < maxWaitMs) {
        let inputEl = null;
        let matchedSelector = "";
        for (const selector of selectors) {
          inputEl = document.querySelector(selector);
          if (inputEl) {
            matchedSelector = selector;
            break;
          }
        }
        if (!inputEl) {
          // In non-temporary mode ChatGPT may open on a prior thread; try forcing a new chat once.
          if (!clickedNewChat && Date.now() - start > 1500) {
            for (const selector of newChatSelectors) {
              const newChatEl = document.querySelector(selector);
              if (newChatEl instanceof HTMLElement) {
                newChatEl.click();
                clickedNewChat = true;
                break;
              }
            }
          }
          await sleep(300);
          continue;
        }

        inputEl.focus();
        if (inputEl instanceof HTMLTextAreaElement) {
          const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          if (valueSetter) {
            valueSetter.call(inputEl, text);
          } else {
            inputEl.value = text;
          }
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));
          inputEl.dispatchEvent(new Event("change", { bubbles: true }));
          const caretAtStart = moveCaretToStart(inputEl);
          installCaretGuard(matchedSelector);
          return {
            ok: true,
            mode: "textarea",
            selector: matchedSelector,
            valueLength: inputEl.value.length,
            caretAtStart,
            url: location.href,
            title: document.title,
            caretGuardInstalled: true,
            clickedNewChat
          };
        }

        // Prefer insertText so editors preserve newlines instead of flattening to spaces.
        let insertedWithExecCommand = false;
        try {
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(inputEl);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          insertedWithExecCommand = document.execCommand("insertText", false, text);
        } catch (_error) {
          insertedWithExecCommand = false;
        }

        if (!insertedWithExecCommand) {
          inputEl.textContent = "";
          const lines = text.split("\n");
          lines.forEach((line, index) => {
            if (index > 0) {
              inputEl.appendChild(document.createElement("br"));
            }
            inputEl.appendChild(document.createTextNode(line));
          });
        }

        inputEl.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: text,
            inputType: "insertText"
          })
        );
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        const caretMoved = moveCaretToStart(inputEl);
        installCaretGuard(matchedSelector);
        return {
          ok: true,
          mode: "contenteditable",
          selector: matchedSelector,
          valueLength: (inputEl.textContent || "").length,
          insertMethod: insertedWithExecCommand ? "execCommand-insertText" : "dom-fallback",
          caretAtStart: caretMoved,
          url: location.href,
          title: document.title,
          caretGuardInstalled: true,
          clickedNewChat
        };
      }

      const authText =
        document.body?.innerText?.slice(0, 3000).toLowerCase() || "";
      const needsAuth =
        authText.includes("log in") ||
        authText.includes("sign up") ||
        authText.includes("continue with");
      const editableCount = document.querySelectorAll('[contenteditable="true"]').length;
      const textareaCount = document.querySelectorAll("textarea").length;

      return {
        ok: false,
        reason: needsAuth ? "needs-auth" : "composer-not-found",
        url: location.href,
        title: document.title,
        editableCount,
        textareaCount,
        clickedNewChat
      };
    },
    args: [promptText]
  });

  const first = executionResults?.[0];
  if (!first) {
    return { ok: false, reason: "no-execute-script-result" };
  }
  return first.result || { ok: false, reason: "empty-execute-script-result" };
}

function updateActionButtons() {
  const enabled = Boolean(latestResult?.summaryMarkdown);
  exportBtn.disabled = !enabled;
  exportPdfBtn.disabled = !enabled;
  forkBtn.disabled = !enabled;
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
        captionCount: item.captionCount,
        transcriptText: item.transcriptSnippet || "",
        summaryMarkdown: item.summaryMarkdown,
        sourceTitle: item.sourceTitle,
        generatedAt: item.generatedAt
      };
      setOutput(item.summaryMarkdown);
      setStatus(
        "Loaded saved summary. Fork uses saved summary and transcript snippet context."
      );
      updateActionButtons();
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

async function extractTranscript(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "EXTRACT_TRANSCRIPT" });
}

async function summarizeTranscript(transcriptPayload) {
  const provider = getSelectedProvider();
  const promptConfig = getPromptConfigFromPopup();
  return chrome.runtime.sendMessage({
    type: "SUMMARIZE_TRANSCRIPT",
    payload: transcriptPayload,
    provider,
    promptPreset: promptConfig.promptPreset,
    promptBehavior: promptConfig.promptBehavior,
    customInstruction: promptConfig.customInstruction
  });
}

function getPromptConfigFromPopup() {
  return {
    promptPreset: promptPresetEl?.value || "bullet_points",
    promptBehavior:
      promptBehaviorEl?.value === "append_guidance"
        ? "append_guidance"
        : promptBehaviorEl?.value === "no_custom_prompt"
          ? "no_custom_prompt"
          : "custom_only",
    customInstruction: customInstructionEl?.value?.trim() || ""
  };
}

function getSelectedProvider() {
  const selected = providerEls.find((el) => el.checked);
  return selected?.value || "openai";
}

async function loadPreferredProvider() {
  const settings = await chrome.storage.local.get([
    "preferredProvider",
    "defaultPromptPreset",
    "defaultPromptBehavior",
    "defaultCustomInstruction"
  ]);
  const preferred = settings.preferredProvider || "openai";
  for (const input of providerEls) {
    input.checked = input.value === preferred;
  }

  if (promptPresetEl) {
    promptPresetEl.value = settings.defaultPromptPreset || "bullet_points";
  }
  if (promptBehaviorEl) {
    promptBehaviorEl.value =
      settings.defaultPromptBehavior === "append_guidance" ||
      settings.defaultPromptBehavior === "no_custom_prompt"
        ? settings.defaultPromptBehavior
        : "custom_only";
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
    setStatus("Checking active tab...");
    setOutput("Working...");

    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url) {
      throw new Error("Could not read active tab.");
    }
    if (!tab.url.includes("panopto.com")) {
      throw new Error("Open a Panopto lecture tab first.");
    }

    setStatus("Extracting captions...");
    const extracted = await extractTranscript(tab.id);
    if (!extracted?.ok) {
      throw new Error(extracted?.error || "Caption extraction failed.");
    }

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
      captionCount: extracted.captionCount,
      transcriptText: extracted.transcriptText,
      summaryMarkdown: summary.outputMarkdown,
      sourceTitle: tab.title || "Panopto Lecture",
      generatedAt: Date.now()
    };
    openRenderedSummaryTab(latestResult);
    setOutput("Summary opened in a new tab.");
    updateActionButtons();
    await saveHistoryEntry(latestResult);
    await refreshHistory();
  } catch (error) {
    setStatus("Error");
    setOutput(error.message || String(error));
  }
}

function exportSummaryMarkdown() {
  if (!latestResult?.summaryMarkdown) {
    return;
  }

  const context = buildContextMarkdown(latestResult);
  const blob = new Blob([context], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = buildExportFilename(latestResult);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${filename}`);
}

function normalizeInlineMarkdownToText(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function renderMarkdownToPdf(doc, markdown, result) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;
  let inCodeBlock = false;

  const ensureSpace = (heightNeeded) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text, opts = {}) => {
    const {
      size = 11,
      style = "normal",
      indent = 0,
      prefix = "",
      font = "helvetica"
    } = opts;
    const normalized = normalizeInlineMarkdownToText(text).trim();
    if (!normalized) {
      y += size * 0.7;
      return;
    }

    doc.setFont(font, style);
    doc.setFontSize(size);
    const lineHeight = size * 1.35;

    if (prefix) {
      const prefixWidth = doc.getTextWidth(`${prefix} `);
      const firstLineWidth = maxWidth - indent - prefixWidth;
      const lines = doc.splitTextToSize(normalized, Math.max(60, firstLineWidth));
      ensureSpace(lineHeight * Math.max(1, lines.length + 0.2));
      doc.text(`${prefix} ${lines[0] || ""}`, margin + indent, y);
      y += lineHeight;
      for (let i = 1; i < lines.length; i += 1) {
        ensureSpace(lineHeight);
        doc.text(lines[i], margin + indent + prefixWidth, y);
        y += lineHeight;
      }
      return;
    }

    const lines = doc.splitTextToSize(normalized, maxWidth - indent);
    ensureSpace(lineHeight * Math.max(1, lines.length + 0.2));
    for (const line of lines) {
      doc.text(line, margin + indent, y);
      y += lineHeight;
      ensureSpace(lineHeight);
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  writeWrapped(result.sourceTitle || "Panopto Lecture Summary", {
    size: 18,
    style: "bold"
  });
  writeWrapped(
    `Generated: ${new Date(result.generatedAt).toLocaleString()} | Provider: ${result.provider}`,
    { size: 10, style: "normal" }
  );
  y += 6;

  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      y += 5;
      continue;
    }

    if (inCodeBlock) {
      writeWrapped(rawLine, { size: 10, font: "courier" });
      continue;
    }

    if (!line.trim()) {
      y += 6;
      ensureSpace(12);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      const sizeByLevel = { 1: 16, 2: 14, 3: 13, 4: 12, 5: 11, 6: 10 };
      y += 2;
      writeWrapped(headingMatch[2], {
        size: sizeByLevel[level],
        style: "bold"
      });
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      writeWrapped(ulMatch[1], { size: 11, prefix: "•", indent: 8 });
      continue;
    }

    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      writeWrapped(olMatch[2], { size: 11, prefix: `${olMatch[1]}.`, indent: 8 });
      continue;
    }

    writeWrapped(line, { size: 11 });
  }
}

function exportSummaryPdf() {
  if (!latestResult?.summaryMarkdown) {
    return;
  }

  const doc = new jsPDF({
    unit: "pt",
    format: "letter"
  });
  renderMarkdownToPdf(doc, latestResult.summaryMarkdown || "", latestResult);
  const filename = buildPdfFilename(latestResult);
  doc.save(filename);
  setStatus(`Exported ${filename}`);
}

async function forkWithContext() {
  pushForkDebug("fork-start", {
    hasLatestResult: Boolean(latestResult?.summaryMarkdown)
  });
  if (!latestResult?.summaryMarkdown) {
    return;
  }
  const context = buildForkPromptText(latestResult);
  pushForkDebug("context-built", {
    contextLength: context.length
  });
  await navigator.clipboard.writeText(context);
  pushForkDebug("clipboard-write", { ok: true });

  const tab = await chrome.tabs.create({ url: CHATGPT_FORK_URL });
  pushForkDebug("tab-created", {
    tabId: tab?.id || null,
    tabUrl: tab?.url || null
  });
  if (!tab?.id) {
    throw new Error("Could not open ChatGPT tab.");
  }

  await waitForTabLoad(tab.id);
  pushForkDebug("tab-loaded", { tabId: tab.id });
  const injected = await injectPromptIntoChatGpt(tab.id, context);
  pushForkDebug("injection-result", injected || {});

  if (!injected?.ok) {
    setStatus("Opened ChatGPT. Could not auto-insert; context is copied to clipboard.");
    return;
  }

  setStatus("Opened ChatGPT and inserted context into the message box.");
}

summarizeBtn.addEventListener("click", onSummarizeClick);
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
exportBtn.addEventListener("click", exportSummaryMarkdown);
exportPdfBtn.addEventListener("click", exportSummaryPdf);
forkBtn.addEventListener("click", () => {
  forkWithContext().catch((error) => {
    pushForkDebug("fork-error", { message: error?.message || String(error) });
    setStatus("Error");
    setOutput(error?.message || "Failed to fork with context.");
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
updateActionButtons();
refreshHistory().catch(() => {
  historyListEl.textContent = "Failed to load saved summaries.";
});
