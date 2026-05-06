"use strict";

function isChangedLine(line) {
  return line.type === "addition" || line.type === "deletion";
}

function createDefaultApprovals(parsedPatch) {
  const approvals = { files: {}, hunks: {}, lines: {} };
  for (const file of parsedPatch.files || []) {
    approvals.files[file.id] = true;
    for (const hunk of file.hunks) {
      approvals.hunks[hunk.id] = true;
      for (const line of hunk.lines) {
        if (isChangedLine(line)) {
          approvals.lines[line.id] = true;
        }
      }
    }
  }
  return approvals;
}

function approvalValue(map, id, fallback = true) {
  if (!map || !Object.prototype.hasOwnProperty.call(map, id)) {
    return fallback;
  }
  return Boolean(map[id]);
}

function countHunkLines(lines) {
  let oldCount = 0;
  let newCount = 0;
  for (const line of lines) {
    if (line.type === "context") {
      oldCount += 1;
      newCount += 1;
    } else if (line.type === "addition") {
      newCount += 1;
    } else if (line.type === "deletion") {
      oldCount += 1;
    }
  }
  return { oldCount, newCount };
}

function formatRange(start, count) {
  return `${start},${count}`;
}

function fileHeaderPath(kind, file) {
  if (kind === "old") {
    return file.isNew ? "/dev/null" : `a/${file.oldPath || file.newPath}`;
  }
  return file.isDeleted ? "/dev/null" : `b/${file.newPath || file.oldPath}`;
}

function normalizeLineForPatch(line, accepted) {
  if (line.type === "context") {
    return { ...line, raw: ` ${line.content}` };
  }
  if (line.type === "addition") {
    return accepted ? { ...line, raw: `+${line.content}` } : null;
  }
  if (line.type === "deletion") {
    return accepted ? { ...line, raw: `-${line.content}` } : { ...line, type: "context", raw: ` ${line.content}` };
  }
  return null;
}

function buildFilteredPatch(parsedPatch, approvals) {
  const effectiveApprovals = approvals || createDefaultApprovals(parsedPatch);
  const output = [];
  const omitted = [];

  for (const file of parsedPatch.files || []) {
    const fileAccepted = approvalValue(effectiveApprovals.files, file.id, true);
    if (!fileAccepted) {
      omitted.push(file.newPath || file.oldPath);
      continue;
    }

    const hunkOutputs = [];
    for (const hunk of file.hunks) {
      const hunkAccepted = file.isDeleted ? true : approvalValue(effectiveApprovals.hunks, hunk.id, true);
      if (!hunkAccepted) {
        continue;
      }

      let changedLineCount = 0;
      const filteredLines = [];
      for (const line of hunk.lines) {
        if (line.type === "meta") {
          continue;
        }
        const lineAccepted = file.isDeleted ? true : approvalValue(effectiveApprovals.lines, line.id, true);
        const normalized = normalizeLineForPatch(line, lineAccepted);
        if (!normalized) {
          continue;
        }
        if (isChangedLine(normalized)) {
          changedLineCount += 1;
        }
        filteredLines.push(normalized);
      }

      if (changedLineCount === 0) {
        continue;
      }

      const counts = countHunkLines(filteredLines);
      hunkOutputs.push(`@@ -${formatRange(hunk.oldStart, counts.oldCount)} +${formatRange(hunk.newStart, counts.newCount)} @@${hunk.section ? ` ${hunk.section}` : ""}`);
      for (const line of filteredLines) {
        hunkOutputs.push(line.raw);
      }
    }

    if (hunkOutputs.length === 0) {
      omitted.push(file.newPath || file.oldPath);
      continue;
    }

    output.push(`diff --git a/${file.oldPath || file.newPath} b/${file.newPath || file.oldPath}`);
    if (file.isNew) {
      output.push("new file mode 100644");
    }
    if (file.isDeleted) {
      output.push("deleted file mode 100644");
    }
    output.push(`--- ${fileHeaderPath("old", file)}`);
    output.push(`+++ ${fileHeaderPath("new", file)}`);
    output.push(...hunkOutputs);
  }

  return {
    omitted,
    patch: output.length ? `${output.join("\n")}\n` : "",
  };
}

module.exports = {
  buildFilteredPatch,
  createDefaultApprovals,
};
