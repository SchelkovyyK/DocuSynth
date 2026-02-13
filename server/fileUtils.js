import AdmZip from "adm-zip";

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

function isIgnored(path) {
  const lower = path.toLowerCase();

  if (
    IGNORED_FOLDERS.some(
      (dir) => lower.includes("/" + dir + "/") || lower.startsWith(dir + "/")
    )
  ) {
    return true;
  }

  if (IGNORED_FILES.some((f) => lower.endsWith(f.toLowerCase()))) {
    return true;
  }

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

    if (isIgnored(name)) continue; 

    let content = "";
    try {
      content = entry.getData().toString("utf8");
    } catch {
      content = "[UNREADABLE OR BINARY FILE — SKIPPED]";
    }

    files.push({ name, content });
  }

  return files;
}
