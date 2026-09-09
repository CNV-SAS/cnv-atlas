"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { ETAPA_IDS, ETAPAS, type TabId } from "../etapas";
import { type ReactNode } from "react";

// Shell de pestañas de una evaluacion. Adopta las etapas reales de la ruta ANI-BIS-E como tabs internas
// (es la estructura real de la ruta clinica, no "familiaridad de formacion": los profesionales se forman
// en Atlas, no en el HTML); el sidebar sigue navegando entre entidades. El contenido de cada etapa se
// computa en el servidor y llega como prop (ReactNode), asi el cambio de tab es client-side sin refetch ni
// perder la RLS del server.
//
// ENCUESTA Y ANTROP. & BIS SON PESTAÑAS PROPIAS desde el 2026-09-10 (Gildardo, reunion). Este comentario
// decia justo lo contrario ("no son etapas propias: son las dos entradas de datos de la evaluacion, viven
// como secciones dentro de Evaluacion"), y era una decision NUESTRA: su archivo las tiene como dos de sus
// seis modulos de arriba, y de ahi sale tambien el ORDEN. Se reescribe en vez de dejarlo, porque un
// comentario que afirma lo contrario de lo que hace el codigo es peor que ninguno.
//
// La ETAPA activa vive en la URL (?etapa=...), NO en useState (mismo patron que las subpestañas): sin esto,
// recargar o compartir un enlace SIEMPRE abria en el default (Diagnostico), sin importar donde estaba el
// profesional; y las subpestañas (?sub/?ev/?trat) quedaban en la URL pero nunca se llegaba a su etapa para
// usarlas (bug del smoke 2026-08-21). PARAMETRO PROPIO (?etapa), distinto de los tres de subpestaña: al
// conmutar se COPIAN todos los params y solo se fija el propio, asi las cuatro conviven sin pisarse y cada
// etapa recuerda su subpestaña al volver. El DEFAULT lo decide la pagina (`porDefecto`): sin diagnostico
// abre en Evaluacion, con diagnostico en Diagnostico (cotejo 2026-09-05, punto 3).

// QUINTA ETAPA (2026-08-24): "Reporte / HC", donde vive lo que se le ENTREGA al paciente y el cierre de la
// consulta. Nace por dos razones que ya estaban registradas: el reporte se habia quedado en Tratamiento
// PORQUE NO HABIA PESTAÑA DESTINO (no fue decision de diseño, fue la unica opcion), y el prototipo de
// Gildardo tiene una historia clinica de once secciones que no teniamos dimensionada.
//
// Va AL FINAL y en ese orden a proposito: es la ultima etapa de la consulta, la que cierra. Nunca es el
// default: abrir en la quinta al entrar seria empezar por el final.
// LA LISTA SE MUDO A `../etapas` (modulo NEUTRO, 2026-09-09) y aqui solo se consume. La razon no es
// orden: hay avisos que nombran una pestaña ("ese paso vive en X") y se rinden desde el SERVIDOR, asi que
// no pueden leer la lista de un modulo `"use client"` sin caer en el hazard B. Vivia aqui y por eso el
// aviso de Diagnostico seguia mandando a "la pestaña Evaluación" despues de partirla en dos.

// Un ?etapa desconocido cae a la etapa POR DEFECTO. Se valida contra la LISTA y no contra una cadena de
// comparaciones: agregar una etapa y olvidar el parseo daria un tab al que la URL nunca llega.
//
// EL DEFAULT DEJA DE SER FIJO (cotejo 2026-09-05, punto 3). Antes era siempre "diagnostico", asi que
// entrar a una evaluacion SIN diagnostico abria una pestaña que no tenia nada que mostrar todavia. Su
// regla, y es la correcta: sin diagnostico se abre en Evaluacion, que es donde hay trabajo por hacer; con
// diagnostico se abre en Diagnostico, que es lo que se viene a ver.
//
// Y SE QUITA EL `raw !== "diagnostico"`, que era una trampa esperando: excluia "diagnostico" de la lista
// valida y lo dejaba caer al default, que casualmente era el mismo. Con el default configurable,
// `?etapa=diagnostico` habria aterrizado en Evaluacion.
// ENLACES VIEJOS: `?etapa=evaluacion` existio hasta el 2026-09-10 y se repartio en dos. Un enlace guardado
// (o el de un correo, o el que alguien dejo en una nota) caeria al default sin decir nada, que es la forma
// silenciosa de romper una direccion. Se traduce: si venia con `?ev=antropometria` iba a la segunda, y si
// no, a la primera. Se conserva la subpestaña que traiga porque es exactamente lo que la persona miraba.
function traducirEtapaVieja(raw: string, ev: string | null): TabId {
  return ev === "antropometria" ? "antro" : "encuesta";
}

function parseTab(raw: string | null, ev: string | null, porDefecto: TabId): TabId {
  if (raw === "evaluacion") return traducirEtapaVieja(raw, ev);
  return raw && ETAPA_IDS.has(raw) ? (raw as TabId) : porDefecto;
}

export function EvaluationTabs({
  encuesta,
  antro,
  diagnostico,
  tratamiento,
  seguimiento,
  reporte,
  porDefecto = "diagnostico",
}: {
  encuesta: ReactNode;
  antro: ReactNode;
  diagnostico: ReactNode;
  tratamiento: ReactNode;
  seguimiento: ReactNode;
  reporte: ReactNode;
  /**
   * Etapa que se abre cuando la URL no trae `?etapa`. La decide la PAGINA, que es quien sabe si hay
   * diagnostico; el componente no puede saberlo sin recibirlo.
   *
   * El default del default es "diagnostico" para no cambiar la conducta de ningun llamador que no lo
   * pase, pero el candado verifica que los dos caminos de la pagina lo pasen explicitamente.
   */
  porDefecto?: TabId;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseTab(searchParams.get("etapa"), searchParams.get("ev"), porDefecto);
  const content: Record<TabId, ReactNode> = {
    encuesta,
    antro,
    diagnostico,
    tratamiento,
    seguimiento,
    reporte,
  };

  function select(id: TabId) {
    // Copia TODOS los params (conserva ?sub/?trat de las subpestañas) y fija solo el propio; ninguno
    // pisa al otro. replaceState, no router.replace: el contenido de las 4 etapas ya llego del servidor, asi
    // que conmutar es instantaneo (sin refetch). La URL persiste (recargar/compartir/volver abre la correcta).
    const params = new URLSearchParams(searchParams.toString());
    params.set("etapa", id);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Etapas de la evaluación"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {ETAPAS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              onClick={() => select(t.id)}
              className={
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {content[active]}
      </div>
    </div>
  );
}
