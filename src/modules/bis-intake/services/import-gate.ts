import type { BisIntakeRecord } from "../types";

// Gate de ORDEN + seguridad del import BIS. El sistema impone el orden: las condiciones de la toma
// deben responderse ANTES del import. Si el profesional pudiera importar primero y marcar marcapasos
// despues, la medicion ya se habria hecho y la compuerta llegaria tarde (justo lo que se evita). Y
// si hay contraindicacion (marcapasos), el import se bloquea. Pura y testeable: el action la aplica
// (defensa server, autoritativa) y la UI la refuerza deshabilitando el formulario.
export type ImportGate =
  | { allowed: true }
  | { allowed: false; reason: "conditions_missing" | "contraindicated"; message: string };

export function evaluateBisImportGate(intake: BisIntakeRecord | null): ImportGate {
  if (!intake) {
    return {
      allowed: false,
      reason: "conditions_missing",
      message:
        "Responde primero las condiciones de la toma BIS. Sin el checklist no se habilita el import.",
    };
  }
  if (intake.contraindicated) {
    return {
      allowed: false,
      reason: "contraindicated",
      message:
        "No se puede importar: hay una contraindicacion (marcapasos). La bioimpedancia no se realiza.",
    };
  }
  return { allowed: true };
}
