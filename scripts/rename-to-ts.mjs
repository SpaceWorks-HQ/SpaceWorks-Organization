/**
 * One-shot helper: rename frontend/backend JS/JSX sources to TS/TSX.
 * Skips node_modules. Does not rewrite imports (Vite/Node resolve extensionless).
 */
import fs from "node:fs";
import path from "node:path";

const roots = [
  path.resolve("frontend/src"),
  path.resolve("backend/src"),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

let renamed = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const ext = path.extname(file);
    let next = null;
    if (ext === ".jsx") next = file.slice(0, -4) + ".tsx";
    else if (ext === ".js") next = file.slice(0, -3) + ".ts";
    if (!next) continue;
    if (fs.existsSync(next)) {
      console.warn("skip (exists):", next);
      continue;
    }
    fs.renameSync(file, next);
    renamed += 1;
    console.log(path.relative(process.cwd(), file), "→", path.relative(process.cwd(), next));
  }
}
console.log(`Renamed ${renamed} files`);
