import { describe, expect, it } from "vitest";

import {
  type CandidateRow,
  type IdentityResolutionDeps,
  resolveIdentity,
} from "@/modules/patients/services/identity-resolution";
import { nameSimilarity, normalizeName } from "@/modules/patients/services/name-matching";
import type { IdentityInput } from "@/modules/patients/types";

const baseInput: IdentityInput = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  documentType: "CC",
  documentNumber: "1234",
  firstName: "Maria",
  lastName: "Gomez",
  birthDate: "1990-05-10",
};

// deps que devuelven valores fijos, para resolver sin tocar la BD.
function deps(
  exact: { id: string } | null,
  candidates: CandidateRow[],
): IdentityResolutionDeps {
  return {
    findPatientByDocument: async () => exact,
    findDuplicateCandidates: async () => candidates,
  };
}

function candidate(over: Partial<CandidateRow>): CandidateRow {
  return {
    patientId: "p-1",
    firstName: "Otra",
    lastName: "Persona",
    birthDate: null,
    documentType: "CC",
    documentNumber: "9999",
    ...over,
  };
}

describe("name-matching", () => {
  it("normaliza acentos, mayusculas y signos", () => {
    expect(normalizeName("José  GÓMEZ-Pérez")).toBe("jose gomez perez");
    expect(normalizeName("  Ana   María ")).toBe("ana maria");
  });

  it("mide similitud: identico=1, typo alto, distinto bajo", () => {
    expect(nameSimilarity("Maria Gomez", "María Gómez")).toBe(1);
    expect(nameSimilarity("Maria Gomez", "Maria Gomes")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("Juan Perez", "Juan Gomez")).toBeLessThan(0.8);
  });
});

describe("resolveIdentity", () => {
  it("match exacto por documento -> seguimiento, sin candidatos", async () => {
    const res = await resolveIdentity(deps({ id: "pat-7" }, []), baseInput);
    expect(res.mode).toBe("seguimiento");
    expect(res.matchedPatientId).toBe("pat-7");
    expect(res.duplicateCandidates).toHaveLength(0);
  });

  it("sin match -> inicial; nombre casi identico es candidato (aunque falte fecha)", async () => {
    const res = await resolveIdentity(
      deps(null, [candidate({ firstName: "Maria", lastName: "Gomes", birthDate: null })]),
      baseInput,
    );
    expect(res.mode).toBe("inicial");
    expect(res.matchedPatientId).toBeNull();
    expect(res.duplicateCandidates).toHaveLength(1);
    expect(res.duplicateCandidates[0].score).toBeGreaterThanOrEqual(0.9);
  });

  it("nombre similar (no fuerte) solo es candidato si coincide la fecha", async () => {
    const similar = candidate({ firstName: "Maria", lastName: "Gimes", birthDate: "1990-05-10" });
    const withDate = await resolveIdentity(deps(null, [similar]), baseInput);
    expect(withDate.duplicateCandidates).toHaveLength(1);
    expect(withDate.duplicateCandidates[0].birthDateMatches).toBe(true);

    // mismo parecido pero distinta fecha de nacimiento: no se marca.
    const otherDate = candidate({ firstName: "Maria", lastName: "Gimes", birthDate: "1985-01-01" });
    const noMatch = await resolveIdentity(deps(null, [otherDate]), baseInput);
    expect(noMatch.duplicateCandidates).toHaveLength(0);
  });

  it("nombre distinto no es candidato, aunque coincida la fecha", async () => {
    const other = candidate({ firstName: "Juan", lastName: "Lopez", birthDate: "1990-05-10" });
    const res = await resolveIdentity(deps(null, [other]), baseInput);
    expect(res.duplicateCandidates).toHaveLength(0);
  });

  it("ordena los candidatos por score descendente", async () => {
    const res = await resolveIdentity(
      deps(null, [
        candidate({ patientId: "a", firstName: "Maria", lastName: "Gomes", birthDate: "1990-05-10" }),
        candidate({ patientId: "b", firstName: "Maria", lastName: "Gomez", birthDate: "1990-05-10" }),
      ]),
      baseInput,
    );
    expect(res.duplicateCandidates[0].patientId).toBe("b"); // identico, score 1
    expect(res.duplicateCandidates[0].score).toBeGreaterThanOrEqual(
      res.duplicateCandidates[1].score,
    );
  });
});
