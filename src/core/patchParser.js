"use strict";

const { stripGitPrefix } = require("./paths");

function unquoteGitPath(token) {
  const value = String(token || "").trim();
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }

  const inner = value.slice(1, -1);
  return inner.replace(/\\([\\"]|n|r|t|[0-7]{1,3})/g, (match, escaped) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    if (/^[0-7]+$/.test(escaped)) {
      return String.fromCharCode(Number.parseInt(escaped, 8));
    }
    return escaped;
  });
}

function splitGitPathTokens(value) {
  const tokens = [];
  let index = 0;
  const text = String(value || "");

  while (index < text.length) {
    while (text[index] === " ") index += 1;
    if (index >= text.length) break;

    if (text[index] === '"') {
      let token = '"';
      index += 1;
      let escaped = false;
      while (index < text.length) {
        const char = text[index];
        token += char;
        index += 1;
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          break;
        }
      }
      tokens.push(unquoteGitPath(token));
      continue;
    }

    let token = "";
    while (index < text.length && text[index] !== " ") {
      token += text[index];
      index += 1;
    }
    tokens.push(token);
  }

  return tokens;
}

function parseHeaderPath(line, marker) {
  const raw = line.slice(marker.length).trim();
  const withoutTimestamp = raw.split(/\t/)[0].trim();
  return unquoteGitPath(withoutTimestamp);
}

function parseDiffGitLine(line) {
  const tokens = splitGitPathTokens(line.replace(/^diff --git\s+/, ""));
  if (tokens.length !== 2) {
    return null;
  }
  return {
    oldPath: stripGitPrefix(tokens[0]),
    newPath: stripGitPrefix(tokens[1]),
  };
}

function parseHunkHeader(line) {
  const match = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    newCount: match[4] ? Number(match[4]) : 1,
    newStart: Number(match[3]),
    oldCount: match[2] ? Number(match[2]) : 1,
    oldStart: Number(match[1]),
    section: match[5] ? match[5].trim() : "",
  };
}

function parseFileMode(line) {
  const match = /(?:^|\s)(\d{6})(?:\s|$)/.exec(line || "");
  return match ? match[1] : "";
}

function recordFileMode(file, line, field) {
  const mode = parseFileMode(line);
  if (!mode) {
    return;
  }
  file[field] = mode;
  if (mode === "120000") {
    file.isSymlink = true;
  }
}

function createFileRecord(paths, index) {
  return {
    additions: 0,
    binary: false,
    deletions: 0,
    headers: [],
    hunks: [],
    id: `file-${index}`,
    indexMode: "",
    isDeleted: false,
    isNew: false,
    isSymlink: false,
    newHeader: paths.newPath ? `b/${paths.newPath}` : "",
    newMode: "",
    newPath: paths.newPath || "",
    oldHeader: paths.oldPath ? `a/${paths.oldPath}` : "",
    oldMode: "",
    oldPath: paths.oldPath || "",
  };
}

function ensureFileFromHeaders(files, oldHeader, newHeader) {
  const oldPath = oldHeader === "/dev/null" ? "/dev/null" : stripGitPrefix(oldHeader);
  const newPath = newHeader === "/dev/null" ? "/dev/null" : stripGitPrefix(newHeader);
  const file = createFileRecord(
    {
      newPath: newPath === "/dev/null" ? oldPath : newPath,
      oldPath: oldPath === "/dev/null" ? newPath : oldPath,
    },
    files.length,
  );
  file.oldHeader = oldHeader;
  file.newHeader = newHeader;
  file.isNew = oldHeader === "/dev/null";
  file.isDeleted = newHeader === "/dev/null";
  files.push(file);
  return file;
}

