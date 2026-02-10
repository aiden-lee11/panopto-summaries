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

async function collectCaptionRows() {
  await ensureTranscriptTabOpen();

  // Captions sometimes render after a short delay after tab activation.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let rows = Array.from(document.querySelectorAll(CAPTION_ROW_SELECTOR));
    if (!rows.length) {
      rows = Array.from(
        document.querySelectorAll(`${FALLBACK_LIST_SELECTOR} li.index-event`)
      );
    }
    if (rows.length > 0) {
      return rows;
    }
    await sleep(250);
  }
  return [];
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

async function extractTranscriptFromPage() {
  const rows = await collectCaptionRows();
  if (!rows.length) {
    return {
      ok: false,
      error:
        "No captions found. Open the transcript/captions panel on the Panopto page and try again."
    };
  }

  const rawEntries = rows.map(extractRowData);
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
