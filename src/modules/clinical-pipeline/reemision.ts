import type { EngineOutput } from "@/clinical-engine";

// ¿ESTE documento hay que REEMITIRLO, o basta con marcarlo?
//
// SU REGLA (§12b, 2026-08-28), y es una adición al Reglamento Operativo, textual:
//
//   "Reemisión obligatoria cuando el cambio es de CALIBRACIÓN POBLACIONAL y el paciente CAMBIA DE BANDA.
//    Si el número se mueve pero la clasificación no, se marca en la historia y no se reemite. EL CRITERIO
//    ES EL RESULTADO, NO EL TIPO DE CAMBIO: una calibración que no mueve a nadie de banda no obliga a
//    nada, y un clasificador que sí los mueve, obliga."
//
// De ahí sale la forma de esta función, y conviene decir por qué NO es lo que uno escribiría primero.
// Lo natural sería mirar QUÉ dimensión cambió (calibración, clasificadores, motor) y decidir por ahí. Él
// dice explícitamente que no: se compara el RESULTADO. Una recalibración que no mueve a nadie no obliga a
// nadie, aunque sea una recalibración; y un cambio menor que sí mueve la banda, obliga.
//
// QUÉ CUENTA COMO "BANDA": la CLASIFICACIÓN, no el número. Es su propia distinción, literal, y por eso no
// hace falta que inventemos un umbral: se comparan las etiquetas selladas contra las de hoy. Si el IFC
// pasa de 4,10 a 4,13 y sigue diciendo "Bajo", no cambió de banda. Si pasa a decir "Normal", sí.
//
// SE COMPARAN TRES COSAS, y las tres son clasificación:
//   1. Las clasificaciones por indicador (`classifications`), que es lo que el profesional lee al lado
//      de cada cifra.
//   2. El nivel de riesgo integrado del DFI, que es la lectura de conjunto.
//   3. Las severidades de los cinco dominios del DFI, que es lo que dibuja el radar. Un dominio que pasa
//      de Leve a Moderado mueve la figura que el profesional mira primero.
//
// NO SE COMPARAN los números: es justo lo que él excluye.

export type CambioDeBanda = {
  /** Nombre legible de lo que cambió, para decírselo al profesional. */
  que: string;
  /** Cómo estaba en el documento emitido. */
  antes: string;
  /** Cómo queda con la ciencia de hoy. */
  ahora: string;
};

export type VeredictoReemision =
  | { kind: "al-dia" }
  /** Cambió algo, pero ninguna clasificación: se marca en la historia y NO se reemite. */
  | { kind: "solo-marcar" }
  /** Cambió al menos una banda: la reemisión es OBLIGATORIA (§12b). */
  | { kind: "reemision-obligatoria"; cambios: CambioDeBanda[] };

const NOMBRE_DOMINIO: Record<string, string> = {
  d1: "Celular-Eléctrico",
  d2: "Metabólico-Estructural",
  d3: "Envejecimiento",
  d4: "Conductual-Perceptual",
  d5: "Epigenético-Contextual",
};

const SEV_LABEL = ["Bajo", "Leve", "Moderado", "Alto"] as const;
const sevTexto = (s: number): string => SEV_LABEL[Math.max(0, Math.min(3, s))] ?? String(s);

/**
 * Compara el documento SELLADO con el recomputado con la ciencia de hoy.
 *
 * `recomputado` es null cuando no se pudo recomputar (por ejemplo, faltan insumos). En ese caso NO se
 * afirma que esté al día ni que haya que reemitir: se cae a "solo marcar", que es la conducta ya vigente.
 * Afirmar "al día" sin haber comparado sería exactamente el tipo de dato inventado que estas reglas
 * existen para evitar.
 */
export function veredictoDeReemision(
  sellado: EngineOutput,
  recomputado: EngineOutput | null,
  hayDesfaseDeVersion: boolean,
): VeredictoReemision {
  if (!hayDesfaseDeVersion) return { kind: "al-dia" };
  if (!recomputado) return { kind: "solo-marcar" };

  const cambios: CambioDeBanda[] = [];

  // 1. Clasificación por indicador.
  const codigos = new Set([
    ...Object.keys(sellado.classifications ?? {}),
    ...Object.keys(recomputado.classifications ?? {}),
  ]);
  for (const code of [...codigos].sort()) {
    const a = sellado.classifications?.[code]?.label ?? null;
    const b = recomputado.classifications?.[code]?.label ?? null;
    // AUSENTE vs AUSENTE no es cambio. AUSENTE vs con-dato SÍ lo es, y en las dos direcciones: que un
    // indicador deje de emitirse (o empiece a emitirse) cambia lo que el profesional ve.
    if (a === b) continue;
    cambios.push({ que: code, antes: a ?? "sin dato", ahora: b ?? "sin dato" });
  }

  // 2. Nivel de riesgo integrado del DFI.
  const rA = sellado.dfi?.riesgo?.nivel ?? null;
  const rB = recomputado.dfi?.riesgo?.nivel ?? null;
  if (rA !== rB) {
    cambios.push({
      que: "Riesgo integrado (DFI)",
      antes: rA ?? "sin dato",
      ahora: rB ?? "sin dato",
    });
  }

  // 3. Severidad de cada dominio del DFI.
  const domA = new Map((sellado.dfi?.domains ?? []).map((d) => [d.id, d]));
  const domB = new Map((recomputado.dfi?.domains ?? []).map((d) => [d.id, d]));
  for (const id of [...new Set([...domA.keys(), ...domB.keys()])].sort()) {
    const a = domA.get(id);
    const b = domB.get(id);
    if (a && b && a.sev === b.sev) continue;
    if (!a || !b) continue; // un dominio que aparece o desaparece es otra cosa; no se afirma banda.
    cambios.push({
      que: NOMBRE_DOMINIO[id] ?? a.nombre,
      antes: sevTexto(a.sev),
      ahora: sevTexto(b.sev),
    });
  }

  return cambios.length > 0
    ? { kind: "reemision-obligatoria", cambios }
    : { kind: "solo-marcar" };
}

/**
 * ¿Hay que avisarle AL PACIENTE? (§12c)
 *
 * Su regla: "Al paciente se le avisa solo si cambia su clasificación o su tratamiento. Si no cambia
 * ninguna de las dos, queda el registro de versión en la historia y no se le manda nada: NO SE ALARMA A
 * NADIE POR UN DECIMAL. Y un tratamiento reemitido se avisa SIEMPRE, porque cambia lo que la persona
 * come."
 *
 * Se separa del veredicto de arriba a propósito: son dos decisiones distintas sobre el mismo hecho, y la
 * del paciente tiene una entrada más (el tratamiento) que la del documento no tiene.
 */
export function avisarAlPaciente(
  veredicto: VeredictoReemision,
  tratamientoReemitido: boolean,
): boolean {
  if (tratamientoReemitido) return true; // siempre, "porque cambia lo que la persona come"
  return veredicto.kind === "reemision-obligatoria";
}
