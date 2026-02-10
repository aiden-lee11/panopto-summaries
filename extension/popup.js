const summarizeBtn = document.getElementById("summarizeBtn");
const settingsBtn = document.getElementById("settingsBtn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const providerEls = Array.from(document.querySelectorAll('input[name="provider"]'));
const exportBtn = document.getElementById("exportBtn");
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
  return chrome.runtime.sendMessage({
    type: "SUMMARIZE_TRANSCRIPT",
    payload: transcriptPayload,
    provider
  });
}

function getSelectedProvider() {
  const selected = providerEls.find((el) => el.checked);
  return selected?.value || "openai";
}

async function loadPreferredProvider() {
  const settings = await chrome.storage.local.get(["preferredProvider"]);
  const preferred = settings.preferredProvider || "openai";
  for (const input of providerEls) {
    input.checked = input.value === preferred;
  }
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
    setOutput(summary.outputMarkdown);
    latestResult = {
      provider: selectedProvider,
      captionCount: extracted.captionCount,
      transcriptText: extracted.transcriptText,
      summaryMarkdown: summary.outputMarkdown,
      sourceTitle: tab.title || "Panopto Lecture",
      generatedAt: Date.now()
    };
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

loadPreferredProvider().catch(() => {
  setStatus("Ready.");
});
updateActionButtons();
refreshHistory().catch(() => {
  historyListEl.textContent = "Failed to load saved summaries.";
});
