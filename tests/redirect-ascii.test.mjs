import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// redirect("/login?error=กรุณา…") puts raw Thai into the Location header: Node throws ERR_INVALID_CHAR and the
// visitor gets a 500 (seen on /register in production). Query text must go through encodeURIComponent.
const ROOT = new URL("..", import.meta.url).pathname;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("no redirect target contains raw non-ASCII text", () => {
  const offenders = [];
  for (const file of [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "lib"))]) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      // redirect("…"), redirect(`…`), NextResponse.redirect(new URL("…"))
      const match = line.match(/redirect\(\s*(?:new URL\(\s*)?(["`])((?:(?!\1).)*)\1/);
      if (match && /[^\x00-\x7F]/.test(match[2].replace(/\$\{[^}]*\}/g, ""))) {
        offenders.push(`${path.relative(ROOT, file)}:${index + 1}  ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `encode these redirect targets:\n${offenders.join("\n")}`);
});
