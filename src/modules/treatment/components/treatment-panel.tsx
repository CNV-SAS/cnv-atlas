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
import { useFormToast } from "@/components/shared/use-form-toast";

import {
  addNoteAction,
  generateMenuAction,
  saveAdjustmentsAction,
  saveProtocolAction,
  type TreatmentActionState,
} from "../actions";
import type { CelularBadges } from "../data/celular-badges";
import {
  adjustmentSignature,
  protocolSectionSignatures,
  protocolSignature,
} from "../data/protocol-signature";
import type { MenuSuggestion, TreatmentProtocol } from "../data/treatment-view-types";
import { resolveRecommendation } from "../nutraceuticals-recommendation";

// Etiqueta de disponibilidad comercial (dato del producto): que significa para el paciente.
const AVAILABILITY_LABEL: Record<string, string> = {
  en_consultorio: "En consultorio",
  solo_tienda: "Solo en tienda",
  no_disponible: "No disponible",
};

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

type NutraLine = {
  nutraceuticalId: string;
  name: string;
  dosage: string;
  durationDays: string;
};

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

// Una fila de la vista previa (etiqueta + valor efectivo, con la derivacion entre parentesis).
function PrevRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
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
  useFormToast(state);
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
        <PrevRow label="GEB" value={`${d0(cal.geb)} kcal`} detail={`(${cal.formula})`} />
        <PrevRow label="PAL" value={String(cal.pal)} />
        <PrevRow label="GET" value={`${d0(cal.get)} kcal`} />
        <PrevRow label="Objetivo calórico" value={`${d0(cal.kcalObj)} kcal`} />
        <PrevRow
          label="Proteína"
          value={`${d0(cal.protG)} g`}
          detail={`(${cal.protGKg} g/kg · ${d0(cal.protKcal)} kcal)`}
        />
        <PrevRow
          label="Grasa"
          value={`${d0(cal.fatG)} g`}
          detail={`(${cal.fatPct}% · ${d0(cal.fatKcal)} kcal)`}
        />
        <PrevRow
          label="Carbohidratos"
          value={`${d0(cal.choG)} g`}
          detail={`(${cal.choPct}% · ${d0(cal.choKcal)} kcal)`}
        />
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
        {/* key = firma de los campos guardados que edita el form. Un cambio real del servidor (guardado,
            correccion) remonta y re-deriva el estado desde el protocolo; una revalidacion que no tocó esos
            campos (entrega, menu, nota) NO remonta, preservando una edicion en curso. Ver protocol-signature. */}
        <ProtocolForm
          key={protocolSignature(protocol)}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* key = firma de los seis ajustes: un cambio del servidor (otro profesional, o el propio guardado)
            remonta la seccion y re-deriva el estado, para que no quede pegada mostrando valores viejos. */}
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

  // La generacion usa los objetivos GUARDADOS (no el estado vivo del formulario).
  const objetivosListos = protocol.kcalObjetivo != null && protocol.proteinaGramos != null;
  const disabled = locked || pending || !objetivosListos;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Menu sugerido (IA)</h3>
      <p className="text-sm text-muted-foreground">
        La IA propone un menu diario a partir de los objetivos guardados. Es un borrador para
        que lo revises; no se aplica al protocolo automaticamente. El diagnostico no usa IA.
      </p>
      <form action={formAction}>
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Button type="submit" variant="outline" disabled={disabled}>
          {pending ? "Generando..." : "Generar menu"}
        </Button>
        {!objetivosListos && !locked ? (
          <p className="pt-2 text-xs text-muted-foreground">
            Guarda el objetivo calorico y de proteina antes de generar el menu.
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

function ProtocolForm({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveProtocolAction, EMPTY);
  useFormToast(state);

  const [kcal, setKcal] = useState(protocol.kcalObjetivo?.toString() ?? "");
  const [protein, setProtein] = useState(protocol.proteinaGramos?.toString() ?? "");
  const [restricciones, setRestricciones] = useState<string[]>(protocol.restricciones);
  const [restrInput, setRestrInput] = useState("");
  const [nutras, setNutras] = useState<NutraLine[]>(
    protocol.nutraceuticals.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      name: n.name,
      dosage: n.dosage ?? "",
      durationDays: n.durationDays?.toString() ?? "",
    })),
  );
  const [guidelines, setGuidelines] = useState<string[]>(protocol.guidelines.map((g) => g.text));
  const [guideInput, setGuideInput] = useState("");
  const [pickId, setPickId] = useState("");

  const addRestriccion = () => {
    const v = restrInput.trim();
    if (v && !restricciones.includes(v)) setRestricciones([...restricciones, v]);
    setRestrInput("");
  };
  // Agrega un producto a la prescripcion del profesional (sin prellenar la dosis: un valor por defecto
  // se acepta sin pensar, y no hay posologia autorizada por Gildardo). Lo usan el selector y los botones
  // "agregar" de la recomendacion. Al agregarlo, el item aparece en la lista del profesional (abajo),
  // visiblemente separado de la recomendacion del modelo.
  const addProduct = (id: string) => {
    if (!id) return;
    if (nutras.some((n) => n.nutraceuticalId === id)) return;
    const item = protocol.catalog.find((c) => c.id === id);
    if (!item) return;
    setNutras((prev) => [...prev, { nutraceuticalId: id, name: item.name, dosage: "", durationDays: "" }]);
  };
  const addNutra = () => {
    addProduct(pickId);
    setPickId("");
  };
  const recommended = resolveRecommendation(protocol.recommendedNutraceuticals, protocol.catalog);
  const isAdded = (id: string) => nutras.some((n) => n.nutraceuticalId === id);
  const addGuideline = () => {
    const v = guideInput.trim();
    if (v) setGuidelines([...guidelines, v]);
    setGuideInput("");
  };

  // Payload serializado que viaja en el formulario (las actions parsean el JSON).
  const nutrasPayload = JSON.stringify(
    nutras.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      dosage: n.dosage.trim() === "" ? null : n.dosage.trim(),
      durationDays: n.durationDays.trim() === "" ? null : Number(n.durationDays),
    })),
  );

  // Firma base para el candado de concurrencia: se computa del PROTOCOLO CARGADO (el prop), no del estado
  // editado. Como el form se remonta cuando el servidor cambia (por el `key`), esta firma siempre refleja el
  // estado que el cliente tiene enfrente. El servidor la compara con la actual bajo lock y rechaza si difiere.
  const baseSignatures = JSON.stringify(protocolSectionSignatures(protocol));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="baseSignatures" value={baseSignatures} />
      <input type="hidden" name="restricciones" value={JSON.stringify(restricciones)} />
      <input type="hidden" name="nutraceuticals" value={nutrasPayload} />
      <input type="hidden" name="guidelines" value={JSON.stringify(guidelines)} />

      {/* Objetivos */}
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-foreground">Objetivos nutricionales</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kcalObjetivo">Objetivo calórico (kcal/día)</Label>
            <Input
              id="kcalObjetivo"
              name="kcalObjetivo"
              type="number"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="ej. 2000"
            />
            {protocol.kcalSugerido != null ? (
              <p className="text-xs text-muted-foreground">
                Gasto medido por el Biody: {protocol.kcalSugerido} kcal.{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                  onClick={() => setKcal(String(protocol.kcalSugerido))}
                  disabled={locked}
                >
                  Usar
                </button>
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proteinaGramos">Proteína objetivo (g/día)</Label>
            <Input
              id="proteinaGramos"
              name="proteinaGramos"
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="ej. 110"
            />
          </div>
        </div>

        {/* Restricciones */}
        <div className="flex flex-col gap-1.5">
          <Label>Restricciones alimentarias</Label>
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
        </div>
      </fieldset>

      {/* Nutraceuticos: DOS conceptos separados. (1) lo que el MODELO recomienda (string sellado del
          snapshot, solo lectura); (2) lo que el PROFESIONAL agrega (selector + prescripcion). Es la
          misma separacion recomienda-vs-agrega de las restricciones. El P1/P2/dosis estructurado y el
          "registrar despacho" son T3, no van aqui. */}
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Nutracéuticos</legend>
        {recommended.length ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">El modelo recomienda</p>
            <ul className="flex flex-col gap-2">
              {recommended.map((r, i) =>
                r.status === "en_catalogo" ? (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="min-w-[10rem] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.product.name}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {AVAILABILITY_LABEL[r.product.commercialAvailability] ?? r.product.commercialAvailability}
                        </Badge>
                      </div>
                      {r.product.indication ? (
                        <p className="text-xs text-muted-foreground">{r.product.indication}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isAdded(r.product.id)}
                      onClick={() => addProduct(r.product.id)}
                    >
                      {isAdded(r.product.id) ? "Agregado" : "Agregar"}
                    </Button>
                  </li>
                ) : (
                  <li
                    key={i}
                    className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
                  >
                    El modelo recomienda{" "}
                    <span className="font-medium text-foreground">{r.motorName}</span>, que todavía no
                    está en el catálogo.
                  </li>
                ),
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              &ldquo;En consultorio&rdquo;: se lo puedes entregar en la consulta. &ldquo;Solo en
              tienda&rdquo;: el paciente lo compra en la tienda de CNV.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">El modelo no recomendó nutracéuticos para este fenotipo.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Abajo agregas los que prescribes; son tu decisión, distinta de la recomendación del modelo.
        </p>
        <div className="flex gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">Selecciona un nutracéutico</option>
            {protocol.catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={addNutra}>
            Agregar
          </Button>
        </div>
        {nutras.length ? (
          <ul className="flex flex-col gap-2">
            {nutras.map((n, i) => (
              <li
                key={n.nutraceuticalId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
              >
                <span className="min-w-[8rem] flex-1 font-medium text-foreground">{n.name}</span>
                <Input
                  value={n.dosage}
                  onChange={(e) =>
                    setNutras(nutras.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))
                  }
                  placeholder="Dosis (ej. 1 capsula/día)"
                  className="w-48"
                />
                <Input
                  value={n.durationDays}
                  onChange={(e) =>
                    setNutras(
                      nutras.map((x, j) => (j === i ? { ...x, durationDays: e.target.value } : x)),
                    )
                  }
                  type="number"
                  inputMode="numeric"
                  placeholder="Días"
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNutras(nutras.filter((_, j) => j !== i))}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin nutracéuticos en el protocolo.</p>
        )}
      </fieldset>

      {/* Guias dietarias */}
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Guías dietarias</legend>
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
      </fieldset>

      <div>
        <Button type="submit" disabled={locked || pending}>
          {pending ? "Guardando..." : "Guardar protocolo"}
        </Button>
      </div>
    </form>
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
