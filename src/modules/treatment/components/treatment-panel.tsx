"use client";

import { useActionState, useState } from "react";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
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
  generateMenuAction,
  saveAdjustmentsAction,
  saveGuidelinesAction,
  saveObjetivoAction,
  saveRestriccionesAction,
  type TreatmentActionState,
} from "../actions";
import type { CelularBadges } from "../data/celular-badges";
import {
  adjustmentSignature,
  guidelinesSignature,
  objetivoSignature,
  restriccionesSignature,
} from "../data/protocol-signature";
import type { MenuSuggestion, TreatmentProtocol } from "../data/treatment-view-types";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// Panel del protocolo de tratamiento (B13), vista interna del profesional. Edita objetivos,
// nutraceuticos y guias, y agrega notas. Si el diagnostico no esta confirmado, la edicion
// se bloquea (gate de B13: el protocolo se autoriza tras aprobar el reporte).
// Tono de la badge celular. warn/alert usan tokens de BRAND; info (hidratacion) un cian estandar.
const CEL_TONE_CLS: Record<CelularBadges["badges"][number]["tone"], string> = {
  warn: "border-clinical-warning/40 bg-clinical-warning-bg text-clinical-warning",
  alert: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-sky-500/40 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

// Nivel III · Salud celular (portado del vigente, celBadges). TRES estados que se distinguen a
// proposito (misma disciplina que el menu deshabilitado): (1) badges de alteracion; (2) datos
// presentes y ninguna alteracion -> se DICE ("sin alteraciones"); (3) sin las columnas necesarias
// -> "no se pudo evaluar", que NO es lo mismo que "sin alteraciones".
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
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Cadena calórica</h3>
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

function CelularSection({ celular }: { celular?: CelularBadges | null }) {
  if (!celular) return null; // sin medicion BIS: no hay seccion (tampoco habria protocolo).
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">Nivel III · Salud celular</h3>
      {!celular.dataAvailable ? (
        <p className="text-sm text-muted-foreground">
          Esta medicion BIS no incluye los parametros necesarios para evaluar la salud celular
          (angulo de fase, MCA, hidratacion, ECM/BCM).
        </p>
      ) : (
        <>
          {celular.badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {celular.notEvaluable.length > 0
                ? "Sin alteraciones en los parámetros evaluados."
                : "Sin alteraciones celulares que requieran priorizacion."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {celular.badges.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm ${CEL_TONE_CLS[b.tone]}`}
                >
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-foreground/80">{b.guidance}</span>
                </li>
              ))}
            </ul>
          )}
          {/* No evaluables por falta de referencia (no de dato): que "sin alteraciones" no se lea como
              si estos parametros se hubieran evaluado. La referencia la debe Gildardo (Q35). */}
          {celular.notEvaluable.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              No evaluables aun (esperan las referencias poblacionales del modelo):{" "}
              {celular.notEvaluable.map((n) => n.label).join(", ")}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function TreatmentPanel({
  evaluationId,
  protocol,
  celular,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  celular?: CelularBadges | null;
}) {
  // Bloqueado para editar si el diagnostico no esta confirmado O si el protocolo YA se aprobo (la
  // prescripcion aprobada es inmutable: el trigger de BD la congela; sin este candado el campo se veria
  // editable y el guardado chocaria contra el trigger). Se distinguen para dar el mensaje correcto.
  const diagnosisPending = !protocol.diagnosisConfirmed;
  const locked = diagnosisPending || protocol.approved;

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
        {/* Orden 1a.3: OBJETIVO del tratamiento (lo escribe el nutricionista) + sus GUIAS, y DESPUES la CADENA
            calorica (que antes iba primera; bajo a proposito para que el objetivo y las guias, que enmarcan el
            plan, se lean antes que los numeros). El bloque "Protocolo de tratamiento" se desarmo en el
            checkpoint 2.4/2.5: prescripcion y despacho viven en Rutas, restricciones/menu abajo. */}
        <ObjetivoSection
          key={objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: protocol.objetivoTexto })}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        <GuidelinesSection
          key={guidelinesSignature({
            treatmentId: protocol.treatmentId,
            guidelines: protocol.guidelines.map((g) => g.text),
          })}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* key = firma de los seis ajustes: un cambio del servidor remonta la seccion (no queda pegada). */}
        <CadenaCaloricaSection
          key={adjustmentSignature({
            treatmentId: protocol.treatmentId,
            adjGeb: protocol.adjGeb,
            adjPal: protocol.adjPal,
            adjKcalObj: protocol.adjKcalObj,
            adjProtGkg: protocol.adjProtGkg,
            adjFatPct: protocol.adjFatPct,
            adjPesoMeta: protocol.adjPesoMeta,
          })}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        <CelularSection celular={celular} />
        {/* Restricciones JUNTO al menu (checkpoint 2.4): son su insumo; que se lea que lo que se marca aqui
            cambia lo que genera el menu. key = firma de las restricciones (remonte). */}
        <RestriccionesSection
          key={restriccionesSignature({
            treatmentId: protocol.treatmentId,
            restricciones: protocol.restricciones,
          })}
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
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Menu sugerido (IA)</h3>
      <p className="text-sm text-muted-foreground">
        La IA propone un menu diario a partir del objetivo de la cadena calórica. Es un borrador para
        que lo revises; no se aplica al protocolo automaticamente. El diagnostico no usa IA.
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
      {m.generatedText ? (
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
    <section className="flex flex-col gap-2 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Restricciones alimentarias</h3>
      <p className="text-sm text-muted-foreground">
        Lo que marques aquí condiciona el <strong>menú de abajo</strong>: la IA lo genera excluyendo estos
        alimentos o nutrientes. Guárdalas antes de generar el menú.
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
    <section className="flex flex-col gap-2 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Objetivo del tratamiento nutricional</h3>
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
    <section className="flex flex-col gap-2 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Guías dietarias</h3>
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
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Notas del tratamiento</h3>
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
