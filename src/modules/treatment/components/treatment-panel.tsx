"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormToast } from "@/components/shared/use-form-toast";

import {
  addNoteAction,
  generateMenuAction,
  saveProtocolAction,
  type TreatmentActionState,
} from "../actions";
import type { MenuSuggestion, TreatmentProtocol } from "../data/treatment-reader";

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
export function TreatmentPanel({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  const locked = !protocol.diagnosisConfirmed;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocolo de tratamiento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {locked ? (
          <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
            El protocolo se habilita cuando el diagnostico esta confirmado. Aprueba el reporte
            para confirmarlo y luego edita el tratamiento.
          </p>
        ) : null}
        <ProtocolForm evaluationId={evaluationId} protocol={protocol} locked={locked} />
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
  parse_failed: { label: "Respuesta invalida", cls: "bg-clinical-critical-bg text-clinical-critical" },
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
        <span>· {new Date(m.generatedAt).toLocaleString("es-CO")}</span>
        <span>· prompt {m.promptVersion}</span>
      </div>
      {m.generatedText ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{m.generatedText}</p>
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
  const addNutra = () => {
    if (!pickId) return;
    if (nutras.some((n) => n.nutraceuticalId === pickId)) return;
    const item = protocol.catalog.find((c) => c.id === pickId);
    if (!item) return;
    setNutras([...nutras, { nutraceuticalId: pickId, name: item.name, dosage: "", durationDays: "" }]);
    setPickId("");
  };
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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="restricciones" value={JSON.stringify(restricciones)} />
      <input type="hidden" name="nutraceuticals" value={nutrasPayload} />
      <input type="hidden" name="guidelines" value={JSON.stringify(guidelines)} />

      {/* Objetivos */}
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-foreground">Objetivos nutricionales</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kcalObjetivo">Objetivo calorico (kcal/dia)</Label>
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
            <Label htmlFor="proteinaGramos">Proteina objetivo (g/dia)</Label>
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

      {/* Nutraceuticos del protocolo */}
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Nutraceuticos</legend>
        <div className="flex gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">Selecciona un nutraceutico</option>
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
                  placeholder="Dosis (ej. 1 capsula/dia)"
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
                  placeholder="Dias"
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
          <p className="text-sm text-muted-foreground">Sin nutraceuticos en el protocolo.</p>
        )}
      </fieldset>

      {/* Guias dietarias */}
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Guias dietarias</legend>
        <div className="flex gap-2">
          <Textarea
            value={guideInput}
            onChange={(e) => setGuideInput(e.target.value)}
            placeholder="Escribe una guia dietaria y agregala"
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
                  aria-label="Quitar guia"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin guias dietarias.</p>
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

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Notas clinicas</h3>
      {protocol.notes.length ? (
        <ul className="flex flex-col gap-2">
          {protocol.notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3 text-sm text-foreground">
              <p>{n.note}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("es-CO")}
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
