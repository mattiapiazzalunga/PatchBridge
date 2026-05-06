"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { normalizeRoot, resolveInside, toPosixPath } = require("./paths");
const { pathHasSymlink } = require("./security");

const DEFAULT_IGNORES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "target",
  "vendor",
  "coverage",
  ".cache",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__",
]);

const HARD_IGNORES = new Set([".git", ".hg", ".svn"]);

const SOURCE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".kt",
  ".kts",
  ".lua",
  ".md",
  ".mjs",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bin",
  ".bmp",
  ".class",
  ".dll",
  ".dmg",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".pdf",
  ".png",
  ".so",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const DEFAULT_OPTIONS = {
  includeIgnored: false,
  maxDepth: 12,
  maxEntries: 6000,
  maxTextFileBytes: 512 * 1024,
  largeFileBytes: 1024 * 1024,
};

function estimateTokens(characterCount) {
  return Math.ceil(characterCount / 4);
}

function shouldIgnore(name) {
  return DEFAULT_IGNORES.has(name);
}

async function readSample(filePath, byteCount = 8192) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(byteCount);
    const { bytesRead } = await handle.read(buffer, 0, byteCount, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function bufferLooksBinary(buffer) {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  if (buffer.includes(0)) {
    return true;
  }
  let suspicious = 0;
  for (const value of buffer) {
    if (value < 7 || (value > 14 && value < 32)) {
      suspicious += 1;
    }
  }
  return suspicious / buffer.length > 0.08;
}

async function inspectFile(absolutePath, relativePath, stat, options) {
  const extension = path.extname(relativePath).toLowerCase();
  const binaryByExtension = BINARY_EXTENSIONS.has(extension);
  const large = stat.size > options.largeFileBytes;
  let binary = binaryByExtension;
  let charEstimate = 0;
  let tokenEstimate = 0;
  let readable = false;

  if (!binary && stat.size <= options.maxTextFileBytes) {
    const sample = await readSample(absolutePath);
    binary = bufferLooksBinary(sample);
    if (!binary) {
      const content = await fs.readFile(absolutePath, "utf8");
      charEstimate = content.length;
      tokenEstimate = estimateTokens(content.length);
      readable = true;
    }
  }

  const source = !binary && (SOURCE_EXTENSIONS.has(extension) || readable);
  return {
    binary,
    charEstimate,
    includedByDefault: source && !large,
    large,
    readable,
    source,
    tokenEstimate,
  };
}

async function scanProject(rootPath, userOptions = {}) {
  const root = normalizeRoot(rootPath);
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const summary = {
    binaryFiles: 0,
    directories: 0,
    files: 0,
    ignored: 0,
    includedByDefault: 0,
    largeFiles: 0,
    sourceFiles: 0,
    tokenEstimate: 0,
    truncated: false,
  };
  let entriesSeen = 0;

  async function walk(absolutePath, relativePath, depth, parentIgnored = false) {
    if (entriesSeen >= options.maxEntries) {
      summary.truncated = true;
      return [];
    }

    const dirents = await fs.readdir(absolutePath, { withFileTypes: true });
    dirents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const nodes = [];
    for (const dirent of dirents) {
      if (entriesSeen >= options.maxEntries) {
        summary.truncated = true;
        break;
      }
      entriesSeen += 1;

      const childRelative = toPosixPath(path.join(relativePath, dirent.name));
      const childAbsolute = path.join(absolutePath, dirent.name);
      const selfIgnored = shouldIgnore(dirent.name);
      const ignored = parentIgnored || selfIgnored;
      const baseNode = {
        id: childRelative,
        ignored,
        name: dirent.name,
        path: childRelative,
        size: 0,
        type: dirent.isDirectory() ? "directory" : "file",
      };

      if (ignored) {
        summary.ignored += 1;
      }

      if (dirent.isDirectory()) {
        summary.directories += 1;
        const node = { ...baseNode, children: [] };
        const canTraverse = (!ignored || (options.includeIgnored && !HARD_IGNORES.has(dirent.name))) && depth < options.maxDepth;
        if (canTraverse) {
          node.children = await walk(childAbsolute, childRelative, depth + 1, ignored);
        }
        nodes.push(node);
        continue;
      }

      if (!dirent.isFile()) {
        nodes.push({ ...baseNode, type: "other", includedByDefault: false, source: false, binary: false });
        continue;
      }

      const stat = await fs.stat(childAbsolute);
      const details = ignored && !options.includeIgnored
        ? { binary: false, charEstimate: 0, includedByDefault: false, large: false, readable: false, source: false, tokenEstimate: 0 }
        : await inspectFile(childAbsolute, childRelative, stat, options);
      details.includedByDefault = details.includedByDefault && !ignored;

      summary.files += 1;
      if (details.binary) summary.binaryFiles += 1;
      if (details.source) summary.sourceFiles += 1;
      if (details.large) summary.largeFiles += 1;
      if (details.includedByDefault) summary.includedByDefault += 1;
      summary.tokenEstimate += details.includedByDefault ? details.tokenEstimate : 0;

      nodes.push({
        ...baseNode,
        ...details,
        size: stat.size,
      });
    }

    return nodes;
  }

  const tree = await walk(root, "", 0);
  return {
    ignoreRules: Array.from(DEFAULT_IGNORES).sort(),
    options,
    root,
    summary,
    tree,
  };
}

async function readSelectedFiles(rootPath, relativePaths, userOptions = {}) {
  const root = normalizeRoot(rootPath);
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const files = [];
  const warnings = [];

  for (const relativePath of relativePaths || []) {
    const absolutePath = resolveInside(root, relativePath);
    if (await pathHasSymlink(root, relativePath)) {
      warnings.push(`${relativePath} uses a symlink and was skipped.`);
      continue;
    }
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      warnings.push(`${relativePath} is not a file and was skipped.`);
      continue;
    }
    if (stat.size > options.maxTextFileBytes) {
      warnings.push(`${relativePath} is larger than ${options.maxTextFileBytes} bytes and was skipped.`);
      continue;
    }
    const sample = await readSample(absolutePath);
    if (bufferLooksBinary(sample)) {
      warnings.push(`${relativePath} appears to be binary and was skipped.`);
      continue;
    }
    const content = await fs.readFile(absolutePath, "utf8");
    files.push({
      content,
      path: toPosixPath(relativePath),
      size: stat.size,
      tokenEstimate: estimateTokens(content.length),
    });
  }

  return {
    files,
    root,
    totalTokens: files.reduce((sum, file) => sum + file.tokenEstimate, 0),
    warnings,
  };
}

module.exports = {
  BINARY_EXTENSIONS,
  DEFAULT_IGNORES,
  HARD_IGNORES,
  SOURCE_EXTENSIONS,
  bufferLooksBinary,
  estimateTokens,
  readSelectedFiles,
  scanProject,
};
