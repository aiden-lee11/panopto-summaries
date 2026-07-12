const CAPTION_LIST_SELECTOR = 'ul.event-tab-list[aria-label="Captions"]';
const FALLBACK_LIST_SELECTOR = "#transcriptTabPane ul.event-tab-list";
const CAPTION_ROW_SELECTOR = `${CAPTION_LIST_SELECTOR} li.index-event`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLine(text) {
  return text.replace(/\s+/g, " ").trim();
}

function isLikelyNoise(line) {
  if (!line) return true;
  const stripped = line.replace(/[^\w\s]/g, "").trim().toLowerCase();
  if (!stripped) return true;
  if (line.includes("<@") && line.includes("@>")) return true;
  if (/^(um+|uh+|hmm+|mm+|ah+|er+)$/.test(stripped)) return true;
  return false;
}

function buildTranscript(captionEntries) {
  const cleaned = [];
  let previous = "";

  for (const entry of captionEntries) {
    const line = normalizeLine(entry.text);
    if (isLikelyNoise(line)) {
      continue;
    }
    if (line.toLowerCase() === previous.toLowerCase()) {
      continue;
    }
    previous = line;
    cleaned.push({
      time: entry.time || "",
      text: line
    });
  }

  const transcriptText = cleaned
    .map((entry) => (entry.time ? `[${entry.time}] ${entry.text}` : entry.text))
    .join("\n");

  return {
    cleanedEntries: cleaned,
    transcriptText
  };
}

async function ensureTranscriptTabOpen() {
  const transcriptHeader = document.querySelector("#transcriptTabHeader");
  if (!transcriptHeader) {
    return;
  }

  const isSelected = transcriptHeader.getAttribute("aria-selected") === "true";
  if (!isSelected) {
    transcriptHeader.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await sleep(350);
  }
}

function queryCaptionRows() {
  let rows = Array.from(document.querySelectorAll(CAPTION_ROW_SELECTOR));
  if (!rows.length) {
    rows = Array.from(
      document.querySelectorAll(`${FALLBACK_LIST_SELECTOR} li.index-event`)
    );
  }
  return rows;
}

function findCaptionListElement() {
  return (
    document.querySelector(CAPTION_LIST_SELECTOR) ||
    document.querySelector(FALLBACK_LIST_SELECTOR)
  );
}

function findScrollableAncestor(element) {
  if (!element) {
    return null;
  }
  let el = element;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const scrollableY =
      oy === "auto" || oy === "scroll" || oy === "overlay";
    if (scrollableY && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) {
    return 0;
  }
  const parts = String(timeStr)
    .trim()
    .split(":")
    .map((p) => Number.parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) {
    return 0;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function extractRowData(row) {
  const textNodes = Array.from(row.querySelectorAll(".event-text span"));
  const mergedText = textNodes
    .map((node) => node.textContent || "")
    .join(" ")
    .replace(/\u00a0/g, " ");
  const time = row.querySelector(".event-time")?.textContent?.trim() || "";
  return {
    text: mergedText,
    time
  };
}

function captionRowKey(data) {
  return `${data.time}\0${normalizeLine(data.text)}`;
}

/** Jump the captions panel to the bottom several times so lazy-loaded rows mount. */
async function collectAllCaptionData() {
  await ensureTranscriptTabOpen();

  let list = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    list = findCaptionListElement();
    if (list && queryCaptionRows().length) {
      break;
    }
    await sleep(250);
  }

  if (!list || !queryCaptionRows().length) {
    return [];
  }

  const merged = new Map();
  const recordVisibleRows = () => {
    for (const row of queryCaptionRows()) {
      const data = extractRowData(row);
      merged.set(captionRowKey(data), data);
    }
  };

  const scrollEl = findScrollableAncestor(list);
  if (scrollEl) {
    for (let i = 0; i < 4; i += 1) {
      const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      scrollEl.scrollTop = maxScroll;
      await sleep(25);
      recordVisibleRows();
    }
  } else {
    recordVisibleRows();
  }

  const entries = Array.from(merged.values());
  entries.sort(
    (a, b) => parseTimeToSeconds(a.time) - parseTimeToSeconds(b.time)
  );
  return entries;
}

async function extractTranscriptFromPage() {
  const rawEntries = await collectAllCaptionData();
  if (!rawEntries.length) {
    return {
      ok: false,
      error:
        "No captions found. Open the transcript/captions panel on the Panopto page and try again."
    };
  }
  const { cleanedEntries, transcriptText } = buildTranscript(rawEntries);
  if (!transcriptText || cleanedEntries.length < 3) {
    return {
      ok: false,
      error: "Transcript is too short to summarize reliably."
    };
  }

  return {
    ok: true,
    captionCount: cleanedEntries.length,
    transcriptText
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_TRANSCRIPT") {
    return;
  }

  extractTranscriptFromPage()
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Unexpected extraction error."
      });
    });

  return true;
});
