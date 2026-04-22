export const SKETCH_WORKSPACE_STORAGE_KEY = "abm_sketch_workspace";
export const SKETCH_WORKSPACE_UPDATED_EVENT = "abm-sketch-workspace-updated";

export type SketchWorkspace = {
  originalCode: string;
  editedCode: string;
  aiCode: string | null;
  updatedAt: number;
};

export type SketchLineSource = "button" | "ai" | "user" | "generated";

function normalizeLine(line: string) {
  return line.replace(/\r/g, "");
}

function buildLineCounts(lines: string[]) {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const normalized = normalizeLine(line);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

function diffAddedLines(baseCode: string, nextCode: string) {
  const baseCounts = buildLineCounts(baseCode.split("\n"));
  const added: string[] = [];
  for (const rawLine of nextCode.split("\n")) {
    const line = normalizeLine(rawLine);
    const remaining = baseCounts.get(line) ?? 0;
    if (remaining > 0) {
      baseCounts.set(line, remaining - 1);
    } else {
      added.push(line);
    }
  }
  return added;
}

function takeFromCounts(counts: Map<string, number>, line: string) {
  const remaining = counts.get(line) ?? 0;
  if (remaining <= 0) return false;
  counts.set(line, remaining - 1);
  return true;
}

export function loadSketchWorkspace(): SketchWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SKETCH_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SketchWorkspace>;
    if (typeof parsed.originalCode !== "string" || typeof parsed.editedCode !== "string") return null;
    return {
      originalCode: parsed.originalCode,
      editedCode: parsed.editedCode,
      aiCode: typeof parsed.aiCode === "string" ? parsed.aiCode : null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveSketchWorkspace(workspace: SketchWorkspace) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SKETCH_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  window.dispatchEvent(new CustomEvent(SKETCH_WORKSPACE_UPDATED_EVENT, { detail: workspace }));
}

export function extractMarkedSection(code: string, section: string) {
  const pattern = new RegExp(`// <ABM:${section}:START>\\n?([\\s\\S]*?)\\n?// <ABM:${section}:END>`, "m");
  const match = code.match(pattern);
  return match?.[1]?.trim() ?? "";
}

export function classifySketchLines(workspace: SketchWorkspace) {
  const aiAddedCounts = buildLineCounts(
    workspace.aiCode ? diffAddedLines(workspace.originalCode, workspace.aiCode) : [],
  );
  const userBase = workspace.aiCode ?? workspace.originalCode;
  const userAddedCounts = buildLineCounts(diffAddedLines(userBase, workspace.editedCode));
  const buttonSectionLines = new Set(
    extractMarkedSection(workspace.originalCode, "BUTTONS")
      .split("\n")
      .map((line) => normalizeLine(line).trim())
      .filter(Boolean),
  );

  return workspace.editedCode.split("\n").map((rawLine, index) => {
    const line = normalizeLine(rawLine);
    let source: SketchLineSource = "generated";
    if (takeFromCounts(userAddedCounts, line)) {
      source = "user";
    } else if (takeFromCounts(aiAddedCounts, line)) {
      source = "ai";
    } else if (buttonSectionLines.has(line.trim())) {
      source = "button";
    }
    return { index, line, source };
  });
}

export function getCustomSketchFromWorkspace(workspace: SketchWorkspace | null) {
  if (!workspace) return null;
  return workspace.editedCode === workspace.originalCode ? null : workspace.editedCode;
}

export function createSketchWorkspace(originalCode: string, editedCode?: string, aiCode?: string | null): SketchWorkspace {
  return {
    originalCode,
    editedCode: editedCode ?? originalCode,
    aiCode: aiCode ?? null,
    updatedAt: Date.now(),
  };
}
