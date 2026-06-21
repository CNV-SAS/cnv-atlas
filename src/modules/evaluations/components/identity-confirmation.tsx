"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { confirmIdentityAction, emitFollowupLinkAction } from "../actions";
import type { ConfirmIdentityState, FollowupLinkState } from "../validations";

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
const followupInitial: FollowupLinkState = { error: null, linkPath: null };

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
  const [followupState, followupAction, emitting] = useActionState(
    emitFollowupLinkAction,
    followupInitial,
  );
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
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
          {new Date(evaluation.createdAt).toLocaleDateString("es-CO")}
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
            <form action={confirmAction}>
              <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
              <Button type="submit" disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar identidad"}
              </Button>
            </form>
          )}

          <form action={followupAction} className="flex items-center gap-2">
            <input type="hidden" name="patientId" value={evaluation.patientId} />
            <Button type="submit" variant="outline" disabled={emitting}>
              {emitting ? "Generando..." : "Emitir link de seguimiento"}
            </Button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          El link de seguimiento es de un solo uso y vence 30 dias despues de
          emitirlo (colchon por defecto).
        </p>

        {followupState.error ? (
          <p className="text-sm text-destructive">{followupState.error}</p>
        ) : null}
        {followupState.linkPath ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <span className="font-medium text-foreground">
              Link de seguimiento (un solo uso, vence en 30 dias)
            </span>
            <span className="break-all text-primary">
              {origin}
              {followupState.linkPath}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
