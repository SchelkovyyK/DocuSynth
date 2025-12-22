import dotenv from "dotenv";
dotenv.config();
import Groq from "groq-sdk";

/* =========================
   Helpers
========================= */

function sanitizeContent(text) {
  return text.replace(/(API_KEY|SECRET|PASSWORD|TOKEN)=.*$/gim, "$1=REDACTED");
}

function mdAnchor(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/* =========================
   Unified Markdown Builder
========================= */

function buildUnifiedMarkdown(projectName, docs) {
  const toc = [];
  let md = `# ${projectName} Documentation\n\n`;
  md += `## Content list\n`;

  function section(title, level = 2) {
    const anchor = mdAnchor(title);
    const indent = "  ".repeat(level - 2);
    toc.push(`${indent}- [${title}](#${anchor})`);
    md += `\n${"#".repeat(level)} ${title}\n\n`;
  }

  section("README");
  md += docs.readme || "";

  section("API");
  md += docs.api || "";

  section("ARCHITECTURE");
  md += docs.architecture || "";

  section("CONTRIBUTING");
  md += docs.contributing || "";

  section("File explanations");

  for (const [fname, content] of Object.entries(docs.fileExplanations)) {
    section(fname, 3);
    md += content + "\n";
  }

  md = md.replace(
    "## Content list\n",
    "## Content list\n" + toc.join("\n") + "\n\n---\n"
  );

  return md;
}

/* =========================
   Groq Setup
========================= */

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing!");
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* =========================
   STEP 1 — CODEBASE ANALYSIS
========================= */

async function analyzeCodebase(files) {
  // Limit size so we don't explode token usage
  const snapshot = files
    .slice(0, 40)
    .map(
      (f) =>
        `File: ${f.name}\nContent:\n${sanitizeContent(
          f.content.slice(0, 1500)
        )}`
    )
    .join("\n\n");

  const prompt = `
You are a senior software architect.

Analyze the following repository and determine ONLY from the code:

- Programming languages actually used
- Whether this is frontend-only, backend-only, or fullstack
- Frameworks or libraries that are explicitly present
- Entry points (index.html, main.js, server.js, etc.)
- What the project DOES
- What the project DOES NOT include (important)

Rules:
- DO NOT guess technologies
- DO NOT infer backend if none exists
- DO NOT mention Python, Node, databases, or APIs unless clearly present
- If something is missing, explicitly say it is missing

Return a concise, factual analysis in plain English.
`;

  const resp = await client.chat.completions.create({
    model: "groq/compound",
    messages: [{ role: "user", content: prompt + "\n\n" + snapshot }],
    temperature: 0.1,
  });

  return resp.choices[0].message.content;
}

/* =========================
   STEP 2 — MAIN DOC PROMPT
========================= */

function buildMainPrompt(projectName, analysis) {
  return `
You are a senior software engineer and technical writer.

You are documenting a project named "${projectName}".

GROUND TRUTH ANALYSIS (do not contradict this):
${analysis}

Rules:
- Base ALL documentation strictly on the analysis above
- If the project is frontend-only, clearly state that
- If no backend or API exists, explicitly say "No API present"
- Do NOT invent features, services, databases, or languages

Produce Markdown documentation:

1) README.md
2) API.md (or state clearly that no API exists)
3) CONTRIBUTING.md
4) ARCHITECTURE.md (describe the real architecture only)

Return VALID JSON:
{
  "readme": "...",
  "api": "...",
  "contributing": "...",
  "architecture": "..."
}
`;
}

/* =========================
   File Explanation
========================= */

async function generateFileExplanation(file) {
  const prompt = `
Explain the following file based ONLY on its content.

Filename: ${file.name}

Content:
\`\`\`
${sanitizeContent(file.content)}
\`\`\`

Rules:
- Do not guess missing context
- If the file is simple, say so
- Return Markdown only
`;

  const resp = await client.chat.completions.create({
    model: "groq/compound",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return resp.choices[0].message.content;
}

async function tryGenerateFile(file, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await generateFileExplanation(file);
    } catch {
      if (i === retries) return "Failed to generate explanation.";
    }
  }
}

/* =========================
   MAIN EXPORT
========================= */

export async function generateDocs(projectName, files, onProgress) {
  let analysis;
  try {
    analysis = await analyzeCodebase(files);
    console.log("Codebase analysis:", analysis);
  } catch (err) {
    console.error("Error during codebase analysis:", err);
    throw new Error("Codebase analysis failed: " + err.message);
  }

  let mainResp;
  try {
    mainResp = await client.chat.completions.create({
      model: "groq/compound",
      messages: [
        { role: "user", content: buildMainPrompt(projectName, analysis) },
      ],
      temperature: 0.2,
    });
  } catch (err) {
    console.error("Error generating main docs from LLM:", err);
    throw new Error("LLM main doc generation failed: " + err.message);
  }

  let mainDocs;
  try {
    mainDocs = JSON.parse(mainResp.choices[0].message.content);
  } catch (err) {
    console.warn(
      "LLM response is not valid JSON, falling back to raw content",
      err
    );
    mainDocs = {
      readme: mainResp.choices[0].message.content,
      api: "",
      contributing: "",
      architecture: "",
    };
  }

  // Generate per-file explanations
  const fileExplanations = {};
  let completed = 0;
  for (const file of files) {
    try {
      fileExplanations[file.name] = await tryGenerateFile(file);
    } catch (err) {
      console.error("Error generating file explanation for", file.name, err);
      fileExplanations[file.name] = "Failed to generate explanation.";
    }
    completed++;
    if (onProgress) onProgress(completed, files.length, file.name);
  }

  const unified = buildUnifiedMarkdown(projectName, {
    ...mainDocs,
    fileExplanations,
  });

  return { ...mainDocs, fileExplanations, unified };
}
