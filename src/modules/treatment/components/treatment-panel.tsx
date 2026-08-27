"use client";

import { startTransition, useActionState, useState } from "react";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
import { computeIntercambio, grupoSinPorcion } from "@/clinical-engine/intercambio";
import { DIAS_DEL_CICLO, diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import { AlimentosDelSubgrupo, ListaIntercambioPaciente } from "./lista-intercambio";
import { computeTiempos, TIEMPOS_DEF } from "@/clinical-engine/tiempos";
import { computeValidacion } from "@/clinical-engine/validacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import { useFormToast, useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";

import {
  addNoteAction,
  dismissMenuAllergenAlertAction,
  generateMenuAction,
  saveAdjustmentsAction,
  saveGuidelinesAction,
  saveIntercambioAction,
  saveMenuSemanalAction,
  saveTiemposAction,
  saveTiemposActivosAction,
  saveObjetivoAction,
  saveRestriccionesAction,
  type TreatmentActionState,
} from "../actions";
import { RealimentacionAlert } from "./realimentacion-alert";
import {
  adjustmentSignature,
  guidelinesSignature,
  intercambioSignature,
  objetivoSignature,
  restriccionesSignature,
  sectionKey,
  menuSemanalSignature,
  tiemposActivosSignature,
  tiemposSignature,
} from "../data/protocol-signature";
import type { IntercambioSaved, MenuSuggestion, TiemposSaved, TreatmentProtocol } from "../data/treatment-view-types";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// Panel del protocolo de tratamiento (B13), vista interna del profesional. Edita objetivos,
// nutraceuticos y guias, y agrega notas. Si el diagnostico no esta confirmado, la edicion
// se bloquea (gate de B13: el protocolo se autoriza tras aprobar el reporte).
// Peso meta (cadena calórica, pieza 1: HECHO VISIBLE — nota 3 de Gildardo). Hoy el peso sobre el que se
// calcula la prescripción sale del snapshot (pesoCalculo) y, si nadie lo fija, se usa sin decirlo. Aquí se
// MUESTRA con su fórmula (pesoCalculoLabel) y se deja FIJAR (adj_peso_meta, vía saveAdjustmentsAction). No
// cambia el modelo del cálculo (eso es pieza 2, el re-port): solo lo hace visible y editable, honesto sobre
// lo que hay. La key en el call-site (incluye adjPesoMeta) remonta al guardar, para que "fijado" se vea.
// Entrada <-> numero para los ajustes. "" = sin ajuste (usar el valor del modelo). Basura tecleada (NaN)
// tambien cuenta como sin ajuste, para que la vista previa no muestre NaN mientras el profesional escribe.
const numToInput = (n: number | null): string => (n != null ? String(n) : "");
const inputToNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
// Presentacion: un decimal para pesos/factores, entero para kcal/gramos. El calculo usa el valor completo.
const d1 = (n: number): string => String(Number(n.toFixed(1)));
const d0 = (n: number): string => String(Math.round(n));

// Un campo numerico de ajuste. Controlado (no lo resetea la prop `action` de React 19), con el valor del
// modelo como placeholder para que el profesional sepa sobre que esta ajustando.
function AdjInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-36"
      />
    </div>
  );
}

// Una fila de la vista previa (etiqueta + valor efectivo, con la derivacion entre parentesis). El `tag`
// distingue lo que el profesional FIJA de lo que sale CALCULADO (sub-tarea 3, cuidado b).
function PrevRow({
  label,
  value,
  detail,
  tag,
}: {
  label: string;
  value: string;
  detail?: string;
  tag?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1 last:border-0">
      <span className="flex items-baseline gap-1.5 text-muted-foreground">
        {label}
        {tag ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        ) : null}
      </span>
      <span className="text-foreground">
        <strong>{value}</strong>
        {detail ? <span className="text-muted-foreground"> {detail}</span> : null}
      </span>
    </div>
  );
}

// Pieza 2 de la cadena calorica: los seis ajustes del profesional sobre el sugerido (peso meta + GEB, PAL,
// objetivo kcal, proteina g/kg, grasa %) en UN solo form. Unificado a proposito: saveAdjustments escribe las
// seis columnas de golpe, asi que dos forms sobre la misma accion se borrarian mutuamente (perdida de dato,
// no fragilidad futura). La vista previa recalcula EN VIVO con computeProtocoloEfectivo, la MISMA funcion que
// el servidor sella al aprobar: lo que ve el profesional == lo que se guarda. La seccion se REMONTA cuando el
// servidor cambia un ajuste (key = adjustmentSignature en el padre), evitando el estado pegado.

// ── JERARQUIA VISUAL DEL PANEL (2026-08-27) ──────────────────────────────────────────────────────
//
// EL PROBLEMA QUE RESUELVE. Las doce secciones se separaban con el MISMO recurso repetido doce veces
// (`border-t border-border pt-6`): una linea horizontal identica entre cada par. Doce bloques del mismo
// peso visual, en fila, sin que nada dijera cual es la prescripcion y cual es el registro. En una
// pantalla de 1.900 lineas eso no es estetica: es que no se puede leer.
//
// POR QUE SUPERFICIES Y NO LINEAS. Una linea SEPARA pero no JERARQUIZA: dice "aqui termina una cosa y
// empieza otra", no "esta pesa mas". La superficie si, porque agrupa y eleva a la vez. Es lo que hace
// Polaris, que usa fondo claro para el contenido primario y fondo apagado para el secundario.
//
// POR QUE NO "UNA PREGUNTA POR PANTALLA", que es lo que SI aplicamos en el intake del paciente. GOV.UK
// lo separa explicitamente: esa regla es para servicios al publico, que la gente usa una vez y no
// conoce. Para interfaces de trabajo dicen lo contrario, y con estas palabras: "para interfaces de
// administracion puedes asumir que el personal conoce el proceso y optimizar para la VELOCIDAD. Eso
// probablemente significa poner MAS de una cosa por pantalla". El nutricionista vive en esta pantalla
// todos los dias; partirla en pasos le haria pagar navegacion en cada consulta.
//
// TRES NIVELES, y lo que decide en cual cae cada seccion NO es cuanto ocupa sino QUE ES:
//
//   PRESCRIPCION  Lo que el profesional DECIDE y queda sellado en el plan. Superficie elevada.
//   DERIVADO      Lo que el sistema CALCULA o propone a partir de esa decision. Superficie plana.
//   REGISTRO      Lo que se ESCRIBE y acompana al plan. Sin superficie, titulo menor.
//
// CUIDADO DELIBERADO CON "REGISTRO": baja el peso VISUAL, NO la importancia. Las restricciones
// alimentan el filtro del menu y las notas son documento clinico. Por eso el nivel 3 conserva el
// tamano de texto del cuerpo y su titulo sigue siendo un h3: lo que cambia es que no compite por la
// atencion, no que parezca opcional. Polaris usa el fondo apagado para "menos importante", y ese es
// justo el matiz que aqui NO queremos, asi que el nivel 3 se distingue por AUSENCIA de superficie y no
// por un gris que lo apague.
//
// LO QUE ESTO NO CAMBIA: ni una sola seccion se mueve de sitio, se funde, se parte ni cambia de
// contenido. El orden de las secciones 4 a 8 lo fijo Gildardo en su 8.4 y la jerarquia visual no lo
// toca; la Validacion sigue donde el la puso aunque sea derivada.
type NivelSeccion = "prescripcion" | "derivado" | "registro";

const NIVEL: Record<NivelSeccion, { wrapper: string; titulo: string }> = {
  prescripcion: {
    wrapper: "rounded-xl border border-border bg-card p-5 shadow-sm",
    titulo: "text-base font-semibold text-foreground",
  },
  derivado: {
    wrapper: "rounded-xl border border-border/60 bg-background p-5",
    titulo: "text-sm font-semibold text-foreground",
  },
  registro: {
    // Sin superficie a proposito (ver el cuidado de arriba): se distingue por no competir, no por
    // parecer secundario. Mantiene el tamano de texto del cuerpo.
    wrapper: "px-1 py-2",
    titulo: "text-sm font-semibold text-foreground",
  },
};

/**
 * Clases del envoltorio y del titulo de una seccion, por NIVEL. Se aplican a las `<section>` que ya
 * existen en vez de envolverlas: el cambio es de aspecto, no de estructura, y asi el diff no toca el
 * arbol de ningun formulario.
 */
const secCls = (n: NivelSeccion) => `flex flex-col gap-3 ${NIVEL[n].wrapper}`;
const tituloCls = (n: NivelSeccion) => NIVEL[n].titulo;

function CadenaCaloricaSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAdjustmentsAction, EMPTY);
  // RefreshOnSuccess (no useFormToast): esta seccion se REMONTA por su key (adjustmentSignature) al guardar;
  // con useFormToast + revalidate en la accion, el remonte corria contra el efecto y el aviso de exito se
  // perdia. Aqui el toast se dispara y LUEGO el refresh. En warning (stale) NO refresca: preserva la edicion.
  useFormToastRefreshOnSuccess(state);
  // useState-once desde la prop; el remonte (key del padre) re-deriva cuando el servidor cambia algo.
  const [pesoMeta, setPesoMeta] = useState(numToInput(protocol.adjPesoMeta));
  const [geb, setGeb] = useState(numToInput(protocol.adjGeb));
  const [pal, setPal] = useState(numToInput(protocol.adjPal));
  const [kcalObj, setKcalObj] = useState(numToInput(protocol.adjKcalObj));
  const [protGkg, setProtGkg] = useState(numToInput(protocol.adjProtGkg));
  const [fatPct, setFatPct] = useState(numToInput(protocol.adjFatPct));

  const snap = protocol.protocolSuggested;
  // Sin snapshot sellado (o sin cadena, o sin peso de calculo) no hay que ajustar: tratamiento pre-snapshot.
  if (!snap || protocol.pesoCalculo == null) return null;

  // Ajustes vivos (lo que hay en pantalla ahora) = exactamente lo que se guardara.
  const adj: ProtocoloAjustes = {
    geb: inputToNum(geb),
    pal: inputToNum(pal),
    kcalObj: inputToNum(kcalObj),
    protGkg: inputToNum(protGkg),
    fatPct: inputToNum(fatPct),
    pesoMeta: inputToNum(pesoMeta),
  };
  // MISMA funcion que sella el servidor: la vista previa no puede diverger de lo que se guarda (cuidado b).
  const cal = computeProtocoloEfectivo(snap, adj).calorico;
  const base = snap.calorico; // cadena del MODELO (sellada), placeholder de cada campo.
  const pesoEfectivo = adj.pesoMeta ?? protocol.pesoCalculo;
  const pesoFijado = protocol.adjPesoMeta != null;

  // Firma de los ajustes GUARDADOS (de la prop, invariante mientras se edita): es lo que el cliente cargó y
  // contra lo que el servidor compara bajo lock. NO la de lo que se esta editando.
  const baseSignature = adjustmentSignature({
    treatmentId: protocol.treatmentId,
    adjGeb: protocol.adjGeb,
    adjPal: protocol.adjPal,
    adjKcalObj: protocol.adjKcalObj,
    adjProtGkg: protocol.adjProtGkg,
    adjFatPct: protocol.adjFatPct,
    adjPesoMeta: protocol.adjPesoMeta,
  });

  const pesoCalcDisp = d1(protocol.pesoCalculo);

  // Reparto en kcal (sub-tarea 3). Cuadra EXACTO por construccion: choKcal = kcalObj - protKcal - fatKcal
  // (residuo, sin redondeo), asi que protKcal + fatKcal + choKcal == kcalObj SIEMPRE. Unico borde: si la
  // proteina + grasa que fija el profesional ya exceden el objetivo, choKcal se clampea a 0 y la suma pasa
  // el objetivo (senal clinica: no hay margen para carbohidratos). Los gramos van redondeados para la receta;
  // el cuadre se afirma sobre las kcal, no sobre gramos*factor (que pueden diferir por redondeo).
  const macrosKcal = cal.protKcal + cal.fatKcal + cal.choKcal;
  const proteinaGrasaExcedenObjetivo = cal.protKcal + cal.fatKcal > cal.kcalObj;
  const protPct = cal.kcalObj > 0 ? Math.round((cal.protKcal / cal.kcalObj) * 100) : 0;
  // El objetivo coincide con el GET cuando NO hay override y el deficit del modelo es 0 (decision de Gildardo:
  // el sistema no deriva el objetivo, deja mantenimiento). Se explica junto al numero para que la coincidencia
  // GET == objetivo no se lea como un error (fix 1: Santiago dudo, un nutricionista tambien).
  const objetivoEsMantenimiento = adj.kcalObj == null && cal.kcalObj === cal.get;

  return (
    <section className={secCls("prescripcion")}>
      <h3 className={tituloCls("prescripcion")}>Cadena calórica</h3>
      <p className="text-sm text-muted-foreground">
        {snap.estrategia.label}
        {snap.estrategia.perfil ? ` · ${snap.estrategia.perfil}` : ""}. El modelo sugiere la cadena a partir
        del BIS; puedes ajustar cualquier eslabón. La vista previa se recalcula en vivo con la misma fórmula
        que se sella al aprobar. Deja un campo vacío para usar el valor del modelo.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        {/* Firma de concurrencia: lo que el cliente cargó. Si otro profesional cambió la cadena, el servidor
            lo detecta bajo lock y rechaza sin pisar. */}
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <AdjInput
              name="adjPesoMeta"
              label="Peso meta (kg)"
              value={pesoMeta}
              onChange={setPesoMeta}
              placeholder={`calculado: ${pesoCalcDisp}`}
              step="0.1"
            />
            <AdjInput
              name="adjGeb"
              label="GEB (kcal)"
              value={geb}
              onChange={setGeb}
              placeholder={`modelo: ${d0(base.geb)}`}
              step="1"
            />
            <AdjInput
              name="adjPal"
              label="PAL (factor)"
              value={pal}
              onChange={setPal}
              placeholder={`modelo: ${base.pal}`}
              step="0.025"
            />
            <AdjInput
              name="adjKcalObj"
              label="Objetivo (kcal)"
              value={kcalObj}
              onChange={setKcalObj}
              placeholder={`modelo: ${d0(base.kcalObj)}`}
              step="1"
            />
            <AdjInput
              name="adjProtGkg"
              label="Proteína (g/kg)"
              value={protGkg}
              onChange={setProtGkg}
              placeholder={`modelo: ${base.protGKg}`}
              step="0.1"
            />
            <AdjInput
              name="adjFatPct"
              label="Grasa (%)"
              value={fatPct}
              onChange={setFatPct}
              placeholder={`modelo: ${base.fatPct}`}
              step="1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {pesoFijado ? (
              <span className="text-clinical-optimal">
                Peso meta fijado por ti: <strong>{d1(protocol.adjPesoMeta as number)} kg</strong>.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Peso meta sin registrar: se usa el calculado <strong>{pesoCalcDisp} kg</strong>
                {protocol.pesoCalculoLabel ? ` (${protocol.pesoCalculoLabel})` : ""}, un valor CALCULADO.
              </span>
            )}
            {/* Vacia el campo; al guardar con el campo vacio, adj_peso_meta queda null y el calculo usa el
                pesoCalculo COMPLETO (no el mostrado redondeado). */}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => setPesoMeta("")}
              disabled={locked}
              title="Vacía el campo; guarda para volver al peso calculado"
            >
              Usar el calculado ({pesoCalcDisp} kg)
            </button>
          </div>
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar ajustes"}
            </Button>
          </div>
        </fieldset>
      </form>
      {/* Vista previa EN VIVO: la cadena efectiva con lo que hay en pantalla, antes de guardar. */}
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cadena efectiva (vista previa)
        </p>
        <PrevRow label="Peso efectivo" value={`${d1(pesoEfectivo)} kg`} />
        <PrevRow
          label="Gasto energético basal (GEB)"
          value={`${d0(cal.geb)} kcal`}
          detail={`(${cal.formula})`}
        />
        <PrevRow label="Nivel de actividad física (PAL)" value={String(cal.pal)} />
        <PrevRow label="Gasto energético total (GET)" value={`${d0(cal.get)} kcal`} />
        <PrevRow
          label="Objetivo calórico"
          value={`${d0(cal.kcalObj)} kcal`}
          detail={
            objetivoEsMantenimiento
              ? "(= GET, mantenimiento: el modelo no aplica déficit; el objetivo lo defines tú)"
              : undefined
          }
        />
        {/* Biody reubicado aqui (checkpoint 2.4), aclarado: son DOS fuentes distintas de gasto. Santiago
            dudo al ver "medido 2590" al lado de la cadena que calcula otro numero. La base del plan es el
            CALCULADO (como el HTML); el medido queda como referencia del equipo. */}
        {protocol.kcalSugerido != null ? (
          <p className="pt-1 text-xs text-muted-foreground">
            El equipo (Biody) <strong>midió</strong> un gasto de {protocol.kcalSugerido} kcal; la cadena de
            arriba lo <strong>calcula</strong> por fórmula (GEB × actividad). Son dos fuentes distintas: la
            base del plan es el <strong>calculado</strong>, el medido queda como referencia.
          </p>
        ) : null}

        {/* Reparto de macronutrientes (sub-tarea 3). El profesional FIJA proteina y grasa; los carbohidratos
            salen del residuo (calculado). El tag lo hace explicito para que no crea que ajusta los tres. */}
        <p className="pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reparto de macronutrientes
        </p>
        <PrevRow
          label="Proteína"
          tag="la fijas tú (g/kg de peso)"
          value={`${d0(cal.protG)} g`}
          detail={`(${cal.protGKg} g/kg · ${protPct}% · ${d0(cal.protKcal)} kcal)`}
        />
        <PrevRow
          label="Grasa"
          tag="la fijas tú (% de las calorías)"
          value={`${d0(cal.fatG)} g`}
          detail={`(${cal.fatPct}% · ${d0(cal.fatKcal)} kcal)`}
        />
        <PrevRow
          label="Carbohidratos"
          tag="calculado (residuo)"
          value={`${d0(cal.choG)} g`}
          detail={`(${cal.choPct}% · ${d0(cal.choKcal)} kcal)`}
        />
        {/* Cuadre: la suma en kcal es exacta por construccion (== objetivo), salvo el borde de excedente. */}
        {proteinaGrasaExcedenObjetivo ? (
          <p className="mt-2 rounded-md border border-clinical-critical/40 bg-clinical-critical-bg px-2 py-1.5 text-xs text-clinical-critical">
            La proteína y la grasa que fijaste suman <strong>{d0(macrosKcal)} kcal</strong>, más que el
            objetivo ({d0(cal.kcalObj)} kcal). No queda margen para carbohidratos (0 g). Baja la proteína o la
            grasa, o sube el objetivo calórico.
          </p>
        ) : (
          <p className="mt-1 flex items-baseline justify-between gap-4 text-xs text-clinical-optimal">
            <span>Suma de los tres</span>
            <span>
              <strong>{d0(macrosKcal)} kcal</strong> = objetivo
            </span>
          </p>
        )}
      </div>
    </section>
  );
}


