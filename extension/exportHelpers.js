export function sanitizeFilename(input) {
  return (input || "panopto-lecture")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function sanitizeReadableFilename(input) {
  return (input || "Panopto Lecture Summary")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Panopto Lecture Summary";
}

export function deriveSummaryTopicSlug(summaryMarkdown) {
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

export function buildResultFilename(result, extension) {
  return `${sanitizeReadableFilename(result.sourceTitle || "")}.${extension}`;
}

export function buildContextMarkdown(result) {
  return (result.summaryMarkdown || "(empty)").trim();
}

export function normalizeInlineMarkdownToText(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

export function renderMarkdownToPdf(doc, markdown, result) {
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
    `Generated: ${new Date(result.generatedAt).toLocaleString()} | Provider: ${result.provider} | Model: ${result.model || "—"}`,
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
