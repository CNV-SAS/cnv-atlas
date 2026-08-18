"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveBisConditionsAction } from "../actions";
import { computeContraindicated } from "../services/contraindication";
import type {
  BisCondition,
  BisConditionAnswers,
  BisConditionCatalog,
  BisIntakeRecord,
} from "../types";

// Captura de las condiciones de la toma BIS (Parte 2). El profesional las responde CON el paciente
// antes de la bioimpedancia. Dos elementos NO son cosmeticos:
//  - El bloqueo por marcapasos (unica contraindicacion absoluta) se muestra inequivoco, no como un
//    error generico: explica por que (la corriente puede interferir con el dispositivo).
//  - El reconocimiento del embarazo es un checkbox NO premarcado y prominente: todo su valor esta en
//    que el profesional lo marque conscientemente.

type LocalAnswer = { bool: boolean | null; num: string; detail: string; acknowledged: boolean };

function initState(
  catalog: BisConditionCatalog,
  intake: BisIntakeRecord | null,
): Record<string, LocalAnswer> {
  const out: Record<string, LocalAnswer> = {};
  for (const c of catalog.conditions) {
    const saved = intake?.answers[c.key];
    out[c.key] = {
      bool: typeof saved?.value === "boolean" ? saved.value : null,
      num: c.inputType === "number" && typeof saved?.value === "number" ? String(saved.value) : "",
      detail: saved?.detail != null ? String(saved.detail) : "",
      acknowledged: saved?.acknowledgedAt != null,
    };
  }
  return out;
}

