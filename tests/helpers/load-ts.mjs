import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);

// Load real application functions with explicit I/O substitutes, never a live database.
export function loadTs(file, dependencies = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const source = ts.transpileModule(fs.readFileSync(new URL(relative, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const exports = {};
    cache.set(relative, exports);
    vm.runInNewContext(source, {
      exports, Buffer, File, FormData, URL, Date, console, ...globals,
      require(id) {
        if (Object.hasOwn(dependencies, id)) return dependencies[id];
        if (id === "server-only") return {};
        if (id === "@/lib/mysql") throw new Error("A database mock is required");
        if (id.startsWith("@/")) {
          const path = id.slice(2);
          return load(fs.existsSync(new URL(`${path}.ts`, root)) ? `${path}.ts` : `${path}.tsx`);
        }
        if (id.startsWith("node:") || ["react", "react/jsx-runtime", "react-dom", "xlsx"].includes(id)) return require(id);
        throw new Error(`Unexpected dependency: ${id}`);
      },
    }, { filename: relative });
    return exports;
  }
  return load(file);
}
