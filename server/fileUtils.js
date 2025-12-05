// fileUtils.js
import AdmZip from "adm-zip";

// --- ФІЛЬТРИ ---
const IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  ".vscode",
  "dist",
  "build",
  ".cache",
  "out",
  "coverage",
  ".tmp",
];

const IGNORED_FILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".env",
  ".dockerignore",
  ".gitignore",
  ".DS_Store",
  "Thumbs.db",
];

const IGNORED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".mp4",
  ".zip",
  ".tar",
  ".db",
  ".sqlite",
  ".psd",
  ".pdf",
];

// --- Допоміжні функції для фільтрації ---
function isIgnored(path) {
  const lower = path.toLowerCase();

  // 1. Ігнор папок
  if (
    IGNORED_FOLDERS.some(
      (dir) => lower.includes("/" + dir + "/") || lower.startsWith(dir + "/")
    )
  ) {
    return true;
  }

  // 2. Ігнор файлів по назві
  if (IGNORED_FILES.some((f) => lower.endsWith(f.toLowerCase()))) {
    return true;
  }

  // 3. Ігнор по розширенню
  if (IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true;
  }

  return false;
}

export function extractFilesFromZip(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;

    if (isIgnored(name)) continue; // <-- фільтр працює

    let content = "";
    try {
      // ❗ ЖОДНИХ ОБМЕЖЕНЬ РОЗМІРУ
      content = entry.getData().toString("utf8");
    } catch {
      content = "[UNREADABLE OR BINARY FILE — SKIPPED]";
    }

    files.push({ name, content });
  }

  return files;
}