function parseUnifiedDiff(text) {
  const normalizedText = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedText.split("\n");
  const files = [];
  const errors = [];
  let currentFile = null;
  let currentHunk = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (line.startsWith("diff --git ")) {
      const paths = parseDiffGitLine(line);
      if (!paths) {
        errors.push({ line: lineNumber, message: "Invalid diff --git header." });
        currentFile = null;
        currentHunk = null;
        continue;
      }
      currentFile = createFileRecord(paths, files.length);
      currentFile.headers.push(line);
      files.push(currentFile);
      currentHunk = null;
      continue;
    }

    if (!currentFile && line.startsWith("--- ") && lines[index + 1] && lines[index + 1].startsWith("+++ ")) {
      currentFile = ensureFileFromHeaders(files, parseHeaderPath(line, "--- "), parseHeaderPath(lines[index + 1], "+++ "));
      currentFile.headers.push(`diff --git a/${currentFile.oldPath} b/${currentFile.newPath}`);
      currentFile.headers.push(line);
      index += 1;
      currentFile.headers.push(lines[index]);
      currentHunk = null;
      continue;
    }

    if (!currentFile) {
      if (line.trim()) {
        errors.push({ line: lineNumber, message: "Text before the first diff header is not allowed." });
      }
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentFile.isNew = true;
      recordFileMode(currentFile, line, "newMode");
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      currentFile.isDeleted = true;
      recordFileMode(currentFile, line, "oldMode");
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("old mode ")) {
      recordFileMode(currentFile, line, "oldMode");
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("new mode ")) {
      recordFileMode(currentFile, line, "newMode");
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("index ")) {
      recordFileMode(currentFile, line, "indexMode");
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      currentFile.binary = true;
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("--- ")) {
      currentFile.oldHeader = parseHeaderPath(line, "--- ");
      if (currentFile.oldHeader === "/dev/null") {
        currentFile.isNew = true;
      } else {
        currentFile.oldPath = stripGitPrefix(currentFile.oldHeader);
      }
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("+++ ")) {
      currentFile.newHeader = parseHeaderPath(line, "+++ ");
      if (currentFile.newHeader === "/dev/null") {
        currentFile.isDeleted = true;
      } else {
        currentFile.newPath = stripGitPrefix(currentFile.newHeader);
      }
      currentFile.headers.push(line);
      continue;
    }

    if (line.startsWith("@@ ")) {
      const parsed = parseHunkHeader(line);
      if (!parsed) {
        errors.push({ line: lineNumber, message: "Invalid hunk header." });
        currentHunk = null;
        continue;
      }
      currentHunk = {
        ...parsed,
        header: line,
        id: `${currentFile.id}-hunk-${currentFile.hunks.length}`,
        lineNumber,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk && (line.startsWith(" ") || line.startsWith("+") || line.startsWith("-"))) {
      const prefix = line[0];
      const type = prefix === "+" ? "addition" : prefix === "-" ? "deletion" : "context";
      const record = {
        content: line.slice(1),
        id: `${currentHunk.id}-line-${currentHunk.lines.length}`,
        lineNumber,
        raw: line,
        type,
      };
      if (type === "addition") currentFile.additions += 1;
      if (type === "deletion") currentFile.deletions += 1;
      currentHunk.lines.push(record);
      continue;
    }

    if (currentHunk && line.startsWith("\\ No newline at end of file")) {
      currentHunk.lines.push({
        content: line,
        id: `${currentHunk.id}-line-${currentHunk.lines.length}`,
        lineNumber,
        raw: line,
        type: "meta",
      });
      continue;
    }

    if (line.trim()) {
      currentFile.headers.push(line);
    }
  }

  if (files.length === 0) {
    errors.push({ line: 1, message: "No unified diff files were found." });
  }

  for (const file of files) {
    if (!file.binary && file.hunks.length === 0) {
      errors.push({ line: 1, message: `No hunks found for ${file.newPath || file.oldPath}.` });
    }
    for (const hunk of file.hunks) {
      let oldLines = 0;
      let newLines = 0;
      for (const line of hunk.lines) {
        if (line.type === "context") {
          oldLines += 1;
          newLines += 1;
        } else if (line.type === "deletion") {
          oldLines += 1;
        } else if (line.type === "addition") {
          newLines += 1;
        }
      }
      if (oldLines !== hunk.oldCount || newLines !== hunk.newCount) {
        errors.push({
          line: hunk.lineNumber,
          message: `Hunk line counts do not match header for ${file.newPath || file.oldPath}.`,
        });
      }
    }
  }

  return {
    errors,
    files,
    isValidStructure: errors.length === 0,
    stats: files.reduce(
      (stats, file) => {
        stats.additions += file.additions;
        stats.deletions += file.deletions;
        stats.files += 1;
        stats.hunks += file.hunks.length;
        return stats;
      },
      { additions: 0, deletions: 0, files: 0, hunks: 0 },
    ),
  };
}

module.exports = {
  parseFileMode,
  parseHunkHeader,
  parseUnifiedDiff,
  splitGitPathTokens,
  unquoteGitPath,
};
