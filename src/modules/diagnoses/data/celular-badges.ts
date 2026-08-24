import { BIODY_COLUMNS } from "@/clinical-engine";
// cAF: clasificador de angulo de fase del frozen (mecanismo de archivo derivado). La badge de AF LEE
// este clasificador en vez de duplicar el umbral 6.5/6.0: una sola fuente (misma disciplina que los
// rangos con su candado). Su banda "Bajo" es exactamente H<6.5 / M<6.0, igual que la badge del HTML.
import { cAF } from "@/clinical-engine/frozen/engine.core.derived.js";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Badges de "Nivel III · Salud celular" del panel de Tratamiento (PORTADO del vigente,
// ATLAS_v7.html:15702-15706, bloque `celBadges`). PURO y testeable (candado del mapeo + de los
// umbrales). Solo display/guia: no toca snapshot ni prescripcion.
//
// UMBRALES (verificado 2026-08-02, GILDARDO_QUERIES Q20 / BACKLOG re-sync):
//  - AF: se lee de cAF (clasificador), no se duplica el 6.5/6.0.
//  - MCA_dif < -1: umbral INLINE. OJO: el MISMO -1 vive tambien en el frozen (atlas-protocolo.js:95,
//    suplementacion de Zinc por "Deficit MCA"); si Gildardo lo cambia, los DOS sitios se mueven
//    juntos. El candado (celular-badges.test.ts) lo ancla contra el vigente.
//  - hidSG < su propia referencia (hidSG_ref del Biody): comparacion por paciente, sin umbral fijo.
//  - ECM_BCM > 1.4: umbral INLINE, solo en el vigente (no hay clasificador frozen).

export type CelularBadge = { id: string; label: string; guidance: string; tone: "warn" | "info" | "alert" };

// Una badge que NO se pudo evaluar por falta de su REFERENCIA poblacional (no por falta de datos del
// paciente). Distinto de "sin alteracion": el parametro no se comparo. Hoy aplica a MCA (necesita
// MCA_ref -> MCA_dif) e hidratacion (necesita hidSG_ref), ambas pendientes de Gildardo (Q35). Se declara
// explicito para que "sin alteraciones" no se lea como si estas dos se hubieran evaluado y salido bien.
export type CelularNotEvaluable = { id: string; label: string; reason: string };

export type CelularBadges = {
  // false = los crudos necesarios NO llegaron (BIS viejo sin esas columnas o import parcial): es
  // "no se pudo evaluar", DISTINTO de "sin alteraciones" (datos presentes y ninguna badge dispara).
  dataAvailable: boolean;
  badges: CelularBadge[];
  // Badges cuyo insumo del paciente SI esta pero falta la referencia poblacional para compararlo.
  notEvaluable: CelularNotEvaluable[];
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function computeCelularBadges(raw: Record<string, number>, sexoM: boolean): CelularBadges {
  const get = (key: string): number | null => {
    const col = BIODY_COLUMNS[key];
    return col ? num(raw[normalizeHeader(col.header)]) : null;
  };
  const AF = get("AF");
  const mcaDif = get("MCA_dif");
  const hidSG = get("hidSG");
  const hidSGref = get("hidSG_ref");
  const ecmBcm = get("ECM_BCM");

  // Presente al menos uno de los cuatro insumos de badge -> se pudo evaluar (aunque no dispare nada).
  const dataAvailable = [AF, mcaDif, hidSG, ecmBcm].some((v) => v != null);

  const badges: CelularBadge[] = [];
  // AF: dispara si el clasificador cAF dice "Bajo" (H<6.5 / M<6.0). No se duplica el numero.
  if (AF != null && AF > 0 && cAF(AF, sexoM ? "M" : "F").l === "Bajo") {
    badges.push({
      id: "af",
      label: "AF bajo",
      guidance: "Priorizar vitamina D, zinc, magnesio, antioxidantes (vitamina C, E, selenio).",
      tone: "warn",
    });
  }
  if (mcaDif != null && mcaDif < -1) {
    badges.push({
      id: "mca",
      label: "MCA reducida",
      guidance: "Aumentar proteína de alta calidad y micronutrientes anabolicos.",
      tone: "warn",
    });
  }
  if (hidSG != null && hidSGref != null && hidSGref > 0 && hidSG < hidSGref) {
    badges.push({
      id: "hid",
      label: "Hidratación celular deficiente",
      guidance: "Aumentar agua, electrolitos, reducir sodio.",
      tone: "info",
    });
  }
  if (ecmBcm != null && ecmBcm > 1.4) {
    badges.push({
      id: "ecm",
      label: "ECM/BCM elevado",
      guidance: "Antiinflamatorio nutricional prioritario.",
      tone: "alert",
    });
  }

  // No evaluables por falta de REFERENCIA (no de dato del paciente). Solo si hay composicion que
  // evaluar (dataAvailable): con un BIS viejo sin ninguna columna, todo es "sin datos", no "sin
  // referencia". MCA compara la desviacion MCA_dif (= MCA - MCA_ref); la hidratacion compara hidSG
  // contra hidSG_ref. En el export corto la MCA y la hidSG se derivan, pero sus referencias las debe
  // Gildardo (Q35): sin ellas estas dos badges no se pueden emitir, y la ausencia se DECLARA.
  // La referencia poblacional de MCA/hidratacion YA se cablea (Gildardo §9, 2026-08-12: MCA_ref = 52,4%
  // de la MLG, hidSG_ref = 73,2%, derivadas en el import). Asi que hoy solo quedan no-evaluables las
  // mediciones IMPORTADAS ANTES de §9 (sin las referencias derivadas), no por una entrega pendiente.
  const notEvaluable: CelularNotEvaluable[] = [];
  if (dataAvailable) {
    if (mcaDif == null) {
      notEvaluable.push({
        id: "mca",
        label: "Masa celular activa (MCA)",
        reason: "No evaluable: esta medición no trae la referencia de MCA (import anterior a su cableado).",
      });
    }
    if (hidSG != null && hidSGref == null) {
      notEvaluable.push({
        id: "hid",
        label: "Hidratación celular",
        reason: "No evaluable: esta medición no trae la referencia de hidratación (import anterior a su cableado).",
      });
    }
  }
  return { dataAvailable, badges, notEvaluable };
}
