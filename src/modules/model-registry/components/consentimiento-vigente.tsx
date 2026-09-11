import { ChevronDown, FileCheck } from "lucide-react";

import { ConsentDocument } from "@/modules/consent/components/consent-document";
import { buildConsentFullPreview } from "@/modules/consent/consent-instance";
import { CONSENT_TEXT_V1_0, CONSENT_VERSION } from "@/modules/consent/text/consent-v1.0";

// ═══ EL CONSENTIMIENTO SE MUDA AQUI (Santiago, 2026-09-10) ═══
//
// Su razon, y la comparto: "no vale la pena una pagina dedicada solo para esto. Y ademas el consentimiento
// tambien esta versionado, entonces lo podemos meter ahi con las otras cosas ya que hace parte del
// modelo."
//
// LO QUE HABIA en `/consentimiento` eran treinta y seis lineas: un titulo con la version y el texto
// completo de la plantilla. Una entrada de barra lateral, una ruta y una pantalla para mostrar un
// documento que se consulta de vez en cuando.
//
// Y ENCAJA POR UNA RAZON DE FONDO, no solo por tamaño: esta pantalla responde "con que se esta
// trabajando", y el consentimiento es una pieza versionada mas de eso. La version que firmo un paciente
// queda en su instancia; la que se le presenta HOY es esta, y es del mismo tipo de dato que las cuatro
// versiones de arriba.
//
// VA PLEGADO, con `details` nativo. El documento es largo y quien entra a esta pantalla entra casi
// siempre por las versiones; desplegado empujaria todo lo demas fuera de la primera pantalla. Nativo y no
// estado de cliente: este bloque es de servidor y un desplegable que no guarda nada no necesita
// hidratacion. Y LA VERSION SE VE PLEGADO, que es el dato que se viene a mirar.

// ── EL MISMO TRATAMIENTO QUE LAS TARJETAS DE VERSION (Santiago, 2026-09-10) ─────────────────────────
//
// Lo diseñe en el artefacto y monte otra cosa: tarjeta cuadrada, sin tesela y con un titulo de seccion
// encima que repetia lo que la propia tarjeta ya dice. En una pantalla de tres bloques, uno con otro
// acabado se lee como si fuera de otra pantalla.
//
// ASI QUE ES UNA TARJETA MAS: mismo radio, mismo borde, misma sombra y la misma tesela azul con su icono.
// Lo unico que la distingue es que se abre, y eso lo dice el mando de la derecha, no un acabado distinto.
export function ConsentimientoVigente() {
  return (
    <details className="group rounded-xl border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCheck className="size-[1.05rem]" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Consentimiento informado
            </span>
            <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
              Versión {CONSENT_VERSION} vigente
            </span>
            <span className="text-xs text-muted-foreground">
              El texto que se presenta al paciente antes de la encuesta. Solo lectura.
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          Ver el texto
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-border p-4">
          {/* Vista COMPLETA de la plantilla vigente: AMBAS ramas (mayor y menor) con los campos como
              rotulos. NO una instancia de un paciente (esa filtra la rama menor). Asi se lee el texto
              entero, incluido el bloque de menores, sin marcadores crudos. */}
          <ConsentDocument text={buildConsentFullPreview(CONSENT_TEXT_V1_0)} />
          <p className="text-xs text-muted-foreground">
            Según la edad del paciente, en el documento que firma se muestra solo la rama que aplica
            (mayor de edad o representante legal del menor).
          </p>
      </div>
    </details>
  );
}
