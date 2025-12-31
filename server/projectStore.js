import fs from "fs";
import path from "path";

const ROOT = path.resolve("server/data/projects");

function ensureRoot() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });
}

export function createProject(name) {
  ensureRoot();
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveProjectMeta(name, meta) {
  fs.writeFileSync(
    path.join(ROOT, name, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
}

export function listProjects() {
  ensureRoot();
  return fs
    .readdirSync(ROOT)
    .map((p) => {
      const meta = path.join(ROOT, p, "meta.json");
      if (!fs.existsSync(meta)) return null;
      return JSON.parse(fs.readFileSync(meta, "utf8"));
    })
    .filter(Boolean);
}

export function getDocsZip(name) {
  return path.join(ROOT, name, "docs.zip");
}

export function deleteProject(name) {
  fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
}
