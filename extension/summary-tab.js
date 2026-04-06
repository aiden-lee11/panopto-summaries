import { jsPDF } from "jspdf";
import {
  buildContextMarkdown,
  buildResultFilename,
  renderMarkdownToPdf
} from "./exportHelpers.js";

function wireCopyCaptions() {
  const btn = document.getElementById("copyCaptionsBtn");
  const captions = document.getElementById("captions");
  if (!btn || !captions) return;
  btn.addEventListener("click", async () => {
    const text = captions.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1200);
    } catch (error) {
      alert(error?.message || "Failed to copy captions.");
    }
  });
}

function wireExports(result) {
  const exportMdBtn = document.getElementById("exportMdBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (!exportMdBtn || !exportPdfBtn) return;

  exportMdBtn.addEventListener("click", () => {
    const context = buildContextMarkdown(result);
    const blob = new Blob([context], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = buildResultFilename(result, "md");
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  exportPdfBtn.addEventListener("click", () => {
    const doc = new jsPDF({
      unit: "pt",
      format: "letter"
    });
    renderMarkdownToPdf(doc, result.summaryMarkdown || "", result);
    const filename = buildResultFilename(result, "pdf");
    doc.save(filename);
  });
}

function initSummaryTab() {
  wireCopyCaptions();

  const payloadEl = document.getElementById("summary-payload");
  if (!payloadEl) return;

  let result;
  try {
    result = JSON.parse(payloadEl.textContent.trim());
  } catch (_e) {
    return;
  }

  wireExports(result);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSummaryTab);
} else {
  initSummaryTab();
}
