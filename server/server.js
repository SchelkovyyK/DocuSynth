import express from "express";
import cors from "cors";
import multer from "multer";
import archiver from "archiver";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import simpleGit from "simple-git";

import { extractFilesFromZip } from "./fileUtils.js";
import { extractFilesFromRepo } from "./repoUtils.js";
import { generateDocs } from "./docsGenerator.js";

import {
  createProject,
  saveProjectMeta,
  listProjects,
  getDocsZip,
  deleteProject,
} from "./projectStore.js";

dotenv.config();

/* =========================
   PATH SETUP
========================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   APP SETUP
========================= */

const app = express();

console.log("SERVER VERSION: ZIP + GITHUB ENABLED");

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../static")));

/* =========================
   MULTER (ZIP UPLOAD)
========================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

/* =========================
   ROUTES
========================= */

// Frontend
app.get("/", (_, res) => {
  res.sendFile(path.resolve(__dirname, "../static/index.html"));
});

// List projects
app.get("/projects", (_, res) => {
  res.json(listProjects());
});

// Download docs
app.get("/projects/:name/download", (req, res) => {
  const zipPath = getDocsZip(req.params.name);
  if (!zipPath || !fs.existsSync(zipPath)) {
    return res.status(404).json({ error: "Docs not found" });
  }
  res.download(zipPath);
});

// Delete project
app.delete("/projects/:name", (req, res) => {
  deleteProject(req.params.name);
  res.json({ ok: true });
});

/* =========================
   ZIP FLOW
========================= */

app.post("/upload-zip", upload.single("project"), async (req, res) => {
  try {
    console.log("UPLOAD ZIP HIT");

    if (!req.file) {
      return res.status(400).json({ error: "No ZIP file uploaded" });
    }

    const projectName = req.file.originalname.replace(/\.zip$/i, "");
    const projectDir = createProject(projectName);

    const files = extractFilesFromZip(req.file.buffer);
    const docs = await generateDocs(projectName, files);

    const zipPath = path.join(projectDir, "docs.zip");
    await buildDocsZip(zipPath, docs);

    saveProjectMeta(projectName, {
      name: projectName,
      source: "zip",
      createdAt: new Date().toISOString(),
    });

    res.download(zipPath);
  } catch (err) {
    console.error("ZIP ERROR:", err);
    res.status(500).json({ error: "ZIP processing failed" });
  }
});

/* =========================
   GITHUB FLOW
========================= */

app.post("/upload-github", async (req, res) => {
  console.log("UPLOAD GITHUB HIT", req.body);

  const { repoUrl, projectName } = req.body;

  if (!repoUrl || !projectName) {
    return res
      .status(400)
      .json({ error: "repoUrl and projectName required" });
  }

  const projectDir = createProject(projectName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docusynth-"));
  const git = simpleGit();

  try {
    await git.clone(repoUrl, tmpDir, ["--depth", "1"]);

    const files = extractFilesFromRepo(tmpDir);
    const docs = await generateDocs(projectName, files);

    const zipPath = path.join(projectDir, "docs.zip");
    await buildDocsZip(zipPath, docs);

    saveProjectMeta(projectName, {
      name: projectName,
      source: repoUrl,
      createdAt: new Date().toISOString(),
    });

    res.download(zipPath);
  } catch (err) {
    console.error("GITHUB ERROR:", err);
    res.status(500).json({ error: "GitHub repository processing failed" });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/* =========================
   HELPERS
========================= */

async function buildDocsZip(zipPath, docs) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);

    archive.append(docs.readme || "", { name: "README.md" });
    archive.append(docs.api || "", { name: "API.md" });
    archive.append(docs.contributing || "", { name: "CONTRIBUTING.md" });
    archive.append(docs.architecture || "", { name: "ARCHITECTURE.md" });
    archive.append(docs.unified || "", { name: "DOCUMENTATION.md" });

    for (const [fname, md] of Object.entries(docs.fileExplanations || {})) {
      archive.append(md || "", {
        name: `file-explanations/${fname.replace(/[\/\\]/g, "_")}.md`,
      });
    }

    archive.finalize();
  });
}

/* =========================
   START SERVER
========================= */

app.listen(8001, () => {
  console.log("Server running at http://127.0.0.1:8001");
});
