import { History } from "lucide-react";

import { bandaIae, cifraEbBis } from "@/clinical-engine/presentacion-eb-bis";
import { DetailsSection } from "./details-section";
import type { Reemision } from "../data/reemision-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// MARCA: ESTE DIAGNOSTICO SE REEMITIO POR RECALIBRACION CIENTIFICA
//
// ═══ DE DONDE SALE (Santiago, 2026-10-29) ═══
//
// *"En el diagnostico no se ve que se reemitio... Que el diagnostico diga 'Reemitido el ... por
// recalibracion cientifica (motor 1.0.0 a 2.0.0)' y deje ver la version anterior."*
//
// ═══ EL PAR DEL AVISO DE CIENCIA ANTERIOR, Y SU OPUESTO EXACTO ═══
//
// `AvisoCienciaAnterior` dice "este documento se emitio con una version anterior"; esta marca dice "este
// documento YA se puso al dia, y antes decia otra cosa". Nunca aparecen juntas: o el documento esta
// desfasado, o esta reemitido. Comparten el tono a proposito (`muted`, icono de historia, cero color
// clinico) porque comparten la naturaleza: son notas de PROCEDENCIA del documento, no hallazgos del
// paciente. El rojo y el ambar significan riesgo del paciente; aqui no hay ninguno.
//
// ═══ POR QUE SE MUESTRAN LAS CIFRAS VIEJAS, Y POR QUE PLEGADAS ═══
//
// Mostrarlas abiertas pondria dos edades biologicas a la misma altura, y la pregunta "cual es la buena"
// no deberia ni aparecer: la vigente es la de arriba. Pero esconderlas del todo deja al profesional sin
// poder entender una conversacion que ya tuvo con el paciente ("usted me dijo 54"). Asi que van detras
// de un desplegable cerrado, rotuladas como lo que son: lo que el documento ANTERIOR decia.
//
// Y van con los textos de su tabla 3, los mismos que el documento vigente, para que la comparacion sea
// entre dos cifras y no entre dos vocabularios.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** La fecha en español, sin la hora: el dia es lo que importa para una nota de procedencia. */
function enEspanol(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export function MarcaDeReemision({ reemision }: { reemision: Reemision | null }) {
  if (!reemision) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <p className="flex items-start gap-2 text-muted-foreground">
        <History className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">
            Reemitido el {enEspanol(reemision.fecha)} por recalibración científica
          </span>{" "}
          (motor {reemision.versionAnterior} a {reemision.versionNueva}).{" "}
          {/* QUE NO SE TOCO, dicho aqui y no solo en el rastro: es la pregunta que el profesional se hace
              al ver que su documento cambio, y la respuesta tiene que estar donde esta la noticia. */}
          La prescripción que indicaste no se modificó, y el informe que el paciente ya recibió tampoco.
          {reemision.veces > 1 ? ` Se ha reemitido ${reemision.veces} veces.` : ""}
        </span>
      </p>

      {reemision.anterior ? (
        <DetailsSection title="Lo que decía el documento anterior">
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Edad biológica estimada:</dt>
              <dd className="text-foreground">{cifraEbBis(reemision.anterior.eb)} años</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Índice de aceleración:</dt>
              <dd className="text-foreground">
                {reemision.anterior.iae >= 0 ? "+" : "-"}
                {cifraEbBis(Math.abs(reemision.anterior.iae))} años, {bandaIae(reemision.anterior.iae)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Emitido con el motor {reemision.versionAnterior}. Se conserva como registro: las dos
            versiones quedan en la historia, y la vigente es la de arriba.
          </p>
        </DetailsSection>
      ) : null}
    </div>
  );
}
