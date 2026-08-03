import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROTOCOL_ARTIFACTS_SHA, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine/version";

// Candado de version del conjunto de protocolo (T2 A3). Los archivos que producen el
// protocol_suggested tienen su SHA-256 registrado en version.ts. Si alguno cambia, este test FALLA
// y NOMBRA cual, para que la decision de subir PROTOCOL_ENGINE_VERSION se tome con informacion, no
// por olvido (una constante de version que nadie recuerda subir da falsa confianza). Complementa a
// los DIFF byte a byte: esos anclan los slices verbatim contra ATLAS.html; este cubre el archivo
// COMPLETO de cada artefacto (incluidas nuestras transcripciones), forzando reconsiderar la version
// ante CUALQUIER cambio.

const FILES: Record<string, string> = {
  // El que CORRE y se sella es el generado (original + manifiesto de modificaciones autorizadas). El
  // original queda como referencia guardada por su DIFF-vs-fuente, no por este candado.
  "frozen/atlas-protocolo.authorized.js": "src/clinical-engine/frozen/atlas-protocolo.authorized.js",
  "protocolo-calorico.ts": "src/clinical-engine/protocolo-calorico.ts",
  "protocolo-fenotipo.ts": "src/clinical-engine/protocolo-fenotipo.ts",
  "fenotipos-mccb.ts": "src/clinical-engine/fenotipos-mccb.ts",
};

describe("candado de version del protocolo (PROTOCOL_ENGINE_VERSION)", () => {
  it("las claves registradas corresponden 1:1 con los archivos (sin hashes huerfanos)", () => {
    expect(Object.keys(PROTOCOL_ARTIFACTS_SHA).sort()).toEqual(Object.keys(FILES).sort());
  });

  it("ningun artefacto del protocolo cambio sin reconsiderar la version", () => {
    const changed: string[] = [];
    for (const [key, path] of Object.entries(FILES)) {
      const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
      if (actual !== PROTOCOL_ARTIFACTS_SHA[key]) {
        changed.push(`${key}\n    registrado: ${PROTOCOL_ARTIFACTS_SHA[key]}\n    actual:     ${actual}`);
      }
    }
    if (changed.length) {
      const cientifico = changed.some((c) => c.startsWith("frozen/"));
      throw new Error(
        `Cambiaron ${changed.length} artefacto(s) del protocolo (version actual ${PROTOCOL_ENGINE_VERSION}):\n  ${changed.join("\n  ")}\n\n` +
          (cientifico
            ? "  OJO: cambio un archivo frozen/ (ciencia de Gildardo). El DIFF byte a byte deberia haber fallado tambien; si no fallo, hay algo peor. SUBE la version.\n"
            : "") +
          "  POR DEFECTO: sube PROTOCOL_ENGINE_VERSION y actualiza el SHA registrado en version.ts.\n" +
          "  Actualizar SOLO el SHA (sin subir la version) solo es aceptable bajo la EXENCION DE\n" +
          "  ARRANQUE documentada en version.ts (valida mientras NINGUN protocol_suggested se haya\n" +
          "  sellado con esta version). Tras el primer sellado, cualquier cambio exige subir la version.",
      );
    }
  });
});
