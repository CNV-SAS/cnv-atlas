"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";

import { confirmIdentityAction } from "../actions";
import type { ConfirmIdentityState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

export type DuplicateCandidateView = {
  patientId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  documentType: string;
  documentNumber: string;
  score: number;
  birthDateMatches: boolean;
};

export type PendingEvaluationView = {
  evaluationId: string;
  patientId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
};

const confirmInitial: ConfirmIdentityState = { error: null, confirmed: false };

function DuplicateAlert({ candidates }: { candidates: DuplicateCandidateView[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-clinical-warning/40 bg-clinical-warning-bg p-3">
      <span className="text-sm font-semibold text-clinical-warning">
        Posible duplicado: revisa antes de confirmar
      </span>
      <p className="text-xs text-muted-foreground">
        Encontramos pacientes con datos parecidos. Míralos antes de seguir: Atlas resuelve la identidad
        por documento, así que estos tienen uno <strong>distinto</strong>.
      </p>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => (
          <li
            key={c.patientId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {c.firstName} {c.lastName}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.documentType} {c.documentNumber}
                {c.birthDate ? ` · ${c.birthDate}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {c.birthDateMatches ? (
                <Badge variant="outline" className="text-xs">
                  Misma fecha
                </Badge>
              ) : null}
              <Badge variant="outline" className="bg-clinical-warning-bg text-clinical-warning">
                {Math.round(c.score * 100)}% similar
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IdentityConfirmation({
  evaluation,
  duplicateCandidates,
}: {
  evaluation: PendingEvaluationView;
  duplicateCandidates: DuplicateCandidateView[];
}) {
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmIdentityAction,
    confirmInitial,
  );

  const done = confirmState.confirmed;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {evaluation.firstName} {evaluation.lastName}
          </CardTitle>
          <Badge variant="outline">
            {evaluation.type === "seguimiento" ? "Seguimiento" : "Inicial"}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {evaluation.documentType} {evaluation.documentNumber}
          {evaluation.birthDate ? ` · ${evaluation.birthDate}` : ""} · recibida el{" "}
          {formatDate(evaluation.createdAt)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {duplicateCandidates.length > 0 ? (
          <DuplicateAlert candidates={duplicateCandidates} />
        ) : null}

        {confirmState.error ? (
          <p className="text-sm text-destructive">{confirmState.error}</p>
        ) : null}

        {/* ═══ LA SALIDA QUE FALTABA (Santiago, 2026-09-10) ═══

            EL DEFECTO: había un solo botón, "Confirmar identidad", y el texto de arriba decía "confirma
            solo si es la misma persona". Cuando NO lo era, el profesional se quedaba sin salida: sin
            confirmar, la evaluación sigue en borrador y las condiciones BIS no aparecen.

            Y LO QUE SE VERIFICÓ ANTES DE CONSTRUIR NADA cambia el diseño: **confirmar no fusiona nada.**
            El writer hace tres cosas (el muro del consentimiento, draft -> in_progress y auditar) y NO
            toca a los candidatos. O sea que el botón nunca significó "es la misma persona": significaba
            "sigo con esta evaluación", y el texto le atribuía una consecuencia que no tiene.

            POR ESO LA SALIDA NO ES UN BOTÓN NUEVO CON OTRA ACCIÓN, es decir la verdad: seguir es seguir
            como paciente nuevo, y lo que faltaba era DEJAR CONSTANCIA de que alguien miró y decidió. */}
        {done ? (
          <Badge variant="outline" className="bg-clinical-optimal-bg text-clinical-optimal">
            Identidad confirmada
          </Badge>
        ) : (
          <div className="flex flex-col gap-3">
            <form onSubmit={enviarSinReset(confirmAction)} className="flex flex-col gap-2">
              <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
              {/* QUÉ se descartó y con cuánta similitud: dentro de un año, saber si la coincidencia era
                  del 55% o del 95% es lo que dice si la decisión fue fácil o difícil. */}
              <input
                type="hidden"
                name="descartados"
                value={JSON.stringify(
                  duplicateCandidates.map((c) => ({ patientId: c.patientId, score: c.score })),
                )}
              />
              <Button type="submit" disabled={confirming} className="self-start">
                {confirming
                  ? "Continuando..."
                  : duplicateCandidates.length > 0
                    ? "No es la misma persona · continuar"
                    : "Confirmar identidad"}
              </Button>
              {duplicateCandidates.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Queda registrado que revisaste{" "}
                  {duplicateCandidates.length === 1
                    ? "la coincidencia"
                    : `las ${duplicateCandidates.length} coincidencias`}{" "}
                  y que no es la misma persona.
                </span>
              ) : null}
            </form>

            {duplicateCandidates.length > 0 ? (
              // EL OTRO CASO, DICHO COMO ES. Atlas no fusiona pacientes: si de verdad es la misma persona,
              // quedó registrada dos veces con documentos distintos, y esta evaluación colgaría del
              // duplicado. No se ofrece un botón que finja resolverlo; se dice qué pasa y qué no hacer.
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <strong className="text-foreground">¿Sí es la misma persona?</strong> Entonces está
                registrada dos veces, con documentos distintos. Atlas todavía no puede unir dos pacientes:
                no continúes con esta evaluación y repórtalo, o esta consulta quedará colgada del paciente
                duplicado.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
