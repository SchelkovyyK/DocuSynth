import fs from "fs";
import path from "path";
import { globSync } from "glob";

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
  ".pdf",
];

function isIgnored(p) {
  const lower = p.toLowerCase();
  if (IGNORED_FOLDERS.some((d) => lower.includes(`/${d}/`))) return true;
  if (IGNORED_EXTENSIONS.some((e) => lower.endsWith(e))) return true;
  return false;
}

export function extractFilesFromRepo(rootDir) {
  const files = [];

  const paths = globSync("**/*", {
    cwd: rootDir,
    nodir: true,
    absolute: true,
  });

  for (const absPath of paths) {
    if (isIgnored(absPath)) continue;

    let content;
    try {
      content = fs.readFileSync(absPath, "utf8");
    } catch {
      content = "[UNREADABLE OR BINARY FILE — SKIPPED]";
    }

    files.push({
      name: path.relative(rootDir, absPath),
      content,
    });
  }

  return files;
}
