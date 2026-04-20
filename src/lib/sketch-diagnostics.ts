export type SketchDiagnostic = { level: "error" | "warning"; message: string };

export function analyzeSketch(code: string): SketchDiagnostic[] {
  const diagnostics: SketchDiagnostic[] = [];
  const braceStack: number[] = [];
  const parenStack: number[] = [];
  let inBlockComment = false;

  const lines = code.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
      const current = line[i];
      const next = line[i + 1];

      if (!inString && !inBlockComment && current === "/" && next === "/") break;
      if (!inString && !inBlockComment && current === "/" && next === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
      if (!inString && inBlockComment && current === "*" && next === "/") {
        inBlockComment = false;
        i++;
        continue;
      }
      if (inBlockComment) continue;

      if (current === "\"" && !escaped) {
        inString = !inString;
      } else if (!inString) {
        if (current === "{") braceStack.push(lineIndex + 1);
        if (current === "}") {
          if (braceStack.length === 0) diagnostics.push({ level: "error", message: `Extra closing brace on line ${lineIndex + 1}.` });
          else braceStack.pop();
        }
        if (current === "(") parenStack.push(lineIndex + 1);
        if (current === ")") {
          if (parenStack.length === 0) diagnostics.push({ level: "error", message: `Extra closing parenthesis on line ${lineIndex + 1}.` });
          else parenStack.pop();
        }
      }

      escaped = current === "\\" && !escaped;
      if (current !== "\\") escaped = false;
    }
  }

  for (const line of braceStack) diagnostics.push({ level: "error", message: `Missing closing brace for block opened near line ${line}.` });
  for (const line of parenStack) diagnostics.push({ level: "error", message: `Missing closing parenthesis for expression opened near line ${line}.` });
  if (inBlockComment) diagnostics.push({ level: "error", message: "A block comment is not closed." });

  if (!/\bvoid\s+setup\s*\(/.test(code)) diagnostics.push({ level: "error", message: "Missing `void setup()`." });
  if (!/\bvoid\s+loop\s*\(/.test(code)) diagnostics.push({ level: "error", message: "Missing `void loop()`." });
  if (!/#include\s+<Keyboard\.h>/.test(code) && !/#include\s+<Mouse\.h>/.test(code)) {
    diagnostics.push({ level: "warning", message: "No `Keyboard.h` or `Mouse.h` include found. HID features may not compile." });
  }

  const typoChecks = [
    { pattern: /\bconsgt\b/g, label: "`consgt`", fix: "`const`" },
    { pattern: /\bcosnt\b/g, label: "`cosnt`", fix: "`const`" },
    { pattern: /\bfnction\b/g, label: "`fnction`", fix: "`function` or a valid Arduino declaration" },
    { pattern: /\bdgitalWrite\b/g, label: "`dgitalWrite`", fix: "`digitalWrite`" },
  ];
  for (const check of typoChecks) {
    if (check.pattern.test(code)) {
      diagnostics.push({ level: "error", message: `Found a likely typo. Replace ${check.label} with ${check.fix}.` });
    }
  }

  const usesLedPin = /\bLED_PIN\b/.test(code);
  const declaresLedPin = /\b(?:const\s+)?(?:int|byte|bool|long|unsigned\s+int)\s+LED_PIN\b/.test(code);
  if (usesLedPin && !declaresLedPin) {
    diagnostics.push({
      level: "error",
      message: "`LED_PIN` is used but never declared. This sketch generator uses `LED_ON_PIN` and `LED_OFF_PIN` instead.",
    });
  }

  return diagnostics;
}
