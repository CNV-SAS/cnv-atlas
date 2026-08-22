// Barrido de fronteras RSC (React Server Components), LAS DOS DIRECCIONES. tsc no ve ninguna; ambas rompen
// en produccion, verdes en local. Se corre en CI y tras cada feature con componentes cliente.
//
//   Direccion A (cliente -> server-only): un archivo "use client" importa un VALOR de un modulo
//     `import "server-only"`. El bundler de produccion puede volver el reader una referencia-cliente y dejar
//     sus funciones `undefined` en runtime. (El barrido historico de CLAUDE.md.)
//
//   Direccion B (servidor -> valor de cliente): un archivo de SERVIDOR (sin "use client") importa un VALOR
//     NO-componente (nombre en minuscula: funcion/constante, no un componente PascalCase) de un modulo
//     "use client", y lo invoca. React lanza "Attempted to call X() from the server but X is on the client"
//     y tumba la pagina. Punto ciego que tumbo /evaluaciones el 2026-08-21 (prescriptionSignature).
//
// Los `import type` (y specifiers `type`) se ignoran: tsc los borra, no cruzan la frontera.
// Importar un COMPONENTE (PascalCase) de un modulo cliente desde el servidor es NORMAL (se renderiza como
// JSX); por eso la direccion B solo marca nombres en minuscula.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const SRC = "src";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) files.push(p);
  }
})(SRC);

const cache = new Map();
function read(p) {
  if (!cache.has(p)) cache.set(p, readFileSync(p, "utf8"));
  return cache.get(p);
}
const isUseClient = (src) => /^\s*(['"])use client\1/m.test(src);
const isServerOnly = (src) => /^\s*import\s+(['"])server-only\1/m.test(src);

// Resuelve un especificador (@/... o relativo) a un archivo real. null si no resuelve (paquete externo, etc.)
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

// Extrae los imports de un archivo: { spec, names: [{name, typeOnly}] }. Cubre named, default y namespace.
function parseImports(src) {
  const out = [];
  const re = /import\s+(type\s+)?([^;'"]*?)\s+from\s+(['"])([^'"]+)\3/g;
  let m;
  while ((m = re.exec(src))) {
    const importTypeKw = Boolean(m[1]); // `import type { ... }`
    const clause = m[2].trim();
    const spec = m[4];
    const names = [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const raw of braces[1].split(",")) {
        const part = raw.trim();
        if (!part) continue;
        const typeOnly = importTypeKw || /^type\s+/.test(part);
        const local = part.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (local) names.push({ name: local, typeOnly });
      }
    }
    const before = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
    for (const tok of before.split(/\s+/)) {
      if (!tok || tok === "*" || tok === "as") continue;
      const nsMatch = clause.match(/\*\s+as\s+(\w+)/);
      if (nsMatch && tok === nsMatch[1]) {
        names.push({ name: tok, typeOnly: importTypeKw, namespace: true });
      } else if (/^\w+$/.test(tok)) {
        names.push({ name: tok, typeOnly: importTypeKw }); // default import
      }
    }
    out.push({ spec, names });
  }
  return out;
}

const hazardsA = []; // cliente -> server-only
const hazardsB = []; // servidor -> valor de cliente

for (const f of files) {
  const src = read(f);
  const client = isUseClient(src);
  for (const imp of parseImports(src)) {
    const target = resolveImport(f, imp.spec);
    if (!target) continue;
    const tsrc = read(target);
    const valueNames = imp.names.filter((n) => !n.typeOnly);
    if (valueNames.length === 0) continue; // solo tipos: no cruzan la frontera

    // Direccion A: archivo cliente importa un valor de un modulo server-only.
    if (client && isServerOnly(tsrc)) {
      hazardsA.push({ from: f, spec: imp.spec, names: valueNames.map((n) => n.name) });
    }
    // Direccion B: archivo SERVIDOR importa un valor NO-componente de un modulo cliente.
    if (!client && isUseClient(tsrc)) {
      const nonComponents = valueNames.filter((n) => /^[a-z]/.test(n.name)); // minuscula = funcion/const
      if (nonComponents.length) {
        hazardsB.push({ from: f, spec: imp.spec, names: nonComponents.map((n) => n.name) });
      }
    }
  }
}

const fmt = (h) => `  ${h.from}\n    importa ${h.names.join(", ")}  de  ${h.spec}`;
let bad = false;
if (hazardsA.length) {
  bad = true;
  console.error("\nARISTA cliente -> server-only (el bundler puede volverlo referencia-cliente):");
  for (const h of hazardsA) console.error(fmt(h));
}
if (hazardsB.length) {
  bad = true;
  console.error("\nARISTA servidor -> valor de cliente (invocar una funcion cliente desde el servidor tumba la pagina):");
  for (const h of hazardsB) console.error(fmt(h));
  console.error("\n  Fix: mueve el valor a un modulo NEUTRO (sin 'use client'), que ambos lados importan.");
}
if (bad) {
  console.error("\nFronteras RSC: HAY ARISTAS. Ver arriba.\n");
  process.exit(1);
}
console.log("Fronteras RSC: limpio (ninguna arista, las dos direcciones).");