export function TreatmentPanel({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  // Bloqueado para editar si el diagnostico no esta confirmado O si el protocolo YA se aprobo (la
  // prescripcion aprobada es inmutable: el trigger de BD la congela; sin este candado el campo se veria
  // editable y el guardado chocaria contra el trigger). Se distinguen para dar el mensaje correcto.
  const diagnosisPending = !protocol.diagnosisConfirmed;
  const locked = diagnosisPending || protocol.approved;
  // Restricciones del MODELO (salida del motor, selladas write-once). Un tratamiento anterior al snapshot
  // no las tiene: lista vacia, no aviso.
  const snapRestricciones = protocol.protocolSuggested?.restricciones ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocolo de tratamiento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {diagnosisPending ? (
          <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
            El protocolo esta bloqueado porque el diagnostico aun no esta confirmado. Confirmalo en la
            pestana Diagnostico (el boton de confirmar esta al final de esa pagina); al confirmarlo se
            habilita editar y aprobar el tratamiento.
          </p>
        ) : protocol.approved ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Este protocolo ya fue aprobado: la prescripción es inmutable. Para cambiarla se corrige la
            evaluación (versión nueva de toda la cadena), no se edita aquí.
          </p>
        ) : null}
        {/* AGRUPACION (2026-08-22): dos bloques SEGUIDOS, sin nivel de navegacion nuevo (el orden natural es
            leer el caso y bajar a construir; no son dos modos alternativos, son dos momentos). Arriba LECTURA
            del diagnostico (resumen + meta, que rendriza el Panel server, + objetivo + guias + salud celular);
            una marca de bloque abajo abre el PLAN ALIMENTARIO. La marca es visual, NO un control. */}
        <ObjetivoSection
          key={sectionKey("objetivo", objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: protocol.objetivoTexto }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        <GuidelinesSection
          key={sectionKey(
            "guias",
            guidelinesSignature({
              treatmentId: protocol.treatmentId,
              guidelines: protocol.guidelines.map((g) => g.text),
            }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />

        {/* Marca de bloque: aqui empieza el PLAN ALIMENTARIO. Borde superior mas fuerte + titulo, distinto de
            los separadores de seccion (border-t simple), para que se vea donde termina la lectura y empieza el
            plan. No es navegacion: se sigue en un solo scroll. */}
        <div className="mt-4 border-t-2 border-foreground/20 pt-6">
          <h3 className="text-base font-bold text-foreground">Plan alimentario</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            La cadena calórica y su desarrollo: intercambio, restricciones y menú. Arriba está la lectura del
            diagnóstico.
          </p>
        </div>

        {/* Aviso ACCIONABLE de realimentacion (instruye: QUE hacer con las kcal), ENCIMA de la cadena, que es
            donde el nutricionista fija el objetivo calorico. La lectura informativa (QUE tiene el paciente) va
            en el resumen. Aqui no depende de la posicion de la cadena: se ancla al inicio del bloque del plan. */}
        {protocol.protocolSuggested?.alertaSindRealim ? (
          <RealimentacionAlert>
            Riesgo de síndrome de realimentación. Inicia con 10 kcal/kg/día y aumenta de forma gradual (ASPEN
            2023). Vigila fósforo, potasio, magnesio y tiamina; los exámenes críticos están en la vista del
            médico.
          </RealimentacionAlert>
        ) : null}

        {/* Restricciones del MODELO (porte fiel del v8, aviso al inicio de la Formula sintetica = nuestra
            cadena). Son las contraindicaciones por comorbilidad/fenotipo que calcula el motor (proteina,
            fosforo y potasio por IRC; sodio por HTA; CHO simples por DM; AGS y ultraprocesados por
            fenotipo), CON su referencia. Solo lectura: no son editables, son la salida del motor. Van
            ENCIMA de la cadena porque es lo que el nutricionista debe saber que excluir ANTES de armar el
            plan; hasta 2026-08-23 el motor las calculaba y nadie las veia mientras armaba (hueco clinico
            EN2 del barrido, COTEJOS_VISUALES). Distintas del campo de restricciones del PROFESIONAL, que
            vive junto al menu y es aditivo. */}
        {snapRestricciones.length > 0 ? (
          <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
            <p className="font-medium">Restricciones activas del modelo</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {snapRestricciones.map((r) => (
                <li key={r.nombre}>
                  {r.nombre}: {r.valor} <span className="opacity-80">({r.ref})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ORDEN DE GILDARDO (2026-08-24): la validacion va ARRIBA, antes de la formula. Su logica es fijar
            la meta, ver si el plan la cumple, ajustar y repartir; en un SEGUIMIENTO, que va a ser el caso
            frecuente, responde la primera pregunta del profesional. DERIVADA en vivo, solo lectura, no
            persiste (no puede desfasarse), asi que subirla no mueve ninguna firma ni ningun candado. */}
        <ValidacionSection protocol={protocol} />
        {/* key = firma de los seis ajustes: un cambio del servidor remonta la seccion (no queda pegada). */}
        <CadenaCaloricaSection
          key={sectionKey(
            "cadena",
            adjustmentSignature({
              treatmentId: protocol.treatmentId,
              adjGeb: protocol.adjGeb,
              adjPal: protocol.adjPal,
              adjKcalObj: protocol.adjKcalObj,
              adjProtGkg: protocol.adjProtGkg,
              adjFatPct: protocol.adjFatPct,
              adjPesoMeta: protocol.adjPesoMeta,
            }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Intercambio (CP1.2b): despues de la cadena, que le da el objetivo. key = firma del intercambio
            guardado: un cambio del servidor remonta y re-deriva las porciones (no queda pegado). */}
        <IntercambioSection
          key={sectionKey(
            "intercambio",
            intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: protocol.intercambioPorciones }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Tiempos de comida (CP2.3): seccion propia, MANDAN sobre la distribucion y sobre el menu. Va antes
            de las dos, que es el orden en que se decide. key = su propia firma.
            DIVERGENCIA DELIBERADA de su orden (2026-08-24): el los pone DESPUES de la tabla de distribucion.
            Como gobiernan el reparto, ponerlos despues obliga a subir a corregir. Reportado en la ronda. */}
        <TiemposActivosSection
          key={sectionKey(
            "tiempos-activos",
            tiemposActivosSignature({ treatmentId: protocol.treatmentId, activos: protocol.tiemposActivos }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Distribucion (CP2.2b): despues del intercambio, que le da las porciones. key = firma de tiempos (remonta). */}
        <TiemposSection
          key={sectionKey("tiempos", tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: protocol.tiempos }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* La lista que se lleva el paciente. Va aqui, despues de la validacion y antes del menu, igual que
            en el v8 (su seccion E precede a la F). No depende del protocolo: es la tabla completa, la misma
            para todos; lo que cambia por paciente son las PORCIONES, que estan arriba. */}
        <ListaIntercambioPaciente />
        {/* Menu semanal (CP4). key = firma del menu guardado (remonte, como las demas secciones). */}
        <MenuSemanalSection
          key={sectionKey("menu-semanal", menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: protocol.menuSemanal }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Restricciones JUNTO al menu (checkpoint 2.4): son su insumo; que se lea que lo que se marca aqui
            cambia lo que genera el menu. key = firma de las restricciones (remonte). */}
        <RestriccionesSection
          key={sectionKey(
            "restricciones",
            restriccionesSignature({
              treatmentId: protocol.treatmentId,
              restricciones: protocol.restricciones,
            }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        <MenuSection evaluationId={evaluationId} protocol={protocol} locked={locked} />
        <NotesSection evaluationId={evaluationId} protocol={protocol} locked={locked} />
      </CardContent>
    </Card>
  );
}

// Etiqueta y color del estado de una sugerencia de IA (accesible: etiqueta ademas de color).
const MENU_STATUS: Record<string, { label: string; cls: string }> = {
  success: { label: "Generado", cls: "bg-clinical-optimal-bg text-clinical-optimal" },
  timeout: { label: "Timeout", cls: "bg-clinical-warning-bg text-clinical-warning" },
  provider_error: { label: "Error del proveedor", cls: "bg-clinical-critical-bg text-clinical-critical" },
  parse_failed: { label: "Respuesta inválida", cls: "bg-clinical-critical-bg text-clinical-critical" },
};

function MenuSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(generateMenuAction, EMPTY);
  useFormToast(state);

  // El menu se genera contra el objetivo de la CADENA CALORICA (fuente unica; el input manual de objetivo
  // se retiro en el checkpoint 2). Basta con que el protocolo este calculado (snapshot sellado); sin el no
  // hay cadena que computar.
  const cadenaLista = protocol.protocolSuggested != null;
  const disabled = locked || pending || !cadenaLista;

  return (
    <div className={secCls("derivado")}>
      <h3 className={tituloCls("derivado")}>Menú sugerido (IA)</h3>
      {/* QUE MIRA LA IA: se escribe lo que el contrato del prompt REALMENTE lleva (menu.v2.ts), no lo que
          suena bien. Hoy son siete campos: objetivo calórico, proteína objetivo, las restricciones del
          modelo, las del profesional, fenotipo estructural, sector funcional y rutas. NO viaja ninguna
          respuesta cruda de la encuesta, ni el peso, ni los macros de grasa y CHO. Si el contrato cambia,
          este texto cambia con el: un texto que describe mal el motor es un defecto de seguridad. */}
      <p className="max-w-prose text-sm text-muted-foreground">
        Propone un menú de <strong>un día</strong> a partir de las restricciones del paciente (las del modelo
        y las tuyas), su objetivo de calorías y proteína, y su fenotipo, sector funcional y rutas. No lee las
        respuestas de la encuesta. Es un borrador para que lo revises: no se aplica al protocolo ni toca la
        tabla de arriba. El diagnóstico no usa IA.
      </p>
      <form action={formAction}>
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Button type="submit" variant="outline" disabled={disabled}>
          {pending ? "Generando..." : "Generar menu"}
        </Button>
        {!cadenaLista && !locked ? (
          <p className="pt-2 text-xs text-muted-foreground">
            El protocolo aún no está calculado; no se puede generar el menú.
          </p>
        ) : null}
      </form>

      {protocol.menuSuggestions.length ? (
        <ul className="flex flex-col gap-3">
          {protocol.menuSuggestions.map((m) => (
            <MenuCard key={m.id} suggestion={m} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Descarte del aviso de alergeno. El motivo es obligatorio (minimo 10 caracteres, validado tambien en el
// servidor): un campo que se llena con "ok" no sirve de traza. Lo que se escribe va a clinical_audit_log,
// no a un campo que nadie lee.
function DismissAllergenForm({ suggestionId }: { suggestionId: string }) {
  const [state, formAction, pending] = useActionState(dismissMenuAllergenAlertAction, EMPTY);
  // Refresca en success para que la tarjeta re-derive del servidor y aparezca el descarte; en error NO,
  // que preserva lo escrito. El toast va antes del refresh (misma razon que en el resto del panel).
  useFormToastRefreshOnSuccess(state);
  // NO se usa la prop `action`: en React 19 resetea los inputs no controlados tras la accion, asi que un
  // motivo rechazado por corto borraria lo que el profesional acababa de escribir (hazard 2 de CLAUDE.md).
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => formAction(datos));
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <label htmlFor={`motivo-${suggestionId}`} className="text-xs font-medium text-foreground">
        Motivo del descarte
      </label>
      <textarea
        id={`motivo-${suggestionId}`}
        name="reason"
        rows={2}
        minLength={10}
        maxLength={300}
        required
        placeholder="Por qué el alérgeno señalado no aplica a este menú"
        className="rounded border border-border bg-surface p-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border border-border px-3 py-1 text-xs font-medium text-foreground disabled:opacity-50"
      >
        {pending ? "Registrando..." : "Descartar el aviso"}
      </button>
    </form>
  );
}

function MenuCard({ suggestion: m }: { suggestion: MenuSuggestion }) {
  const status = MENU_STATUS[m.status] ?? { label: m.status, cls: "bg-muted text-muted-foreground" };
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge className={status.cls}>{status.label}</Badge>
        <span>
          {m.provider} · {m.model}
        </span>
        {m.latencyMs != null ? <span>· {m.latencyMs} ms</span> : null}
        <span>· {formatDateTime(m.generatedAt)}</span>
        <span>· prompt {m.promptVersion}</span>
      </div>
      {/* AVISO DE ALERGENO, arriba del menu y no al pie: si va debajo, se lee despues de haber leido el
          menu, que es justo cuando ya no sirve. Dice QUE alergeno, en QUE comida y en QUE alimento,
          para que el profesional lo verifique de un vistazo sin releer. */}
      {m.alergenosDetectados != null && m.alergenosDetectados.length > 0 ? (
        <div className="rounded-md border border-clinical-critical bg-clinical-critical-bg p-3">
          <p className="text-sm font-semibold text-clinical-critical">
            Este menú contiene un alimento al que el paciente declaró alergia o intolerancia.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {m.alergenosDetectados.map((h, i) => (
              <li key={`${h.alergeno}-${h.tiempo}-${i}`} className="text-sm text-clinical-critical">
                <strong>{h.alergeno}</strong> en {h.tiempo}: {h.alimento}
              </li>
            ))}
          </ul>
          {m.alergenoDescartado ? (
            // El aviso NO desaparece al descartarlo: la fila es inmutable y el hallazgo queda. Lo que se
            // agrega es QUIEN dijo que estaba bien y POR QUE. Descartar es "lo miré y está bien", no
            // "no pasó nada".
            <div className="mt-3 rounded border border-border bg-surface p-2">
              <p className="text-xs font-semibold text-foreground">Revisado y descartado</p>
              <p className="text-xs text-muted-foreground">
                {m.alergenoDescartado.porEmail} · {formatDateTime(m.alergenoDescartado.en)}
              </p>
              <p className="mt-1 text-xs text-foreground">{m.alergenoDescartado.motivo}</p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-xs text-clinical-critical">
                No lo entregues así. Genera el menú de nuevo, o descarta el aviso explicando por qué la
                coincidencia no aplica. Lo que escribas queda registrado.
              </p>
              <DismissAllergenForm suggestionId={m.id} />
            </>
          )}
        </div>
      ) : null}

      {/* PATRON ALIMENTARIO: mismo mecanismo, otra consecuencia. Avisa, no bloquea, porque la lista de
          lo que excluye un patron es ABIERTA (un vegano no excluye "pollo", excluye todo lo animal) y
          este cruce encuentra lo evidente sin poder prometer completitud. Un menu que se salta el patron
          es un plan que el paciente no va a seguir, no uno que lo lastima. */}
      {m.patronConflictos != null && m.patronConflictos.length > 0 ? (
        <div className="rounded-md border border-clinical-warning bg-clinical-warning-bg p-3">
          <p className="text-sm font-semibold text-clinical-warning">
            Este menú no respeta el patrón alimentario que declaró el paciente.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {m.patronConflictos.map((c, i) => (
              <li key={`${c.patron}-${c.tiempo}-${i}`} className="text-sm text-clinical-warning">
                <strong>{c.patron}</strong> en {c.tiempo}: {c.alimento}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* "No se pudo revisar" NO es lo mismo que "revisado y limpio", y la pantalla no los puede
          confundir: una sugerencia vieja (prosa, sin cruce posible) no debe leerse como segura. */}
      {m.alergenosDetectados == null && m.generatedText ? (
        <p className="text-xs text-clinical-warning">
          Menú sin revisión automática de alérgenos. Revísalo contra las alergias del paciente.
        </p>
      ) : null}

      {m.menuJson ? (
        <div className="flex flex-col gap-2">
          {m.menuJson.comidas.map((c) => (
            <div key={c.tiempo}>
              <p className="text-sm font-semibold text-foreground">{c.tiempo}</p>
              <ul className="ml-4 list-disc">
                {c.alimentos.map((a, i) => (
                  <li key={`${c.tiempo}-${a.nombre}-${i}`} className="text-sm text-foreground">
                    {a.nombre}
                    {a.porcion ? <span className="text-muted-foreground"> · {a.porcion}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : m.generatedText ? (
        // Sugerencias de la v2: prosa. Se siguen mostrando como estaban.
        <div className="text-sm text-foreground">
          <Markdown text={m.generatedText} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin contenido (el intento fallo).</p>
      )}
    </li>
  );
}

// Restricciones alimentarias (checkpoint 2.4): seccion propia, JUNTO al menu (son su insumo). Guardado
// propio con candado y firma de remonte (saveRestriccionesAction), como la cadena/nutraceuticos.
function RestriccionesSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveRestriccionesAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [restricciones, setRestricciones] = useState<string[]>(protocol.restricciones);
  const [restrInput, setRestrInput] = useState("");
  const addRestriccion = () => {
    const v = restrInput.trim();
    if (v && !restricciones.includes(v)) setRestricciones([...restricciones, v]);
    setRestrInput("");
  };
  const baseSignature = restriccionesSignature({
    treatmentId: protocol.treatmentId,
    restricciones: protocol.restricciones,
  });

  return (
    <section className={secCls("prescripcion")}>
      <h3 className={tituloCls("prescripcion")}>Restricciones alimentarias del profesional</h3>
      <p className="text-sm text-muted-foreground">
        Lo que marques aquí condiciona el <strong>menú de abajo</strong>: la IA lo genera excluyendo estos
        alimentos o nutrientes. Guárdalas antes de generar el menú.
      </p>
      {/* Desambiguacion: hay DOS cosas llamadas restricciones (las del modelo, por comorbilidad, arriba de
          la cadena; y estas, del profesional). Las dos van al menu, en bloques separados del prompt. Decirlo
          aqui evita que este campo se lea como "todas las restricciones del paciente". */}
      <p className="text-sm text-muted-foreground">
        Son <strong>adicionales</strong> a las restricciones del modelo (las de arriba, por comorbilidad y
        fenotipo): esas no se editan y ya condicionan el menú por su cuenta.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="restricciones" value={JSON.stringify(restricciones)} />
        <fieldset disabled={locked} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={restrInput}
              onChange={(e) => setRestrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRestriccion();
                }
              }}
              placeholder="ej. sin gluten"
            />
            <Button type="button" variant="outline" onClick={addRestriccion}>
              Agregar
            </Button>
          </div>
          {restricciones.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {restricciones.map((r) => (
                <Badge key={r} variant="outline" className="gap-1">
                  {r}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setRestricciones(restricciones.filter((x) => x !== r))}
                    aria-label={`Quitar ${r}`}
                  >
                    x
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar restricciones"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Objetivo del tratamiento nutricional (pieza 1): lo que el profesional ESCRIBE sobre el plan (el objetivo /
// tipo de dieta), distinto de las guias (que son una lista). Un textarea con su guardado propio. En 1a.3 se
// le antepone el encabezado generado "Dieta ... de X kcal/dia" (de la cadena) y va arriba, antes de la formula.
function ObjetivoSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveObjetivoAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [objetivo, setObjetivo] = useState(protocol.objetivoTexto ?? "");
  const baseSignature = objetivoSignature({
    treatmentId: protocol.treatmentId,
    objetivo: protocol.objetivoTexto,
  });

  return (
    <section className={secCls("prescripcion")}>
      <h3 className={tituloCls("prescripcion")}>Objetivo del tratamiento nutricional</h3>
      <p className="text-sm text-muted-foreground">
        El objetivo o tipo de dieta que defines para este paciente, en tus palabras. Es distinto de las guías
        (que son una lista de indicaciones puntuales).
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <fieldset disabled={locked} className="flex flex-col gap-2">
          <Textarea
            name="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="ej. Dieta antiinflamatoria con proteína alta por sexo, para desacelerar el envejecimiento biológico."
            rows={3}
            maxLength={4000}
          />
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar objetivo"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Lista de intercambio (CP1.2b): tabla de 12 grupos con porciones editables, recompute en vivo del total, y
// (DIV-11) aviso de desfase cuando el objetivo cambio desde que se guardaron. El desplegable de alimento es
// de solo lectura por ahora (muestra el alimento por defecto del grupo; cambiarlo se cabla despues).
function IntercambioSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveIntercambioAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const snap = protocol.protocolSuggested;
  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    pesoMeta: protocol.adjPesoMeta,
  };
  // Objetivo efectivo desde los ajustes GUARDADOS (misma fuente que la cadena): base estable del intercambio.
  const objetivoEfectivo = snap ? Math.round(computeProtocoloEfectivo(snap, adjGuardados).calorico.kcalObj) : null;
  const defaults = objetivoEfectivo != null ? computeIntercambio(objetivoEfectivo) : [];
  const saved = protocol.intercambioPorciones;

  // useState-once (POR ALIMENTO): porciones guardadas por sub si existen, si no las calculadas. El remonte (key
  // del padre) re-deriva. Se inicializan los 21 alimentos (el que no tiene default arranca en 0).
  const [porciones, setPorciones] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const a of defaults) init[a.sub] = saved?.porciones[a.sub] ?? a.porciones;
    return init;
  });

  if (!snap || protocol.pesoCalculo == null || objetivoEfectivo == null) return null;

  const desfase = saved != null && saved.objetivoBase !== objetivoEfectivo;
  const totalKcal = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.kcal, 0);
  // Macros del reparto (porte fiel del v8: columnas kcal/porcion, kcal, proteina, CHO y grasa por alimento,
  // mas la fila TOTAL). No es calculo nuevo: INTER_TABLA_A ya trae los 26 nutrientes por porcion, portados
  // verbatim con candado de transcripcion; aqui solo se multiplica por las porciones. La ADECUACION real
  // (contra la necesidad de cada nutriente) sigue viviendo en la validacion, mas abajo: esta tabla dice
  // cuanto APORTA lo repartido, no si alcanza.
  const totalProt = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.prot, 0);
  const totalCho = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.cho, 0);
  const totalGras = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.gras, 0);
  const setP = (sub: string, v: number) => setPorciones((p) => ({ ...p, [sub]: Math.max(0, v) }));

  // Lo que se guarda: las porciones POR ALIMENTO en pantalla + el objetivo con el que se calcularon
  // (objetivoBase, DIV-11). Se serializan los 21 alimentos (contexto completo del desfase).
  const payload: IntercambioSaved = {
    objetivoBase: objetivoEfectivo,
    porciones: Object.fromEntries(defaults.map((a) => [a.sub, porciones[a.sub] ?? 0])),
  };
  const baseSignature = intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: saved });

  return (
    <section className={secCls("prescripcion")}>
      <h3 className={tituloCls("prescripcion")}>Lista de intercambio U de A · ICBF 2025</h3>
      <p className="text-sm text-muted-foreground">
        Porciones por alimento para cubrir el objetivo calórico ({objetivoEfectivo} kcal). El auto-llenado
        sugiere un alimento representativo por grupo; puedes repartir dentro de un grupo (por ejemplo dos de
        leche entera y una descremada). El total se recalcula abajo.
      </p>

      {desfase ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          Estas porciones se calcularon para {saved!.objetivoBase} kcal, pero el objetivo ahora es{" "}
          {objetivoEfectivo} kcal. Puedes seguir con tus ajustes o recalcular desde el objetivo actual (perderás
          los ajustes manuales).
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="intercambio" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Alimento</th>
                  <th className="py-1 pr-3 text-right font-medium">kcal/porción</th>
                  <th className="py-1 pr-3 text-right font-medium">Porciones</th>
                  <th className="py-1 pr-3 text-right font-medium">kcal</th>
                  <th className="py-1 pr-3 text-right font-medium">Proteína (g)</th>
                  <th className="py-1 pr-3 text-right font-medium">CHO (g)</th>
                  <th className="py-1 pr-3 text-right font-medium">Grasa (g)</th>
                  <th className="py-1 font-medium">Alimentos</th>
                </tr>
              </thead>
              <tbody>
                {/* 21 alimentos agrupados por los 12 grupos: una fila de encabezado por grupo (cuando cambia
                    el grupo del alimento anterior) y luego sus alimentos. El aviso de grupo nuclear sin
                    porciones (DIV-10) va en el encabezado, sobre la SUMA del grupo. */}
                {defaults.flatMap((a, i) => {
                  const nuevoGrupo = i === 0 || defaults[i - 1].gr !== a.gr;
                  const n = porciones[a.sub] ?? 0;
                  const filas = [] as React.ReactNode[];
                  if (nuevoGrupo) {
                    const sinPorcion = grupoSinPorcion(a.gr, porciones);
                    filas.push(
                      <tr key={`g-${a.gr}`} className="bg-muted/40">
                        <td colSpan={8} className="py-1 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {a.grNom}
                          {sinPorcion ? (
                            <span className="ml-2 font-normal normal-case text-clinical-warning" title="Grupo base sin porciones: el objetivo puede ser muy bajo">
                              sin porciones
                            </span>
                          ) : null}
                        </td>
                      </tr>,
                    );
                  }
                  filas.push(
                    <tr key={a.sub} className="border-b border-border/50">
                      <td className="py-1.5 pl-3 pr-3 text-foreground">{a.sub}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{a.kcal}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          value={n}
                          onChange={(e) => setP(a.sub, Math.round(Number(e.target.value) || 0))}
                          className="w-16 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-foreground">
                        {Math.round(n * a.kcal)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.prot).toFixed(1)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.cho).toFixed(1)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.gras).toFixed(1)}
                      </td>
                      {/* Alimentos concretos, PLEGADOS (porte fiel del v8). El plegado no es decoracion: el
                          primer subgrupo tiene 39 alimentos y desplegados romperian la tabla. Es referencia,
                          NO edita el calculo: el intercambio se cuenta por PORCIONES del subgrupo, y que
                          alimento se elija dentro del subgrupo es del paciente. */}
                      <td className="py-1.5">
                        <AlimentosDelSubgrupo sub={a.sub} />
                      </td>
                    </tr>,
                  );
                  return filas;
                })}
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td className="py-2" colSpan={3}>
                    Total
                  </td>
                  {/* El total de kcal dice contra QUE se compara (objetivo): las porciones enteras lo aproximan,
                      no lo igualan, asi que los dos numeros conviven sin confundir. Los macros NO llevan su
                      objetivo al lado a proposito: su adecuacion es la tabla de validacion, que ademas la
                      colorea; repetir aqui un segundo juicio invitaria a leer dos veredictos distintos. */}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {Math.round(totalKcal)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      objetivo {objetivoEfectivo}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalProt.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalCho.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalGras.toFixed(1)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          {/* Linea de causa (no opcional): un total por debajo del objetivo sin explicacion hace dudar del
              calculo (le paso a Santiago). La brecha puede ser ~7% en objetivos altos, por la regla de verduras. */}
          <p className="text-xs text-muted-foreground">
            Las porciones enteras aproximan el objetivo, no lo igualan; las verduras se fijan en 2 porciones. La
            adecuación real por nutriente se ve en la validación, más abajo.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar intercambio"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setPorciones(Object.fromEntries(defaults.map((a) => [a.sub, a.porciones])))}
            >
              Recalcular desde el objetivo (borra tus ajustes)
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// MENU SEMANAL (CP4, porte de la seccion F del v8): grilla 7 dias x tiempos ACTIVOS, una celda de texto
// editable por comida, precargada desde el ciclo de 21 dias.
//
// LA SEMILLA. El v8 arranca el ciclo en un dia ALEATORIO y puede permitirselo porque su menu es transitorio
// (localStorage, se recalcula al recargar). Aqui el plan se GUARDA, y un menu que cambia al recargar no es
// un plan. Dos capas: antes del primer guardado el arranque se DERIVA del treatmentId (determinista, sin
// parpadeo, y distinto entre evaluaciones del mismo paciente, para no repetirle la semana en el
// seguimiento); al guardar se PERSISTE, y desde ahi queda congelado aunque un dia cambiemos la derivacion.
// El boton de cambiar la semana base si puede usar azar: al ser una accion del profesional, el resultado se
// guarda y deja de ser azaroso.
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function MenuSemanalSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveMenuSemanalAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const saved = protocol.menuSemanal;
  const [diaInicio, setDiaInicio] = useState<number>(() => saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId));
  const [celdas, setCeldas] = useState<Record<string, string>>(() => saved?.celdas ?? {});

  // Los tiempos ACTIVOS son los GUARDADOS, los mismos que manda la seccion de tiempos: el plan es uno solo.
  const activos = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;
  const vivos = TIEMPOS_DEF.filter((t) => activos[t.id]);

  // Texto de una celda: lo que el profesional escribio, o la precarga del ciclo. El ciclo NO trae merienda:
  // esa columna queda vacia y la UI dice por que (un blanco sin explicacion se lee como fallo).
  const precarga = (dia: number, tiempo: string): string => {
    const delCiclo = diaDelCiclo(diaInicio, dia) as unknown as Record<string, string | undefined>;
    return delCiclo[tiempo] ?? "";
  };
  const valor = (dia: number, tiempo: string): string => celdas[`${dia}_${tiempo}`] ?? precarga(dia, tiempo);
  const sinCiclo = vivos.filter((t) => !(diaDelCiclo(diaInicio, 0) as unknown as Record<string, unknown>)[t.id]);

  const setCelda = (dia: number, tiempo: string, v: string) =>
    setCeldas((c) => ({ ...c, [`${dia}_${tiempo}`]: v }));

  // Lo que se guarda: SOLO lo que difiere de la precarga. Asi la precarga no se congela: si mañana el
  // profesional cambia la semana base, las celdas que no toco siguen el ciclo nuevo.
  const payload = {
    diaInicio,
    celdas: Object.fromEntries(
      Object.entries(celdas).filter(([k, v]) => {
        const [d, ...resto] = k.split("_");
        return v !== precarga(Number(d), resto.join("_"));
      }),
    ),
  };
  const baseSignature = menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: protocol.menuSemanal });
  // Una celda esta EDITADA si difiere de lo que propone el ciclo. Es la misma comparacion que decide que se
  // guarda, asi que no puede desincronizarse del payload.
  const editada = (dia: number, tiempo: string) => valor(dia, tiempo) !== precarga(dia, tiempo);
  const hayEdiciones = DIAS_SEMANA.some((_, d) => vivos.some((t) => editada(d, t.id)));
  // La semana propuesta aun no esta guardada: si recarga, vuelve la anterior. Se avisa (Santiago perdio el
  // menu varias veces por esto).
  const semanaSinGuardar = diaInicio !== (saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId));
  // Devuelve una celda al ciclo: se BORRA el override, no se escribe el texto del ciclo. Asi la celda vuelve
  // a seguir el ciclo tambien cuando se proponga otra semana; escribir el texto la dejaria fija otra vez.
  const volverAlCiclo = (dia: number, tiempo: string) =>
    setCeldas((c) => {
      const resto = { ...c };
      delete resto[`${dia}_${tiempo}`];
      return resto;
    });

  return (
    <section className={secCls("derivado")}>
      <h3 className={tituloCls("derivado")}>Menú semanal</h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        Una semana de menús colombianos, precargada desde el ciclo de {DIAS_DEL_CICLO} días. Es un punto de
        partida editable, no una prescripción: cambia lo que quieras y guarda. Las columnas son los tiempos
        de comida que aplicaste arriba.
      </p>
      {sinCiclo.length > 0 ? (
        <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          El ciclo base no trae {sinCiclo.map((t) => t.n.toLowerCase()).join(" ni ")}: esa columna queda
          vacía y la escribes tú.
        </p>
      ) : null}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="menu" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Día</th>
                  {vivos.map((t) => (
                    <th key={t.id} className="py-1 pr-3 font-medium">
                      {t.n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((nombre, dia) => (
                  <tr key={nombre} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{nombre}</td>
                    {vivos.map((t) => (
                      <td key={t.id} className="py-1.5 pr-3">
                        <textarea
                          rows={3}
                          value={valor(dia, t.id)}
                          onChange={(e) => setCelda(dia, t.id, e.target.value)}
                          className="w-full min-w-48 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        {/* Solo en las celdas EDITADAS: sin esto, una celda tocada por error queda fija para
                            siempre y ninguna semana nueva vuelve a tocarla. Era una trampa, no una falta. */}
                        {editada(dia, t.id) ? (
                          <button
                            type="button"
                            onClick={() => volverAlCiclo(dia, t.id)}
                            className="mt-0.5 text-xs text-muted-foreground underline hover:text-foreground"
                          >
                            Volver al menú del ciclo
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar menú"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                // Azar en una ACCION del profesional: el resultado se guarda, asi que deja de ser azaroso.
                // Se avanza a un dia DISTINTO del actual para que el boton siempre haga algo visible.
                setDiaInicio((d) => (d + 1 + Math.floor(Math.random() * (DIAS_DEL_CICLO - 1))) % DIAS_DEL_CICLO);
              }}
            >
              Proponer otra semana
            </Button>
            {hayEdiciones ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setCeldas({})}>
                Descartar mis ediciones
              </Button>
            ) : null}
          </div>
          {/* Que hace cada boton, en una linea. Sin esto "Proponer otra semana" y "Generar menu con IA"
              (mas abajo) se confunden, y hacen cosas muy distintas. */}
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Proponer otra semana:</span> propone otra
              combinación del menú base, sin mirar al paciente ni usar IA. Respeta las celdas que ya editaste.
            </p>
            {hayEdiciones ? (
              <p>
                <span className="font-medium text-foreground">Descartar mis ediciones:</span> devuelve todas
                las celdas al menú del ciclo. Para una sola, usa el enlace debajo de esa celda.
              </p>
            ) : null}
          </div>
          {semanaSinGuardar ? (
            <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              Semana nueva propuesta, sin guardar todavía. Si recargas, vuelve la anterior: pulsa
              &quot;Guardar menú&quot; para dejarla fija.
            </p>
          ) : null}
        </fieldset>
      </form>
    </section>
  );
}

// TIEMPOS DE COMIDA (CP2.3): seccion propia, columna propia, guardado propio. Se partio de la distribucion
// el 2026-08-23 con el argumento de Santiago: el MENU tambien depende de estas casillas y esta en su propio
// contenedor, asi que la dependencia no justificaba agruparlas con la tabla; lo que las unia era nuestro
// jsonb, no el modelo. Y en el prototipo de Gildardo ya viven aparte (`atlas:plan`, junto al menu semanal;
// la distribucion vive en `atlas:plan_inter`), asi que partirlas es MAS fiel, no menos.
//
// NO reaccionan en vivo: son una decision CLINICA (definen la estructura del dia del paciente) y mandan
// sobre la tabla Y sobre el menu. Con reaccion en vivo, tantear marcando reconstruiria las dos en cada clic.
function TiemposActivosSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTiemposActivosAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const guardados = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;
  const [activos, setActivos] = useState<Record<string, boolean>>(() => guardados);
  const sinAplicar = TIEMPOS_DEF.some((t) => Boolean(activos[t.id]) !== Boolean(guardados[t.id]));
  const baseSignature = tiemposActivosSignature({
    treatmentId: protocol.treatmentId,
    activos: protocol.tiemposActivos,
  });

  // DIV-13: al menos uno activo. Se impide en el cliente y lo revalida el schema.
  const toggle = (mid: string) =>
    setActivos((a) => {
      const activosCount = TIEMPOS_DEF.filter((t) => a[t.id]).length;
      if (a[mid] && activosCount <= 1) return a;
      return { ...a, [mid]: !a[mid] };
    });

  // DIV-13: al menos uno activo. Se impide en el cliente y lo revalida el schema.

  return (
    <section className={secCls("prescripcion")}>
      <h3 className={tituloCls("prescripcion")}>Tiempos de comida</h3>
      {/* Se dice aqui lo que la seccion GOBIERNA, porque es lo que explica por que va antes y por que es
          una decision y no un ajuste. Sin esto, su titulo y el de la distribucion competian. */}
      <p className="text-xs text-muted-foreground">
        Qué comidas hace el paciente. Gobiernan el reparto de porciones y el menú.
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Definen la estructura del día del paciente. Mandan sobre las dos tablas de abajo: la distribución
        reparte dentro de los tiempos que dejes activos, y el menú semanal usa esos mismos tiempos como
        columnas. Por eso se aplican con un paso propio y no cambian mientras marcas.
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="activos" value={JSON.stringify(activos)} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {TIEMPOS_DEF.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm text-foreground">
                <input type="checkbox" checked={Boolean(activos[t.id])} onChange={() => toggle(t.id)} />
                {t.n}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Aplicando..." : "Aplicar tiempos de comida"}
            </Button>
            {sinAplicar ? (
              <span className="text-xs text-clinical-warning">
                Cambiaste los tiempos y aún no los has aplicado: la distribución y el menú siguen mostrando
                los anteriores.
              </span>
            ) : null}
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Distribucion por tiempos (CP2.2b): reparte las porciones del intercambio (CP1) por tiempo de comida. Filas =
// grupos con porciones > 0; columnas = tiempos ACTIVOS. Celdas editables (override sobre el auto). Toggles de
// tiempos activos con recompute en vivo. Aviso de desfase DOBLE (por porciones y por activos) sin borrar los
// overrides (DIV-11); los overrides de comidas apagadas se conservan ocultos (apagar suele ser exploratorio).
const TIEMPOS_ACTIVOS_DEFAULT: Record<string, boolean> = {
  desayuno: true,
  mediasOnces: true,
  almuerzo: true,
  algo: true,
  cena: true,
  merienda: false,
};
// Serializacion estable de un mapa de porciones/booleanos por clave ordenada, para comparar el contexto base.
const serMap = (m: Record<string, number | boolean>) =>
  Object.keys(m)
    .sort()
    .map((k) => `${k}:${typeof m[k] === "boolean" ? (m[k] ? 1 : 0) : m[k]}`)
    .join(",");

function TiemposSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTiemposAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const snap = protocol.protocolSuggested;
  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    pesoMeta: protocol.adjPesoMeta,
  };
  const objetivoEfectivo = snap ? Math.round(computeProtocoloEfectivo(snap, adjGuardados).calorico.kcalObj) : null;
  const defaults = objetivoEfectivo != null ? computeIntercambio(objetivoEfectivo) : [];
  const savedInter = protocol.intercambioPorciones;
  const savedTiempos = protocol.tiempos;

  // Porciones actuales POR ALIMENTO (del intercambio guardado o el default) + kcal por porcion de cada alimento.
  const porcionesActuales: Record<string, number> = {};
  const kcalPorPorcion: Record<string, number> = {};
  for (const a of defaults) {
    porcionesActuales[a.sub] = savedInter?.porciones[a.sub] ?? a.porciones;
    kcalPorPorcion[a.sub] = a.kcal;
  }

  const [celdas, setCeldas] = useState<Record<string, Record<string, number>>>(() => savedTiempos?.celdas ?? {});

  if (!snap || objetivoEfectivo == null) return null;

  // LAS DOS TABLAS (esta y el menu semanal) LEEN LOS TIEMPOS GUARDADOS, no la edicion en vivo. Los tiempos
  // activos son una decision CLINICA (definen la estructura del dia del paciente), no un ajuste visual: se
  // toman una vez y se aplican con un boton. Con reaccion en vivo, tantear marcando y desmarcando
  // reconstruiria la tabla Y el menu en cada clic, lo que distrae en vez de ayudar. Y asi las dos superficies
  // cuentan lo mismo SIN compartir estado entre secciones hermanas, que habria exigido subir el estado al
  // panel y poner en riesgo el remonte por firma (el arreglo del estado pegado).
  const activosGuardados = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;

  const vivos = TIEMPOS_DEF.filter((t) => activosGuardados[t.id]);
  const alimentosConPorciones = defaults.filter((a) => porcionesActuales[a.sub] > 0);
  const alimentosOcultos = defaults.length - alimentosConPorciones.length;
  const auto = computeTiempos(porcionesActuales, activosGuardados); // alimento (sub) -> tiempo (solo activos)
  const celda = (sub: string, mid: string) => celdas[sub]?.[mid] ?? auto[sub]?.[mid] ?? 0;

  // Total por tiempo: porciones y kcal (lo que el nutricionista mira). kcal = porciones * kcal/porcion del alimento.
  const totalPorc: Record<string, number> = {};
  const totalKcal: Record<string, number> = {};
  for (const t of vivos) {
    totalPorc[t.id] = alimentosConPorciones.reduce((s, a) => s + celda(a.sub, t.id), 0);
    totalKcal[t.id] = alimentosConPorciones.reduce((s, a) => s + celda(a.sub, t.id) * kcalPorPorcion[a.sub], 0);
  }

  // CUADRE del reparto (fiel al v8, celda "suma/total ✓/⚠"): la distribucion es un REPARTO, la suma de un
  // alimento por los tiempos debe igualar sus porciones del intercambio. El auto siempre cuadra (interSplit);
  // un override manual puede romperlo. Se avisa EN VIVO por fila (verde/rojo), no se bloquea el guardado (el v8
  // tampoco lo bloquea; DIV-11: no destruir el trabajo del profesional, avisar). Es aritmetica, no criterio
  // clinico: no va a Gildardo.
  const reparto = (sub: string) => {
    const suma = vivos.reduce((s, t) => s + celda(sub, t.id), 0);
    return { suma, obj: porcionesActuales[sub] ?? 0 };
  };
  // COMIDA ACTIVA Y VACIA (P-41, propuesta nuestra: el v8 no lo detecta, solo compara por ALIMENTO -fila-,
  // nunca por TIEMPO -columna-). Si el desayuno esta activo y no tiene ni una porcion, el plan dice dos cosas
  // contradictorias: la casilla dice que el paciente desayuna y la tabla dice que no come nada. El modelo
  // mental correcto es que las CASILLAS mandan y la tabla reparte dentro de lo que ellas definen, asi que la
  // salida no es repartirle algo: es apagar la casilla. Se AVISA en vivo, no se bloquea (mismo trato que el
  // descuadre por alimento, DIV-11: no destruir el trabajo del profesional).
  const comidasVacias = vivos.filter((t) => totalPorc[t.id] === 0);

  const descuadres = alimentosConPorciones.filter((a) => {
    const r = reparto(a.sub);
    return r.suma !== r.obj;
  }).length;

  // Desfase DOBLE (DIV-11): overrides hechos con otras porciones o con otros tiempos activos. Se compara el
  // contexto SELLADO (savedTiempos.base) contra la realidad actual (porciones del intercambio + activos
  // guardados), no contra la edicion en vivo, para no titilar mientras se ajusta.
  const desfase =
    savedTiempos != null &&
    Object.keys(savedTiempos.celdas).length > 0 &&
    (serMap(porcionesActuales) !== serMap(savedTiempos.base.porciones) ||
      serMap(activosGuardados) !== serMap(savedTiempos.base.activos));

  const setCelda = (gid: string, mid: string, v: number) =>
    setCeldas((c) => ({ ...c, [gid]: { ...(c[gid] ?? {}), [mid]: Math.max(0, v) } }));
  const payload: TiemposSaved = {
    celdas, // se conservan TODOS, incluidos los de comidas apagadas (no se muestran, no se borran)
    base: { porciones: porcionesActuales, activos: activosGuardados },
  };
  const baseSignature = tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: savedTiempos });

  return (
    <section className={secCls("derivado")}>
      {/* El titulo va VERBATIM de su archivo y NO se acorta: lo intentamos y el candado
          titulos-tablas-plan.test.ts lo freno, con razon. La referencia es parte del dato, asi que
          acortarlo no es presentacion, es quitar informacion (y el diseno no cambia QUE se muestra).
          Lo que las ordena sin tocar el titulo es el NIVEL (esta es derivada, los tiempos son
          prescripcion) mas la linea de abajo, que es ADITIVA. */}
      <h3 className={tituloCls("derivado")}>Distribución por tiempos de comida</h3>
      <p className="text-xs text-muted-foreground">
        Se calcula sobre los tiempos de comida activos. Puedes ajustar celda por celda.
      </p>
      <p className="text-sm text-muted-foreground">
        Reparte las porciones de cada alimento entre los tiempos de comida activos. Ajusta las celdas si hace
        falta; el total por tiempo (porciones y kcal) se recalcula abajo.
      </p>

      {desfase ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          Estos ajustes de tiempos se hicieron con otras porciones o comidas activas; ya no corresponden. Puedes
          seguir con ellos o recalcular desde el intercambio actual (borra tus ajustes manuales).
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="tiempos" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1 pr-3 text-left font-medium">Alimento</th>
                  {vivos.map((t) => (
                    <th key={t.id} className="px-2 py-1 text-right font-medium">
                      {t.n}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium" title="Suma del reparto / porciones del alimento">
                    Reparto
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Filas por ALIMENTO (solo los con porciones > 0), agrupadas por grupo con un encabezado de
                    seccion cuando cambia el grupo del alimento anterior. */}
                {alimentosConPorciones.flatMap((a, i) => {
                  const nuevoGrupo = i === 0 || alimentosConPorciones[i - 1].gr !== a.gr;
                  const filas = [] as React.ReactNode[];
                  if (nuevoGrupo) {
                    filas.push(
                      <tr key={`g-${a.gr}`} className="bg-muted/40">
                        <td colSpan={vivos.length + 2} className="py-1 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {a.grNom}
                        </td>
                      </tr>,
                    );
                  }
                  const cuadre = reparto(a.sub);
                  const cuadra = cuadre.suma === cuadre.obj;
                  filas.push(
                    <tr key={a.sub} className="border-b border-border/50">
                      <td className="py-1.5 pl-3 pr-3 text-foreground">{a.sub}</td>
                      {vivos.map((t) => (
                        <td key={t.id} className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={celda(a.sub, t.id)}
                            onChange={(e) => setCelda(a.sub, t.id, Math.round(Number(e.target.value) || 0))}
                            className="w-14 rounded border border-border bg-background px-1.5 py-1 text-right text-sm"
                          />
                        </td>
                      ))}
                      {/* Cuadre por alimento en vivo (v8): suma/porciones + ✓/⚠, verde si cuadra, rojo si no. */}
                      <td className={"px-2 py-1.5 text-right tabular-nums font-semibold " + (cuadra ? "text-clinical-optimal" : "text-clinical-critical")}>
                        {cuadre.suma}/{cuadre.obj} {cuadra ? "✓" : "⚠"}
                      </td>
                    </tr>,
                  );
                  return filas;
                })}
                <tr className="font-semibold text-foreground">
                  <td className="py-2 pr-3">Total porciones</td>
                  {vivos.map((t) => (
                    <td key={t.id} className="px-2 py-2 text-right tabular-nums">
                      {totalPorc[t.id]}
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="text-muted-foreground">
                  <td className="py-1 pr-3">Total kcal</td>
                  {vivos.map((t) => (
                    <td key={t.id} className="px-2 py-1 text-right tabular-nums">
                      {Math.round(totalKcal[t.id])}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {comidasVacias.length > 0 ? (
            <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              {comidasVacias.length === 1
                ? `${comidasVacias[0].n} está activo pero no tiene porciones asignadas.`
                : `${comidasVacias.map((t) => t.n).join(", ")} están activos pero no tienen porciones asignadas.`}{" "}
              Si el paciente no {comidasVacias.length === 1 ? "hace esa comida" : "hace esas comidas"}, apaga la
              casilla de arriba; si sí, repártele porciones.
            </div>
          ) : null}
          {descuadres > 0 ? (
            <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              {descuadres === 1 ? "Un alimento reparte" : `${descuadres} alimentos reparten`} menos o más porciones
              de las que {descuadres === 1 ? "tiene" : "tienen"} en la lista de intercambio (marcados en rojo en la
              columna Reparto). El reparto por tiempos debe sumar las porciones del alimento; ajusta las celdas o
              usa Recalcular desde el intercambio. Puedes guardar igual, pero el plan quedará descuadrado.
            </div>
          ) : null}

          {alimentosOcultos > 0 ? (
            <p className="text-xs text-muted-foreground">
              Solo se muestran los alimentos con porciones. {alimentosOcultos}{" "}
              {alimentosOcultos === 1 ? "alimento tiene" : "alimentos tienen"} 0 porciones y no{" "}
              {alimentosOcultos === 1 ? "aparece" : "aparecen"} aquí; si les subes porciones en la lista de
              intercambio, {alimentosOcultos === 1 ? "aparece" : "aparecen"} en la distribución.
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar distribución"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setCeldas({})}>
              Recalcular desde el intercambio (borra tus ajustes)
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Validacion nutricional (CP3.2): tabla de 16 nutrientes (obtenido/requerido/% cubrimiento/ICN) DERIVADA en
// vivo del intercambio (CP1) + los macros de la cadena + sexo/edad. Solo lectura: NO se guarda, NO se edita,
// asi que no puede desfasarse (se recalcula sola). El sodio se LIMITA (menos es mejor), el resto se cubre.
function ValidacionSection({ protocol }: { protocol: TreatmentProtocol }) {
  const snap = protocol.protocolSuggested;
  if (!snap || protocol.pesoCalculo == null) return null;

  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    pesoMeta: protocol.adjPesoMeta,
  };
  const ef = computeProtocoloEfectivo(snap, adjGuardados);
  const objetivoEfectivo = Math.round(ef.calorico.kcalObj);
  const defaults = computeIntercambio(objetivoEfectivo);
  const savedInter = protocol.intercambioPorciones;

  const porcionesPorSub: Record<string, number> = {};
  let algunaPorcion = false;
  for (const a of defaults) {
    const p = savedInter?.porciones[a.sub] ?? a.porciones;
    porcionesPorSub[a.sub] = p;
    if (p > 0) algunaPorcion = true;
  }

  // ESTADO VACIO (2026-08-24, al adoptar su orden). La validacion pasa ARRIBA, antes de la formula, porque
  // en un seguimiento responde la primera pregunta del profesional ("¿como va este plan?"). Pero en una
  // consulta INICIAL todavia no hay plan: sin porciones asignadas todo daria 0 % y el ICN 0, y una tabla de
  // ceros se lee como "este plan cubre el 0 % de todo", que es falso. No es que el plan no cubra: es que no
  // hay plan. Se dice, en vez de mostrarla. Es la misma distincion de "no aplica" vs "no se registro".
  if (!algunaPorcion) {
    return (
      <section className={secCls("derivado")}>
        <h3 className={tituloCls("derivado")}>
          Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)
        </h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Aparece al asignar porciones en la lista de intercambio. Todavía no hay plan que validar.
        </p>
      </section>
    );
  }

  const nutrientes = computeValidacion({
    porcionesPorSub,
    kcalObj: objetivoEfectivo,
    protG: ef.calorico.protG,
    choG: ef.calorico.choG,
    fatG: ef.calorico.fatG,
    // sexo/edad para los targets DRI salen del snapshot sellado (caloricoInputs), no del efectivo.
    sexoM: snap.caloricoInputs.sexoM,
    edad: snap.caloricoInputs.edad,
  });

  // SEMAFORO portado del v8 (interCobColor/interIcnColor, cortes verbatim), con los tokens clinicos de Atlas
  // (verde=optimal, ambar=warning, rojo=critical; NO el azul de excellent, reservado a lo optimo de escala).
  // Cubrimiento: [90,110] optimo, [70,130) alerta, resto critico. Sodio (a LIMITAR): <=100 bien, <=115 alerta,
  // resto critico. ICN: [0.9,1.15] optimo, [0.7,1.3) alerta, resto critico; null (kcal) neutro.
  const cobColor = (n: (typeof nutrientes)[number]): string => {
    if (n.lim) return n.cob <= 100 ? "text-clinical-optimal" : n.cob <= 115 ? "text-clinical-warning" : "text-clinical-critical";
    if (n.cob >= 90 && n.cob <= 110) return "text-clinical-optimal";
    if (n.cob >= 70 && n.cob < 130) return "text-clinical-warning";
    return "text-clinical-critical";
  };
  const icnColor = (v: number | null): string => {
    if (v == null) return "text-muted-foreground";
    if (v >= 0.9 && v <= 1.15) return "text-clinical-optimal";
    if (v >= 0.7 && v < 1.3) return "text-clinical-warning";
    return "text-clinical-critical";
  };
  const fmt = (v: number, d: number) => v.toFixed(d);

  // % de nutrientes con ICN >= 0,9 (resumen util del v8, _icnPctOk): excluye energia y los "a limitar".
  const icnVals = nutrientes.filter((n) => n.k !== "kcal" && !n.lim && n.icn != null).map((n) => n.icn as number);
  const icnPctOk = icnVals.length ? Math.round((icnVals.filter((v) => v >= 0.9).length / icnVals.length) * 100) : 0;

  return (
    <section className={secCls("derivado")}>
      <h3 className={tituloCls("derivado")}>Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)</h3>
      <p className="text-sm text-muted-foreground">
        Calculada del plan, no editable: cubrimiento de nutrientes contra los requerimientos por sexo y edad. El
        sodio se limita (menos es mejor); el resto se cubre.
      </p>
      {!algunaPorcion ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          La validación aparece cuando hay porciones en la lista de intercambio.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-1 pr-3 text-left font-medium">Nutriente</th>
                <th className="px-2 py-1 text-right font-medium">Obtenido</th>
                <th className="px-2 py-1 text-right font-medium">Necesidad</th>
                <th className="px-2 py-1 text-right font-medium">% Cubrim.</th>
                <th className="px-2 py-1 text-right font-medium">ICN</th>
              </tr>
            </thead>
            <tbody>
              {nutrientes.map((n) => (
                <tr key={n.k} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-foreground">
                    {n.l} <span className="text-xs text-muted-foreground">({n.u})</span>
                    {n.lim ? <span className="ml-1 text-xs text-muted-foreground">· a limitar</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(n.obtenido, n.d)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(n.requerido, n.d)}</td>
                  <td className={"px-2 py-1.5 text-right tabular-nums font-medium " + cobColor(n)}>
                    {Math.round(n.cob)}%
                  </td>
                  {/* ICN: texto "límite" para los a limitar (sodio), "—" para energia, si no el valor. El COLOR
                      va por el ICN incluso para el sodio (fiel al v8: interIcnColor(interICN("na")) lo colorea;
                      un sodio denso -> ICN alto -> rojo, que refuerza el "te pasas"). kcal (icn null) -> gris. */}
                  <td className={"px-2 py-1.5 text-right tabular-nums font-medium " + icnColor(n.icn)}>
                    {n.lim ? "límite" : n.k === "kcal" ? "—" : n.icn == null ? "—" : n.icn.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Leyenda del ICN portada del v8: sin ella la columna es numeros sin significado. Incluye el % de
              nutrientes con ICN >= 0,9 (resumen util). */}
          <p className="mt-2 text-xs text-muted-foreground">
            ICN = (nutriente aportado / requerido) ÷ (energía aportada / requerida). ≈1 balanceado · &gt;1 denso
            · &lt;1 deficitario. Nutrientes con ICN ≥ 0,9: <span className="font-semibold text-foreground">{icnPctOk}%</span>.
          </p>
          {/* Las dos columnas responden preguntas distintas y por eso su color puede discrepar en una misma
              fila (p. ej. fibra al 136% en rojo pero su ICN en ámbar): NO es un error. */}
          <p className="mt-1 text-xs text-muted-foreground">
            El <span className="font-medium">% de cubrimiento</span> mide cuánto se cubre respecto a la necesidad;
            el <span className="font-medium">ICN</span>, si el nutriente viene en proporción a las calorías del
            plan. Un nutriente puede sobrar en cantidad y aun así estar bien proporcionado, así que las dos
            columnas pueden tener colores distintos en la misma fila.
          </p>
        </div>
      )}
    </section>
  );
}

// Guias dietarias (checkpoint 2.4): seccion propia con guardado propio (saveGuidelinesAction).
function GuidelinesSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveGuidelinesAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [guidelines, setGuidelines] = useState<string[]>(protocol.guidelines.map((g) => g.text));
  const [guideInput, setGuideInput] = useState("");
  const addGuideline = () => {
    const v = guideInput.trim();
    if (v) setGuidelines([...guidelines, v]);
    setGuideInput("");
  };
  const baseSignature = guidelinesSignature({
    treatmentId: protocol.treatmentId,
    guidelines: protocol.guidelines.map((g) => g.text),
  });

  return (
    <section className={secCls("registro")}>
      <h3 className={tituloCls("registro")}>Guías dietarias</h3>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="guidelines" value={JSON.stringify(guidelines)} />
        <fieldset disabled={locked} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Textarea
              value={guideInput}
              onChange={(e) => setGuideInput(e.target.value)}
              placeholder="Escribe una guía dietaria y agregala"
              rows={2}
            />
            <Button type="button" variant="outline" onClick={addGuideline} className="self-start">
              Agregar
            </Button>
          </div>
          {guidelines.length ? (
            <ul className="flex flex-col gap-2">
              {guidelines.map((g, i) => (
                <li
                  key={`${i}-${g.slice(0, 12)}`}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm text-foreground"
                >
                  <span>{g}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setGuidelines(guidelines.filter((_, j) => j !== i))}
                    aria-label="Quitar guía"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin guías dietarias.</p>
          )}
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar guías"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function NotesSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(addNoteAction, EMPTY);
  useFormToast(state);
  const [note, setNote] = useState("");
  // Append-only: limpiar el campo tras un guardado exitoso. Si no, el texto recien enviado
  // queda visible como si fuera una nota nueva por agregar, y el profesional podria darle a
  // "Agregar" otra vez y crear un duplicado permanente (la nota no se puede editar ni borrar).
  // Se ajusta en render al cambiar el estado de la accion (patron oficial de React de "ajustar
  // estado en render", guardando el estado previo en estado; sin efecto ni mutacion de ref).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.success && note !== "") setNote("");
  }

  return (
    <div className={secCls("registro")}>
      <h3 className={tituloCls("registro")}>Notas del tratamiento</h3>
      <p className="text-xs text-muted-foreground">
        Notas internas del protocolo de tratamiento. Se agregan al historial (no se editan ni se
        borran) y no se envian al paciente. Distintas del criterio del diagnostico y de las notas
        del reporte.
      </p>
      {protocol.notes.length ? (
        <ul className="flex flex-col gap-2">
          {protocol.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3 text-sm text-foreground">
              <p>{n.note}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sin notas.</p>
      )}
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Agrega una nota al tratamiento"
          rows={2}
          disabled={locked}
        />
        <div>
          <Button type="submit" variant="outline" disabled={locked || pending || note.trim() === ""}>
            {pending ? "Agregando..." : "Agregar nota"}
          </Button>
        </div>
      </form>
    </div>
  );
}