export function BisConditionsCapture({
  evaluationId,
  catalog,
  intake,
  patientIsFemale,
}: {
  evaluationId: string;
  catalog: BisConditionCatalog;
  intake: BisIntakeRecord | null;
  patientIsFemale: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState(() => initState(catalog, intake));
  const [weightGoal, setWeightGoal] = useState(
    intake?.weightGoalKg != null ? String(intake.weightGoalKg) : "",
  );
  const [gripStrength, setGripStrength] = useState(
    intake?.gripStrengthKg != null ? String(intake.gripStrengthKg) : "",
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(intake != null);

  // El bloque femenino solo aplica a mujeres (misma logica que el HTML: esMujer).
  const visible = catalog.conditions.filter((c) => c.scope === "general" || patientIsFemale);
  const general = visible.filter((c) => c.scope === "general");
  const female = visible.filter((c) => c.scope === "mujeres");

  // Estado VIVO de la compuerta (marcapasos = Si) para el bloqueo inmediato, antes de guardar.
  const liveAnswers: BisConditionAnswers = {};
  for (const c of visible) {
    const a = answers[c.key];
    if (c.inputType === "number") {
      if (a.num.trim() !== "") liveAnswers[c.key] = { value: Number(a.num) };
    } else if (a.bool !== null) {
      liveAnswers[c.key] = { value: a.bool };
    }
  }
  const liveContraindicated = computeContraindicated(visible, liveAnswers);
  const activeAdvertencias = visible.filter(
    (c) => c.kind === "advertencia" && answers[c.key]?.bool === true,
  );
  const missingAck = activeAdvertencias.some((c) => !answers[c.key].acknowledged);
  // Todas las si/no en alcance son OBLIGATORIAS (la numerica semana del ciclo es opcional): un
  // checklist a medias no cumple, y "sin responder" no es "no" para una compuerta de seguridad.
  const missingRequired = visible.some(
    (c) => c.inputType === "boolean" && answers[c.key].bool === null,
  );

  const setBool = (key: string, val: boolean) =>
    setAnswers((s) => ({ ...s, [key]: { ...s[key], bool: val } }));
  const setNum = (key: string, val: string) =>
    setAnswers((s) => ({ ...s, [key]: { ...s[key], num: val } }));
  const setDetail = (key: string, val: string) =>
    setAnswers((s) => ({ ...s, [key]: { ...s[key], detail: val } }));
  const setAck = (key: string, val: boolean) =>
    setAnswers((s) => ({ ...s, [key]: { ...s[key], acknowledged: val } }));

  function buildPayload() {
    const out: Record<
      string,
      { value: boolean | number; detail?: string | number; acknowledged?: boolean }
    > = {};
    for (const c of visible) {
      const a = answers[c.key];
      if (c.inputType === "number") {
        if (a.num.trim() === "") continue;
        out[c.key] = { value: Number(a.num) };
        continue;
      }
      if (a.bool === null) continue;
      const entry: { value: boolean | number; detail?: string | number; acknowledged?: boolean } = {
        value: a.bool,
      };
      if (c.requiresDetail && a.bool === true) {
        if (c.detailType === "number") {
          // Vacio -> undefined (no 0): asi la validacion dice "Ingresa ..." en vez de un error de
          // rango confuso (un mes vacio no es un mes fuera de rango).
          entry.detail = a.detail.trim() === "" ? undefined : Number(a.detail);
        } else {
          entry.detail = a.detail;
        }
      }
      if (c.kind === "advertencia" && a.bool === true) entry.acknowledged = a.acknowledged;
      out[c.key] = entry;
    }
    return out;
  }

  function onSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveBisConditionsAction({
        evaluationId,
        answers: buildPayload(),
        weightGoalKg: weightGoal.trim() === "" ? null : Number(weightGoal),
        gripStrengthKg: gripStrength.trim() === "" ? null : Number(gripStrength),
      });
      if (!res.ok) {
        setFieldErrors(res.error.fields ?? {});
        toast.error(res.error.message);
        return;
      }
      setSaved(true);
      if (res.value.contraindicated) {
        toast.warning("Contraindicación registrada: la medición BIS no se importa.");
      } else {
        toast.success("Condiciones de la toma BIS guardadas.");
      }
      if (res.value.existingBisWarning) {
        toast.warning("Ya habia una medición BIS importada; no se borro (registro clínico).");
      }
      // Trae el estado del servidor (gate del import) sin recargar a mano.
      router.refresh();
    });
  }

  function renderCondition(c: BisCondition) {
    const a = answers[c.key];
    const err = fieldErrors[c.key];
    return (
      <div key={c.key} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-foreground">
            {c.label}
            {c.kind === "contraindicacion" ? (
              <span className="ml-2 rounded bg-clinical-critical-bg px-1.5 py-0.5 text-xs font-semibold text-clinical-critical">
                Contraindicación
              </span>
            ) : null}
          </span>
          {c.inputType === "number" ? (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={6}
              value={a.num}
              onChange={(e) => setNum(c.key, e.target.value)}
              placeholder="1-6"
              disabled={pending}
              className="w-24"
              aria-label={c.label}
            />
          ) : (
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={a.bool === true ? "default" : "outline"}
                onClick={() => setBool(c.key, true)}
                disabled={pending}
              >
                Sí
              </Button>
              <Button
                type="button"
                size="sm"
                variant={a.bool === false ? "default" : "outline"}
                onClick={() => setBool(c.key, false)}
                disabled={pending}
              >
                No
              </Button>
            </div>
          )}
        </div>

        {c.requiresDetail && a.bool === true ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`detail-${c.key}`} className="text-xs text-muted-foreground">
              {c.detailLabel}
            </Label>
            <Input
              id={`detail-${c.key}`}
              type={c.detailType === "number" ? "number" : "text"}
              inputMode={c.detailType === "number" ? "numeric" : undefined}
              value={a.detail}
              onChange={(e) => setDetail(c.key, e.target.value)}
              disabled={pending}
              className="w-full sm:w-64"
            />
          </div>
        ) : null}

        {c.kind === "advertencia" && a.bool === true ? (
          <div className="mt-1 flex flex-col gap-2 rounded-lg border-2 border-clinical-warning bg-clinical-warning-bg p-3">
            <p className="text-sm font-semibold text-clinical-warning">
              Embarazo: autorización del comité de ética y reserva de validez
            </p>
            <p className="text-xs text-foreground/80">
              Dos cosas. (1) Evaluar a una paciente en embarazo requiere la autorización del comité
              de ética: la bioimpedancia no representa un riesgo físico y la medición procede bajo tu
              responsabilidad. (2) El modelo no está validado en gestación, así que el resultado debe
              interpretarse con reserva. Ambas quedan registradas en el diagnóstico.
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={a.acknowledged}
                onChange={(e) => setAck(c.key, e.target.checked)}
                disabled={pending}
                className="mt-0.5 size-4"
                style={{ accentColor: "var(--clinical-warning)" }}
              />
              <span>
                Entiendo que se requiere autorización del comité de ética para evaluar a esta
                paciente.
              </span>
            </label>
          </div>
        ) : null}

        {c.kind === "validez" && a.bool === true ? (
          <div className="mt-1 flex flex-col gap-1 rounded-lg border-2 border-clinical-warning bg-clinical-warning-bg p-3">
            <p className="text-sm font-semibold text-clinical-warning">
              Resultado con reserva de validez
            </p>
            <p className="text-xs text-foreground/80">
              La medición procede (es segura para el paciente), pero bajo esta condición el modelo
              puede no ser confiable: el resultado debe interpretarse con reserva. No bloquea el
              import; queda registrado y visible en el diagnóstico.
            </p>
          </div>
        ) : null}

        {err ? <span className="text-xs text-destructive">{err}</span> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Condiciones de la toma BIS</CardTitle>
          {saved ? (
            <span className="text-xs text-muted-foreground">Guardado</span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          Verifica cada condición con el paciente antes de la bioimpedancia. Sin este checklist no se
          habilita el import de la medición.
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {liveContraindicated ? (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-lg border-2 border-clinical-critical bg-clinical-critical-bg p-4"
          >
            <p className="text-sm font-bold text-clinical-critical">
              Contraindicación: marcapasos o soporte vital
            </p>
            <p className="text-sm text-foreground/90">
              No se realiza la bioimpedancia. La corriente de baja intensidad de la medición puede
              interferir con el funcionamiento del dispositivo. El import de la medición BIS queda
              bloqueado para este paciente.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">{general.map(renderCondition)}</div>

        {patientIsFemale && female.length > 0 ? (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Solo mujeres
            </span>
            {female.map(renderCondition)}
          </div>
        ) : null}

        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="weight-goal" className="text-sm">
              Meta de peso (kg) <span className="text-muted-foreground">— opcional</span>
            </Label>
            <Input
              id="weight-goal"
              type="number"
              inputMode="decimal"
              value={weightGoal}
              onChange={(e) => setWeightGoal(e.target.value)}
              disabled={pending}
              placeholder="Ej. 70"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="grip-strength" className="text-sm">
              Fuerza prensil (kg) <span className="text-muted-foreground">— opcional</span>
            </Label>
            <Input
              id="grip-strength"
              type="number"
              inputMode="decimal"
              value={gripStrength}
              onChange={(e) => setGripStrength(e.target.value)}
              disabled={pending}
              placeholder="Ej. 35"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {missingRequired ? (
            <span className="text-xs font-medium text-muted-foreground">
              Responde todas las condiciones (Sí o No) para poder guardar. La semana del ciclo es
              opcional.
            </span>
          ) : null}
          {missingAck ? (
            <span className="text-xs font-medium text-clinical-warning">
              Marca el reconocimiento del embarazo para poder guardar.
            </span>
          ) : null}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={pending || missingAck || missingRequired}
            className="w-fit"
          >
            {pending ? "Guardando..." : saved ? "Actualizar condiciones" : "Guardar condiciones"}
          </Button>
          {/* Guardadas y sin contraindicacion: el import ya quedo habilitado, pero vive en la OTRA
              subpestaña. Sin este puente el profesional guarda y no sabe adonde ir (Gildardo 2026-08-17, a). */}
          {saved && !liveContraindicated ? (
            <div className="flex items-start gap-2 rounded-lg border border-clinical-optimal/40 bg-clinical-optimal-bg px-3 py-2 text-sm text-clinical-optimal">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Condiciones guardadas. Ya puedes{" "}
                <Link
                  href={`/evaluaciones/${evaluationId}?ev=antropometria`}
                  className="font-semibold underline underline-offset-2 hover:no-underline"
                >
                  importar la medición en Antropometría y BIS
                </Link>
                .
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
