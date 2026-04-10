import { buildExportMarkdown, buildResultFilename } from "./exportHelpers.js";
import { normalizeStoredSettings } from "./shared.js";

function readExportOptionsFromDocument() {
  const el = document.getElementById("export-settings-payload");
  const fallback = () => {
    const s = normalizeStoredSettings({});
    return {
      obsidianExportFrontmatter: s.obsidianExportFrontmatter,
      obsidianExportTags: s.obsidianExportTags,
      obsidianExportMetaInFrontmatter: s.obsidianExportMetaInFrontmatter
    };
  };
  if (!el) {
    return fallback();
  }
  try {
    const parsed = JSON.parse(el.textContent.trim());
    const s = normalizeStoredSettings({});
    return {
      obsidianExportFrontmatter: Boolean(parsed.obsidianExportFrontmatter),
      obsidianExportTags:
        typeof parsed.obsidianExportTags === "string"
          ? parsed.obsidianExportTags
          : s.obsidianExportTags,
      obsidianExportMetaInFrontmatter: Boolean(
        parsed.obsidianExportMetaInFrontmatter
      )
    };
  } catch {
    return fallback();
  }
}

const OBSIDIAN_VAULT_STORAGE_KEY = "obsidian_vault_name";
const OBSIDIAN_FOLDER_PATH_STORAGE_KEY = "obsidian_folder_path";

function getStoredVaultName() {
  return localStorage.getItem(OBSIDIAN_VAULT_STORAGE_KEY)?.trim() || "";
}

function setStoredVaultName(vaultName) {
  localStorage.setItem(OBSIDIAN_VAULT_STORAGE_KEY, vaultName);
}

function getStoredFolderPath() {
  return localStorage.getItem(OBSIDIAN_FOLDER_PATH_STORAGE_KEY)?.trim() || "";
}

function setStoredFolderPath(folderPath) {
  if (folderPath) {
    localStorage.setItem(OBSIDIAN_FOLDER_PATH_STORAGE_KEY, folderPath);
    return;
  }
  localStorage.removeItem(OBSIDIAN_FOLDER_PATH_STORAGE_KEY);
}

function buildObsidianFilePath(filename, folderPath = "") {
  const normalizedFolder = String(folderPath || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return normalizedFolder ? `${normalizedFolder}/${filename}` : filename;
}

function renderObsidianVaultState() {
  const vaultName = getStoredVaultName();
  const folderPath = getStoredFolderPath();
  const statusEl = document.getElementById("obsidianVaultStatus");
  const connectBtn = document.getElementById("connectObsidianBtn");
  const changeBtn = document.getElementById("changeObsidianVaultBtn");

  if (statusEl) {
    statusEl.textContent = vaultName
      ? folderPath
        ? `Connected to: ${vaultName} / ${folderPath}`
        : `Connected to: ${vaultName}`
      : "No vault connected.";
  }
  if (connectBtn) {
    connectBtn.hidden = Boolean(vaultName);
  }
  if (changeBtn) {
    changeBtn.hidden = !vaultName;
  }
}

async function discoverVaultName() {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new Error("This browser does not support folder picking for Obsidian vault discovery.");
  }

  const vaultHandle = await window.showDirectoryPicker({ id: "obsidian-vault-root" });
  const vaultName = vaultHandle?.name?.trim();
  if (!vaultName) {
    throw new Error("Could not determine the selected Obsidian vault name.");
  }

  let folderPath = "";
  try {
    const subfolderHandle = await window.showDirectoryPicker({
      id: "obsidian-vault-subfolder",
      startIn: vaultHandle
    });
    const relativeParts = await vaultHandle.resolve(subfolderHandle);
    if (relativeParts === null) {
      throw new Error("Select a folder inside the chosen Obsidian vault.");
    }
    folderPath = relativeParts.join("/");
  } catch (error) {
    if (error?.name !== "AbortError") {
      throw error;
    }
  }

  setStoredVaultName(vaultName);
  setStoredFolderPath(folderPath);
  renderObsidianVaultState();
  return { vaultName, folderPath };
}

function exportViaURI(filename, content, folderPath = "") {
  const vaultName = getStoredVaultName();
  if (!vaultName) {
    throw new Error("Connect an Obsidian vault before exporting.");
  }

  const filePath = buildObsidianFilePath(filename, folderPath);
  const uri =
    `obsidian://new?vault=${encodeURIComponent(vaultName)}` +
    `&file=${encodeURIComponent(filePath)}` +
    `&content=${encodeURIComponent(content)}`;
  window.location.href = uri;
}

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

function wireObsidianVaultControls() {
  const connectBtn = document.getElementById("connectObsidianBtn");
  const changeBtn = document.getElementById("changeObsidianVaultBtn");

  const handleDiscoveryClick = async () => {
    try {
      await discoverVaultName();
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      alert(error?.message || "Failed to connect Obsidian vault.");
    }
  };

  connectBtn?.addEventListener("click", handleDiscoveryClick);
  changeBtn?.addEventListener("click", handleDiscoveryClick);
  renderObsidianVaultState();
}

function wireExports(result) {
  const exportMdBtn = document.getElementById("exportMdBtn");
  const exportObsidianBtn = document.getElementById("exportObsidianBtn");
  const exportOpts = readExportOptionsFromDocument();
  const context = buildExportMarkdown(result, exportOpts);
  const filename = buildResultFilename(result, "md");

  exportMdBtn?.addEventListener("click", () => {
    const blob = new Blob([context], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  exportObsidianBtn?.addEventListener("click", async () => {
    try {
      let vaultName = getStoredVaultName();
      if (!vaultName) {
        ({ vaultName } = await discoverVaultName());
      }
      if (!vaultName) {
        return;
      }
      exportViaURI(filename, context, getStoredFolderPath());
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      alert(error?.message || "Failed to export to Obsidian.");
    }
  });
}

function initSummaryTab() {
  wireCopyCaptions();
  wireObsidianVaultControls();

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
