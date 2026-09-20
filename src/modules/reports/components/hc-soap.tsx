"use client";

import { Check, ClipboardCopy, Printer } from "lucide-react";
import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { imprimirHoja } from "@/components/shared/imprimir-hoja";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { agregarNotaSubjetivaAction, type ReportActionState } from "../actions";
import type { HistoriaClinicaSoap } from "../data/reports-view-types";
import { soapATexto } from "../services/soap-a-texto";

// ═══ LA HISTORIA CLINICA EN SOAP, EN PANTALLA Y EN PAPEL (2026-09-20) ═══
//
// LOS MISMOS DATOS de la historia clinica, ordenados por acto clinico. Es un documento APARTE de la suya,
// no un reemplazo: el porque esta en `hc-soap-reader` y en `docs/PLAN_HC_SOAP.md`.
//
// CLIENTE Y NO SERVIDOR, aunque no tenga formularios: el boton de copiar necesita el portapapeles del
// navegador. El DOCUMENTO se compone en el servidor y llega ya armado; aqui solo se pinta y se copia.

const VACIO: ReportActionState = { error: null, success: null, warning: null };

function Apartado({
  letra,
  titulo,
  children,
}: {
  letra: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
        {/* LA LETRA EN AZUL DE MARCA: es capa de interfaz (ordena la lectura), no de riesgo. */}
        <span className="text-base font-bold text-primary">{letra}</span>
        {titulo}
      </h3>
      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

// ═══ LA ANAMNESIS DEL PROFESIONAL (apartado S) ═══
//
// LO QUE SOSTIENE LA SEPARACION, y es la condicion con la que se aprobo redactar la encuesta: lo escrito
// a mano NO se mezcla con lo generado. Va en su propio bloque, debajo, con su autor y su fecha.
//
// Y LO GENERADO NO SE EDITA. En otros sistemas editar la narrativa autogenerada es lo normal, y con razon:
// alli esa narrativa es una TRANSCRIPCION, o sea una interpretacion que puede estar mal. Aqui cada frase
// sale de una respuesta que el paciente marco, asi que editarla no seria corregir una interpretacion,
// seria cambiar lo que el paciente respondio. Si el profesional no esta de acuerdo, lo dice aqui.
function NotasSubjetivas({
  evaluationId,
  notas,
  puedeEscribir,
}: {
  evaluationId: string;
  notas: { id: string; texto: string; autor: string; profesion: string | null; fecha: string }[];
  puedeEscribir: boolean;
}) {
  const [state, action, pending] = useActionState(agregarNotaSubjetivaAction, VACIO);
  useFormToastAndRefresh(state);

  // AL GUARDAR SE VACIA EL CAMPO, con una `key` derivada de lo que el servidor YA guardo: cuando la nota
  // entra, la lista crece, el campo se remonta y sale limpio. Asi se vacia cuando la nota EXISTE, no
  // cuando la accion vuelve, y si el servidor rechaza el texto se queda donde estaba.
  return (
    <div className="flex flex-col gap-2 border-t border-dashed border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Anamnesis del profesional
      </p>
      {notas.map((n) => (
        <div key={n.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
          <p className="text-sm text-foreground">{n.texto}</p>
          <p className="text-[11px] text-muted-foreground">
            {n.autor}
            {n.profesion ? ` · ${n.profesion}` : ""} · {n.fecha}
          </p>
        </div>
      ))}
      {notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aquí va lo que el paciente contó en la consulta y no estaba en la encuesta.
        </p>
      ) : null}

      {puedeEscribir ? (
        <form onSubmit={enviarSinReset(action)} className="no-print flex flex-col gap-2 pt-1">
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <textarea
            key={`nota-${notas.length}`}
            name="nota"
            rows={3}
            required
            maxLength={4000}
            placeholder="Lo que refirió en consulta y no estaba en la encuesta"
            className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Agregar anamnesis"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Queda con tu nombre y no se puede borrar: si te corriges, escribe otra.
            </span>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function HistoriaClinicaSoapDoc({
  soap,
  fecha,
  evaluationId,
  notasSubjetivas,
  puedeEscribir,
}: {
  soap: HistoriaClinicaSoap;
  /** La fecha de la consulta ya formateada: el formato de fecha vive en un solo sitio y no es este. */
  fecha: string;
  evaluationId: string;
  notasSubjetivas: { id: string; texto: string; autor: string; profesion: string | null; fecha: string }[];
  puedeEscribir: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(soapATexto(soap, fecha));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // SIN AVISO DE ERROR A PROPOSITO: el portapapeles falla cuando el navegador no da permiso, y ahi no
      // hay nada que el profesional pueda hacer desde aqui. El documento sigue en pantalla para copiarlo
      // a mano, que es lo que hacia antes de que existiera este boton.
      setCopiado(false);
    }
  }

  const plan = soap.plan.nutricional;

  return (
    <div className="imprimible flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">Historia clínica en formato SOAP</h2>
          <p className="max-w-prose text-xs text-muted-foreground">
            Los mismos datos de la historia clínica, ordenados por acto clínico. La historia completa sigue
            donde estaba: esto no la reemplaza.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            {copiado ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
            {copiado ? "Copiada" : "Copiar"}
          </Button>
          {/* EL BOTON VA DENTRO DE LA HOJA, no fuera: `imprimirHoja` marca la hoja que lo CONTIENE, y
              desde fuera caeria en el respaldo (imprimir todo lo visible). Hoy en esta pantalla daria
              igual, porque solo hay una hoja montada; el dia que haya dos, no. */}
          <Button type="button" variant="outline" size="sm" onClick={(e) => imprimirHoja(e.currentTarget)}>
            <Printer className="size-4" aria-hidden />
            Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      {/* EL ENCABEZADO SALE SIEMPRE, tambien en pantalla: este documento se copia y se pega fuera de
          Atlas, asi que tiene que decir de quien es sin depender de la pagina que lo rodea. */}
      <div className="flex flex-col gap-0.5 border-b border-border pb-3">
        <p className="text-sm font-semibold text-foreground">{soap.paciente}</p>
        <p className="text-xs text-muted-foreground">
          {[soap.edad != null ? `${soap.edad} años` : null, soap.sexo].filter(Boolean).join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {soap.profesional} · {fecha}
        </p>
      </div>

      <Apartado letra="S" titulo="Subjetivo">
        {soap.subjetivo.motivos.length > 0 ? (
          <p>
            <span className="font-medium text-foreground">Motivo de consulta:</span>{" "}
            {soap.subjetivo.motivos.join(", ")}.
          </p>
        ) : null}
        {soap.subjetivo.antecedentes.map((a) => (
          <p key={a.grupo}>
            <span className="font-medium text-foreground">{a.grupo}:</span> {a.items.join(", ")}.
          </p>
        ))}
        {soap.subjetivo.encuesta.map((p) => (
          <p key={p.dominio}>
            <span className="font-medium text-foreground">{p.dominio}.</span> {p.texto}
          </p>
        ))}
        {soap.subjetivo.encuesta.length === 0 ? <p>La encuesta de esta consulta no tiene respuestas.</p> : null}
        <NotasSubjetivas
          evaluationId={evaluationId}
          notas={notasSubjetivas}
          puedeEscribir={puedeEscribir}
        />
      </Apartado>

      <Apartado letra="O" titulo="Objetivo">
        {soap.objetivo.pesoKg != null || soap.objetivo.tallaCm != null ? (
          <p>
            {[
              soap.objetivo.pesoKg != null ? `Peso: ${soap.objetivo.pesoKg} kg` : null,
              soap.objetivo.tallaCm != null ? `Talla: ${soap.objetivo.tallaCm} cm` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {soap.objetivo.composicion.map((c) => (
          <p key={c.clave}>
            <span className="font-medium text-foreground">{c.etiqueta}:</span> {c.valor}
            {c.clasificacion ? ` (${c.clasificacion})` : ""}
          </p>
        ))}
        {soap.objetivo.indices.length > 0 ? (
          <>
            <p className="font-medium text-foreground">Índices alterados</p>
            {soap.objetivo.indices.map((i) => (
              <p key={i.codigo}>
                {i.nombre}: {i.valor ?? "-"}
                {i.clasificacion ? ` (${i.clasificacion})` : ""}
                {i.referencia ? ` · referencia ${i.referencia}` : ""}
              </p>
            ))}
          </>
        ) : null}
      </Apartado>

      <Apartado letra="A" titulo="Análisis">
        {/* EL DEL PROFESIONAL VA PRIMERO: en un SOAP el analisis es de quien firma, y el del modelo es su
            respaldo. En la historia de Gildardo el orden es el contrario, y ahi tambien es correcto. */}
        {soap.analisis.resumenProfesional ? <p>{soap.analisis.resumenProfesional}</p> : null}
        {soap.analisis.dfiParrafo ? <p>{soap.analisis.dfiParrafo}</p> : null}
        {soap.analisis.metaTerapeutica ? (
          <p>
            <span className="font-medium text-foreground">Meta terapéutica:</span>{" "}
            {soap.analisis.metaTerapeutica}
          </p>
        ) : null}
        {soap.analisis.motivoSinNarrativa ? <p>{soap.analisis.motivoSinNarrativa}</p> : null}
        {soap.analisis.rutas.length > 0 ? (
          <p>
            <span className="font-medium text-foreground">Rutas de atención:</span>{" "}
            {soap.analisis.rutas.map((r) => r.label).join(", ")}.
          </p>
        ) : null}
      </Apartado>

      <Apartado letra="P" titulo="Plan">
        {soap.plan.objetivoModelo ? <p>{soap.plan.objetivoModelo}</p> : null}
        {soap.plan.objetivoTratamiento ? <p>{soap.plan.objetivoTratamiento}</p> : null}
        {plan ? (
          <p>
            {[
              plan.kcalObjetivo != null ? `Energía: ${plan.kcalObjetivo} kcal/día` : null,
              plan.proteinaG != null
                ? `Proteína: ${plan.proteinaG} g${plan.proteinaGKg != null ? ` (${plan.proteinaGKg} g/kg)` : ""}`
                : null,
              plan.carbohidratosG != null ? `Carbohidratos: ${plan.carbohidratosG} g` : null,
              plan.grasasG != null ? `Grasas: ${plan.grasasG} g` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {soap.plan.recomendaciones.map((r) => (
          <p key={r.titulo}>
            <span className="font-medium text-foreground">{r.titulo}:</span> {r.items.join("; ")}.
          </p>
        ))}
        {soap.plan.remisionesExigidas.length > 0 ? (
          <p>
            <span className="font-medium text-foreground">Remisiones indicadas por el modelo:</span>{" "}
            {soap.plan.remisionesExigidas
              .map((r) => `${r.destino} (${r.urgencia}${r.registrada ? ", registrada" : ", sin registrar"})`)
              .join("; ")}
            .
          </p>
        ) : null}
        {soap.plan.remisiones.length > 0 ? (
          <p>
            <span className="font-medium text-foreground">Remisiones registradas:</span>{" "}
            {soap.plan.remisiones.map((r) => `${r.profesion} (${r.estado})`).join("; ")}.
          </p>
        ) : null}
        {soap.plan.observaciones.map((ob) => (
          <p key={ob.creadaEn}>
            <span className="font-medium text-foreground">Observación ({ob.fecha}):</span> {ob.texto}
          </p>
        ))}
        {soap.plan.proximaCita ? (
          <p>
            <span className="font-medium text-foreground">Próxima consulta:</span> {soap.plan.proximaCita}
          </p>
        ) : null}
      </Apartado>

      {soap.prescripcionSinEmitir ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Las cifras del plan son las vigentes hoy: esta consulta todavía no tiene una emisión registrada,
          así que pueden cambiar.
        </p>
      ) : null}
    </div>
  );
}
