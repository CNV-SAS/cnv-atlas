"use client";

import { useState } from "react";

import type { DfiDomain } from "@/clinical-engine";
import { bandToLetter, bandToWord, efrDesglose } from "@/clinical-engine/types";
import * as core from "@/clinical-engine/frozen/engine.core.js";

// COLOR DEL NUMERO DE ESTADO. Sale de la MISMA escala que pinta la celda en la Diana (el estado 1 es
// optimo y el 81 riesgo maximo), no de un hex elegido aqui: un color escogido a mano sobre una cifra
// clinica seria un veredicto nuestro. Se reparte en los tres tramos de la capa clinica.
function colorEstado(n: number): string {
  if (n <= 27) return "text-clinical-optimal";
  if (n <= 54) return "text-clinical-warning";
  return "text-clinical-critical";
}
import { ComparisonLayout } from "@/components/ui/comparison-layout";

import { Diana } from "./diana";
import { DfiRadar } from "./dfi-radar";
import type { EfrStateRef } from "../data/efr-states-types";

// Mapas del estado (radar + Diana) con la exploracion de estados (V2). Reorg 2026-08-19 (Gildardo, replica
// del HTML): se quito el contenedor unico "Mapas del estado". El RADAR va primero, en su propio contenedor
// (RadarPanel). La DIANA va junto con el detalle del estado EFR, en otro contenedor debajo (DianaExplorer,
// que el padre monta encabezando la card de detalle). Razon del orden: en movil, con la Diana ABAJO, ella y
// sus paneles de exploracion quedan juntos; explorar no obliga a pasar por el radar (que queda arriba).
//
// El estado del paciente es SIEMPRE el del snapshot inmutable; la exploracion es una capa de solo lectura,
// rotulada como referencia, que lee el contenido de OTRAS celdas del registry (efr_states). Explorar nunca
// cambia el diagnostico del paciente. Client por la interactividad (toggle + celda seleccionada).

