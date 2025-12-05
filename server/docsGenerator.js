import dotenv from "dotenv";
dotenv.config(); // Must come before using process.env
import Groq from "groq-sdk";
// simple sanitizer (remove credentials)
function sanitizeContent(text) {
  return text.replace(/(API_KEY|SECRET|PASSWORD|TOKEN)=.*$/gim, "$1=REDACTED");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY is missing! Check your .env file and dotenv.config()"
  );
}

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Build main docs prompt
function buildMainPrompt(projectName, summary) {
  return `
You are a senior software engineer and technical writer.
Produce high-quality documentation in Markdown for a project named "${projectName}".

Project summary: ${summary}

Include:
1) README.md (description, features, installation, usage, troubleshooting)
2) API.md (functions/classes with docstrings)
3) CONTRIBUTING.md
4) ARCHITECTURE.md (high-level architecture and mermaid diagram)

Return as valid JSON:
{
  "readme": "...",
  "api": "...",
  "contributing": "...",
  "architecture": "..."
}
  `;
}

// Generate explanation for a single file
async function generateFileExplanation(file) {
  const prompt = `
You are an expert developer.
Explain this file in Markdown:
Filename: ${file.name}
Content:
\`\`\`
${sanitizeContent(file.content)}
\`\`\`
Return only Markdown.
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
    } catch (err) {
      console.warn(`Attempt ${i + 1} failed for ${file.name}`);
      if (i === retries) return "Failed to generate explanation.";
    }
  }
}

// Main function
export async function generateDocs(projectName, files, onProgress) {
  // ✅ add onProgress here
  const summary = `Found ${files.length} files.`;

  // Generate main docs
  const mainPrompt = buildMainPrompt(projectName, summary);
  const mainResp = await client.chat.completions.create({
    model: "groq/compound",
    messages: [{ role: "user", content: mainPrompt }],
    temperature: 0.2,
  });

  let mainDocs;
  try {
    mainDocs = JSON.parse(mainResp.choices[0].message.content);
  } catch {
    mainDocs = {
      readme: mainResp.choices[0].message.content,
      api: "",
      contributing: "",
      architecture: "",
    };
  }

  // Generate file explanations individually with progress
  const fileExplanations = {};
  let completed = 0;

  for (const file of files) {
    fileExplanations[file.name] = await tryGenerateFile(file);
    completed++;

    // Call progress callback if provided
    if (onProgress) onProgress(completed, files.length, file.name);
  }

  return { ...mainDocs, fileExplanations };
}
