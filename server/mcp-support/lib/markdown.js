const fs = require("fs");
const path = require("path");

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[`*_>#~.,/\\():;[\]{}|!?"'+@%^&$=-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function splitIntoSections(md) {
  // Split by headings up to depth 3 and preserve heading lines
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = { heading: null, level: 0, start: 0, lines: [] };
  const headingRe = /^(#{1,3})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      // push existing
      if (current.lines.length) {
        sections.push({ ...current, end: i });
      }
      current = {
        heading: m[2].trim(),
        level: m[1].length,
        start: i,
        lines: [lines[i]]
      };
    } else {
      current.lines.push(lines[i]);
    }
  }
  if (current.lines.length) {
    sections.push({ ...current, end: lines.length });
  }
  return sections;
}

function scoreSection(sectionText, heading, query) {
  if (!query) return 0.1;
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0.1;
  const tTokens = tokenize(sectionText);
  const hTokens = tokenize(heading || "");
  const tSet = new Set(tTokens);
  const hSet = new Set(hTokens);

  let hits = 0;
  let headingHits = 0;
  for (const t of qTokens) {
    if (tSet.has(t)) hits += 1;
    if (hSet.has(t)) headingHits += 1;
  }
  const base = hits / qTokens.length;
  const headBoost = headingHits > 0 ? 0.2 + 0.3 * Math.min(1, headingHits / qTokens.length) : 0;
  const lengthPenalty = Math.min(0.2, Math.max(0, (tTokens.length - 800) / 4000)); // prefer shorter excerpts
  return Math.max(0, Math.min(1, base + headBoost - lengthPenalty));
}

function extractSectionsFromMarkdown(fileContent, question, maxSections = 3) {
  if (!fileContent) return [];
  const sections = splitIntoSections(fileContent);
  const scored = sections.map((s) => {
    const text = s.lines.join("\n");
    const score = scoreSection(text, s.heading, question);
    return {
      heading: s.heading,
      level: s.level,
      start: s.start,
      end: s.end,
      excerpt: text.trim().slice(0, 4000), // cap output
      confidence: Number(score.toFixed(3))
    };
  });
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, maxSections);
}

function loadDocsByFiles(basenames) {
  const root = path.resolve(process.cwd(), "knowledge");
  const results = [];
  for (const name of basenames) {
    const full = path.join(root, name);
    const content = safeRead(full);
    if (content) {
      results.push({ filename: name, fullpath: full, content });
    }
  }
  return results;
}

function searchKnowledgeBase(files, query) {
  const out = [];
  for (const f of files) {
    const hits = extractSectionsFromMarkdown(f.content, query);
    for (const h of hits) {
      out.push({
        filename: f.filename,
        headings: h.heading ? [h.heading] : [],
        excerpt: h.excerpt,
        confidence: h.confidence
      });
    }
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 5);
}

module.exports = {
  loadDocsByFiles,
  extractSectionsFromMarkdown,
  searchKnowledgeBase
};