type PatientContent = {
  diagnosisName: string | null;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

type StateDetail = {
  stateNumber: number;
  diagnosisName: string | null;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

// Panel de detalle de UN estado. `kind` distingue a golpe de vista (care Santiago 2026-08-18 b) cual es el
// del PACIENTE y cual es la REFERENCIA explorada: no basta el aviso de texto, confundirlos seria grave. El
// del paciente va SOLIDO y anclado (borde y badge oscuros, "Diagnostico"); la referencia va PUNTEADA con
// acento (borde punteado primary, badge tenue, "No es el diagnostico del paciente").
function StateDetailPanel({ detail, kind }: { detail: StateDetail; kind: "paciente" | "referencia" }) {
  const isPatient = kind === "paciente";
  // Los dos ejes del estado, derivados de su numero. Del estado de REFERENCIA no hay snapshot: solo se
  // sabe que celda toco el profesional, asi que sus bandas y sus nombres se derivan igual que los del
  // paciente. Una sola via para los dos, que es lo que impide que digan cosas distintas.
  const d = efrDesglose(detail.stateNumber);
  const ejes = d
    ? {
        ...d,
        nombreAnillo:
          (core.FYR_LABELS as Record<string, { l: string } | undefined>)[`${d.ifc}_${d.irc}`]?.l ??
          `A${d.ringIndex + 1}`,
        nombreSector:
          (core.STRUCT_LABELS as Record<string, string | undefined>)[
            `${bandToLetter(d.ffmi)}_${bandToLetter(d.fmi)}`
          ] ?? `E${d.sectorIndex + 1}`,
      }
    : null;

  return (
    <div
      className={`flex h-full flex-col gap-2 rounded-xl border p-4 ${
        isPatient ? "border-foreground/30 bg-card" : "border-dashed border-primary/50 bg-primary/5"
      }`}
    >
      {/* LA ETIQUETA VA EN CADA CARD, no en una nota general como en su archivo. En una pantalla clinica
          la diferencia importa: una nota comun se puede leer aplicada a la card equivocada. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            isPatient ? "bg-foreground text-background" : "bg-primary/15 text-primary"
          }`}
        >
          {isPatient ? "Estado del paciente" : "Referencia"}
        </span>
        <span className="text-xs text-muted-foreground">
          {isPatient ? "Diagnóstico" : "No es el diagnóstico del paciente"}
        </span>
      </div>

      {/* EL NUMERO COMO ANCLA, como en su archivo: lo primero que identifica el estado, grande, y debajo
          los dos ejes CON SU SIGNIFICADO. Antes iba de chip pequeno entre otros dos, asi que el dato que
          identifica todo competia con sus etiquetas.
          EL COLOR SALE DEL CLASIFICADOR, nunca de un hex: `colorEstado` mapea el numero a la banda de la
          escala de riesgo, la MISMA que pinta su celda en la Diana. Un rojo elegido a mano aqui seria un
          veredicto nuestro. */}
      <div className="flex flex-col gap-0.5">
        <span className={`text-3xl font-bold leading-none tabular-nums ${colorEstado(detail.stateNumber)}`}>
          #{detail.stateNumber}
        </span>
        {ejes ? (
          <span className="text-xs text-muted-foreground">
            Anillo A{ejes.ringIndex + 1} ({ejes.nombreAnillo}) · Sector E{ejes.sectorIndex + 1} (FFMI{" "}
            {bandToWord(ejes.ffmi)} / FMI {bandToWord(ejes.fmi)})
          </span>
        ) : null}
      </div>

      {/* LA TABLA DE SIETE, portada de su panel. Los siete datos ya existian en la pantalla, pero
          repartidos entre el parrafo de la Diana y la linea de abajo: el profesional los reunia a ojo.
          Aqui van juntos y POR ESTADO, que es lo que permite comparar paciente contra referencia.
          Se derivan del numero con efrDesglose, no se pasan: del estado explorado no hay snapshot. */}
      {ejes ? (
        <dl className="flex flex-col divide-y divide-border/60 border-y border-border/60 text-sm">
          {[
            { k: "IFC", v: bandToWord(ejes.ifc) },
            { k: "IRC", v: bandToWord(ejes.irc) },
            { k: "Anillo (función-riesgo)", v: ejes.nombreAnillo },
            { k: "FFMI", v: bandToWord(ejes.ffmi) },
            { k: "FMI", v: bandToWord(ejes.fmi) },
            { k: "Fenotipo", v: ejes.nombreSector },
            { k: "Estado EFR", v: `#${detail.stateNumber} de 81` },
          ].map((f) => (
            <div key={f.k} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground">{f.k}</dt>
              <dd className="text-right font-medium text-foreground">{f.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="text-sm font-medium text-foreground">
        {detail.diagnosisName ?? "Sin dato para este estado."}
      </p>
      <Field label="Mecanismos bioquímicos / Disfunción celular" value={detail.mechanism} />
      <Field label="Biomarcadores clave" value={detail.biomarkers} />
      <Field label="Riesgos clínicos" value={detail.risks} />
      <Field label="Nutracéuticos sugeridos" value={detail.suggestedNutraceuticals} />
    </div>
  );
}

// LECTURA DE LA DIANA: como se lee el mapa, portada de su panel ("LECTURA DE LA DIANA", cuatro cajas).
//
// POR QUE CUATRO BLOQUES Y NO EL PARRAFO QUE TENIAMOS: la misma informacion en parrafo corrido no se lee,
// y es justo la que hace falta para interpretar el grafico. Su archivo la parte en cuatro y acierta.
//
// PERO SIN SUS CAJAS ANIDADAS. Su panel mete cajas con borde dentro de una card, y dentro de una de ellas
// otra rejilla de cajas con borde: tres niveles de superficie. Atlas tiene exactamente tres con
// SIGNIFICADO (decision / derivado / registro), asi que estrenar un cuarto haria que una caja significara
// "es una caja", que es lo que los tres niveles vinieron a evitar. Van planas, separadas por hairline.
function LecturaDiana() {
  const filas = [
    { t: "9 anillos", f: "IFC x IRC", d: "Función y riesgo celular (primario)" },
    { t: "9 sectores", f: "FFMI x FMI", d: "Estructura corporal (secundario)" },
    { t: "Centro #1", f: "Óptimo", d: "Función alta / riesgo bajo" },
    { t: "Periferia #81", f: "Riesgo máximo", d: "Disfunción / estructura comprometida" },
  ];
  return (
    <div className="w-full max-w-[44rem]">
      <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Lectura de la Diana
      </p>
      <div className="grid grid-cols-1 gap-x-6 divide-y divide-border/60 border-y border-border/60 sm:grid-cols-2 sm:divide-y-0">
        {filas.map((r) => (
          <div key={r.t} className="flex flex-col py-2">
            <span className="text-sm font-semibold text-foreground">{r.t}</span>
            <span className="text-xs font-medium text-foreground">{r.f}</span>
            <span className="text-xs text-muted-foreground">{r.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// RADAR funcional, en su propio contenedor (va PRIMERO, lo monta el padre en su card). Con la encuesta
// incompleta (Q28) el radar NO se dibuja: tres de sus cinco ejes saldrian sobre defaults y un radar parcial
// engana (colapsar un eje al centro se lee como "optimo", no como "sin dato"). La Diana si se muestra: se
// posiciona por bandas IFC/IRC/FFMI/FMI, todas de la MEDICION (BIS), no de la encuesta.
export function RadarPanel({
  radarDomains,
  dfiComplete,
}: {
  radarDomains: DfiDomain[];
  dfiComplete: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {dfiComplete ? (
        <DfiRadar domains={radarDomains} />
      ) : (
        <p className="max-w-xs rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          El radar funcional se muestra al completar la encuesta. Tres de sus cinco dominios
          (envejecimiento, conductual y contextual) dependen de respuestas que faltan.
        </p>
      )}
    </div>
  );
}

// DIANA + exploracion de estados. La monta el padre ENCABEZANDO la card de "Detalle del estado EFR", para
// que la Diana y el detalle queden en un mismo contenedor (replica del HTML). Al explorar otro estado, el
// estado del paciente queda en el panel PRINCIPAL y el explorado abre AL LADO (debajo en movil), sin
// reemplazar al del paciente; el primitivo ComparisonLayout se reusa en Seguimiento.
export function DianaExplorer({
  bands,
  stateNumber,
  frSectorName,
  structuralName,
  patientContent,
  statesContent,
}: {
  bands: { ifc: number; irc: number; ffmi: number; fmi: number };
  stateNumber: number;
  frSectorName: string;
  structuralName: string;
  patientContent: PatientContent;
  statesContent: Record<number, EfrStateRef>;
}) {
  const canExplore = Object.keys(statesContent).length > 0;
  const [exploring, setExploring] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  // Referencia explorada: una celda seleccionada que NO es la del paciente y existe en el registry. La
  // celda del paciente SIEMPRE sale del snapshot (patientContent), nunca del registry.
  const isPatientCell = selected === stateNumber;
  const exploredRef = selected != null && !isPatientCell ? (statesContent[selected] ?? null) : null;

  function toggle() {
    if (exploring) {
      setExploring(false);
      setSelected(null);
    } else {
      setExploring(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-3">
          {/* Encabezado fiel al HTML ("Diana EFR BIS — 81 Estados"); "·" en vez de em-dash. */}
          <h3 className="text-sm font-semibold text-foreground">Diana EFR BIS · 81 estados</h3>
          {canExplore ? (
            <button
              type="button"
              onClick={toggle}
              className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              {exploring ? "Volver al estado del paciente" : "Explorar otros estados"}
            </button>
          ) : null}
        </div>
        <Diana
          bands={bands}
          stateNumber={stateNumber}
          frSectorName={frSectorName}
          structuralName={structuralName}
          interactive={exploring}
          selectedStateNumber={exploring ? selected : null}
          onSelectCell={setSelected}
        />
        <LecturaDiana />
      </div>

      {/* Exploracion como COMPARACION lado a lado (Santiago 2026-08-18 b): el estado del paciente queda en
          el panel PRINCIPAL y el explorado abre AL LADO (debajo en movil), en vez de reemplazarlo. Al
          cerrar, la Diana de arriba queda intacta en su lugar. */}
      {exploring ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {exploredRef
              ? "Comparando el estado del paciente con el estado de referencia que elegiste en la Diana. La referencia no cambia el diagnóstico."
              : "Haz clic en una celda de la Diana para comparar ese estado de referencia con el del paciente. Explorar no cambia el diagnóstico."}
          </p>
          <ComparisonLayout
            primary={<StateDetailPanel detail={{ ...patientContent, stateNumber }} kind="paciente" />}
            secondary={exploredRef ? <StateDetailPanel detail={exploredRef} kind="referencia" /> : null}
          />
        </div>
      ) : null}
    </div>
  );
}
