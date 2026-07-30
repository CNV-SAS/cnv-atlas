#!/usr/bin/env node
// Escaner de secretos para el borde del arbol (2ª vez que una entrega de Gildardo metio una clave;
// una nota en el backlog no basta, ver BACKLOG "Seguridad"). Sirve a DOS capas: hook de pre-commit
// (escanea lo staged) y CI (escanea archivos que se le pasen). Node puro, sin dependencias (jq no
// esta instalado en las maquinas del proyecto).
//
// REGLA DE DISENO: BLOQUEAR solo lo que es inequivocamente un secreto VIVO; todo lo dudoso, AVISAR.
// El costo de un falso negativo es un scrub; el de un falso positivo recurrente es que alguien apague
// el hook y perdamos la proteccion entera. Por eso sb_publishable_ (publica por diseno) y los JWT
// (cualquier JSON base64 empieza con eyJ) AVISAN, no bloquean.
//
// Uso:
//   node scripts/check-secrets.mjs            -> escanea las lineas AGREGADAS en el stage (modo hook)
//   node scripts/check-secrets.mjs <archivo…> -> escanea esos archivos completos (modo CI/manual)
// Salida: exit 1 si hay al menos un hallazgo de BLOQUEO; 0 si solo hay avisos o nada.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// Secreto vivo inequivoco -> BLOQUEA el commit.
const BLOCK = [
  { name: "Groq API key (gsk_)", re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI/Anthropic key (sk-)", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Google/Gemini key (AIza)", re: /AIza[A-Za-z0-9_-]{30,}/ },
  { name: "Supabase SECRET key (sb_secret_)", re: /sb_secret_[A-Za-z0-9_]{20,}/ },
  { name: "GitHub token (ghp_/gho_/ghu_/ghs_/ghr_)", re: /gh[poust]r?_[A-Za-z0-9]{30,}/ },
  { name: "Slack token (xox…)", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "AWS access key (AKIA)", re: /AKIA[0-9A-Z]{16}/ },
  { name: "PEM private key", re: /-----BEGIN[A-Z ]*PRIVATE KEY-----/ },
];

// Posible secreto -> AVISA (no bloquea). Requiere ojo humano.
const WARN = [
  // Publishable de Supabase: publica por diseno, suele estar en .env.example/docs. Se avisa por si
  // va con la URL de un proyecto real con RLS floja, pero NO bloquea.
  { name: "Supabase publishable key (publica por diseno; revisar el proyecto)", re: /sb_publishable_[A-Za-z0-9_]{20,}/ },
  // JWT REAL: header y payload son JSON base64url (ambos empiezan en eyJ) + firma larga. Acotado
  // asi para no cazar cualquier JSON base64. Aun asi solo AVISA.
  { name: "posible JWT (header.payload.firma)", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/ },
  // Palabra clave + un valor real de >=16 chars. Avisa (puede ser config legitima).
  { name: "credencial por palabra clave (key/secret/token/password con valor)", re: /(api[_-]?key|service_role|secret|password|token)["'\s]*[:=]["'\s]*['"]?[A-Za-z0-9_\-/+.]{16,}/i },
];

// Falsos positivos obvios: placeholders y el atributo de input HTML. Si la linea los contiene, se
// ignora (para bloqueo y para aviso).
const ALLOW = /REDACTED|TU_[A-Z]|YOUR_|xxxx|<[a-z_]+>|example|EXAMPLE|placeholder|dummy|changeme|type\s*[:=]\s*["']password["']/;

function stagedAddedLines() {
  // Lineas AGREGADAS en el stage (empiezan con '+', excluye la cabecera '+++'). Solo lo nuevo:
  // no re-alerta sobre contenido ya redactado que sigue en el archivo.
  let diff;
  try {
    diff = execSync("git diff --cached --no-color --unified=0", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return []; // sin repo o sin stage
  }
  const out = [];
  let file = "(desconocido)";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++")) out.push({ file, text: line.slice(1) });
  }
  return out;
}

function fileLines(paths) {
  const out = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const content = readFileSync(p, "utf8");
    content.split("\n").forEach((text, i) => out.push({ file: `${p}:${i + 1}`, text }));
  }
  return out;
}

function scan(lines) {
  const blocks = [];
  const warns = [];
  for (const { file, text } of lines) {
    if (ALLOW.test(text)) continue;
    for (const p of BLOCK) if (p.re.test(text)) blocks.push({ file, name: p.name, text });
    for (const p of WARN) if (p.re.test(text)) warns.push({ file, name: p.name, text });
  }
  return { blocks, warns };
}

// Recorta el contexto para no imprimir el secreto entero.
const preview = (t) => (t.trim().length > 100 ? t.trim().slice(0, 100) + "…" : t.trim());

const args = process.argv.slice(2);
const lines = args.length > 0 ? fileLines(args) : stagedAddedLines();
const { blocks, warns } = scan(lines);

for (const w of warns) {
  console.warn(`⚠️  AVISO [${w.name}] en ${w.file}\n    ${preview(w.text)}`);
}
for (const b of blocks) {
  console.error(`⛔ SECRETO [${b.name}] en ${b.file}\n    ${preview(b.text)}`);
}

if (blocks.length > 0) {
  console.error(`\n${blocks.length} secreto(s) inequivoco(s) detectado(s). Commit ABORTADO.`);
  console.error("Redacta el secreto (placeholder) antes de commitear. Si es un falso positivo real, revisa scripts/check-secrets.mjs.");
  process.exit(1);
}
if (warns.length > 0) {
  console.warn(`\n${warns.length} aviso(s): revisa que no sean secretos vivos. El commit NO se bloquea por avisos.`);
}
process.exit(0);
