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
        Encontramos pacientes con datos parecidos. Confirma solo si es la misma
        persona; no se fusionan automaticamente.
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

        <div className="flex flex-wrap items-center gap-3">
          {done ? (
            <Badge variant="outline" className="bg-clinical-optimal-bg text-clinical-optimal">
              Identidad confirmada
            </Badge>
          ) : (
            <form onSubmit={enviarSinReset(confirmAction)}>
              <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
              <Button type="submit" disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar identidad"}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
