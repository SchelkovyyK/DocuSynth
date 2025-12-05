import express from "express";
import cors from "cors";
import multer from "multer";
import archiver from "archiver";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url"; // <-- MUST import this
import { extractFilesFromZip } from "./fileUtils.js";
import { generateDocs } from "./docsGenerator.js";

dotenv.config();

// Create __filename and __dirname equivalents
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../static"))); // serve static assets

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// <-- ADD THIS HERE, after middleware, before your POST route
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../static/index.html"));
});

// Your existing POST /upload-zip route
app.post("/upload-zip", upload.single("project"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const files = extractFilesFromZip(req.file.buffer);
    const docs = await generateDocs(
      req.file.originalname.replace(/\.zip$/i, ""),
      files
    );

    // Stream ZIP to client
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.file.originalname.replace(
        /\.zip$/i,
        "_docs.zip"
      )}"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("ARCHIVER ERROR:", err);
      if (!res.headersSent)
        res.status(500).json({ error: "Failed to create ZIP" });
    });

    archive.pipe(res);

    // Add main docs
    archive.append(docs.readme || "", { name: "README.md" });
    archive.append(docs.api || "", { name: "API.md" });
    archive.append(docs.contributing || "", { name: "CONTRIBUTING.md" });
    archive.append(docs.architecture || "", { name: "ARCHITECTURE.md" });

    // Add per-file explanations
    for (const [fname, md] of Object.entries(docs.fileExplanations)) {
      const safeName = fname.replace(/[\/\\]/g, "_") + ".md";
      archive.append(md || "", { name: `file-explanations/${safeName}` });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Server error" });
  }
});

app.listen(8001, () => console.log("Server running on http://127.0.0.1:8001"));
