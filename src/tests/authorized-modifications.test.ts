import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AUTHORIZED_MODIFICATIONS,
  applyAuthorized,
  buildAuthorizedFile,
  GENERATED_HEADER,
} from "@/clinical-engine/frozen/authorized-modifications.js";
// El original (referencia intacta) y el generado (el que corre). Se importan los dos para PROBAR la
// divergencia: mismo input, el original conserva el examen retirado, el generado no.
import { motorProtocolo as originalMotor } from "@/clinical-engine/frozen/atlas-protocolo.js";
import { motorProtocolo as runningMotor } from "@/clinical-engine/frozen/atlas-protocolo.authorized.js";

const FROZEN = "src/clinical-engine/frozen";

// Capa 1 (fidelidad + no-adulteracion): el generado es EXACTAMENTE el original mas el manifiesto.
describe("mecanismo de modificaciones autorizadas: el generado == original + manifiesto (byte-exacto)", () => {
  it("atlas-protocolo.authorized.js coincide byte a byte con buildAuthorizedFile(original, manifiesto)", () => {
    const original = readFileSync(`${FROZEN}/atlas-protocolo.js`, "utf8");
    const generated = readFileSync(`${FROZEN}/atlas-protocolo.authorized.js`, "utf8");
    const mods = AUTHORIZED_MODIFICATIONS.filter((m) => m.targetFile === "atlas-protocolo.js");
    expect(generated).toBe(buildAuthorizedFile(original, mods, GENERATED_HEADER));
  });

  it("engine.dfi.authorized.js coincide byte a byte con buildAuthorizedFile(original, manifiesto)", () => {
    // CA-3: la guarda de calcLE8. El original queda byte-identico (su DIFF-vs-fuente lo ancla en
    // frozen-dfi-calcle8-diff); aqui se prueba que el que CORRE es exactamente original + manifiesto.
    const original = readFileSync(`${FROZEN}/engine.dfi.js`, "utf8");
    const generated = readFileSync(`${FROZEN}/engine.dfi.authorized.js`, "utf8");
    const mods = AUTHORIZED_MODIFICATIONS.filter((m) => m.targetFile === "engine.dfi.js");
    expect(generated).toBe(buildAuthorizedFile(original, mods, GENERATED_HEADER));
  });

  it("apply falla en voz alta si un oldSlice no aparece", () => {
    expect(() =>
      applyAuthorized("texto cualquiera", [{ caId: "CA-X", targetFile: "x", oldSlice: "NO_EXISTE", newSlice: "" }]),
    ).toThrow(/no aparece/);
  });

  it("apply falla en voz alta si un oldSlice aparece mas de una vez (ambiguo)", () => {
    expect(() =>
      applyAuthorized("AA AA", [{ caId: "CA-X", targetFile: "x", oldSlice: "AA", newSlice: "" }]),
    ).toThrow(/mas de una vez/);
  });

  it("apply prohibe modificaciones solapadas", () => {
    expect(() =>
      applyAuthorized("abcdef", [
        { caId: "CA-1", targetFile: "x", oldSlice: "abcd", newSlice: "" },
        { caId: "CA-2", targetFile: "x", oldSlice: "cdef", newSlice: "" },
      ]),
    ).toThrow(/solapad/);
  });
});

// Capa 2 (comportamiento, con la divergencia marcada por caId): CA-1 (D-012) retira el examen de
// telomeros, y SOLO ese (retiro quirurgico: el suplemento CoQ10, tambien gateado por IAE>5, se conserva).
describe("golden del generado: CA-1 retira el examen de telomeros (D-012)", () => {
  const bis = { sexo: "M", talla: 170, peso: 85, imc: 29.4, iae: 8, FMI: 7, FFMI: 19, ASMI: 8 };
  const enc = {};
  const motor = { fenotipo: { id: "F5", nombre: "—" }, nombreFR: "—", sector: "S5" };

  const hasTelomeros = (e: { nombre: string } | null) => !!e && /Telómeros/.test(e.nombre);

  it("VALOR ANTERIOR (CA-1): el ORIGINAL con IAE>5 SI incluye el examen de telomeros", () => {
    expect(originalMotor(bis, enc, motor).examenes.some(hasTelomeros)).toBe(true);
  });

  it("el GENERADO (el que corre) con el mismo IAE>5 NO incluye el examen de telomeros", () => {
    expect(runningMotor(bis, enc, motor).examenes.some(hasTelomeros)).toBe(false);
  });

  it("retiro QUIRURGICO: el suplemento CoQ10 (tambien IAE>5) se conserva en ambos", () => {
    const hasCoQ = (s: { nombre: string } | null) => !!s && /Coenzima Q10/.test(s.nombre);
    expect(originalMotor(bis, enc, motor).suplementacion.some(hasCoQ)).toBe(true);
    expect(runningMotor(bis, enc, motor).suplementacion.some(hasCoQ)).toBe(true);
  });
});
