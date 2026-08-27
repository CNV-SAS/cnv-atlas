"use client";

import { bloqueCls } from "@/components/shared/bloque";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";

import { saveNutraceuticalsAction, type TreatmentActionState } from "../actions";
// prescriptionSignature vive en el modulo NEUTRO (no aqui): la llama tambien page.tsx (servidor), y una
// funcion exportada por un "use client" no puede invocarse desde el servidor (tumba la pagina, RSC boundary).
import { prescriptionSignature } from "../data/protocol-signature";
import type { TreatmentProtocol } from "../data/treatment-view-types";
import { resolveRecommendation } from "../nutraceuticals-recommendation";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// Etiqueta de disponibilidad comercial (dato del producto): que significa para el paciente.
const AVAILABILITY_LABEL: Record<string, string> = {
  en_consultorio: "En consultorio",
  solo_tienda: "Solo en tienda",
  no_disponible: "No disponible",
};

type NutraLine = { nutraceuticalId: string; name: string; dosage: string; durationDays: string };

// Nutraceuticos, en la subpestaña Rutas (checkpoint 2.3). VISIBLE para toda profesion (Opcion A): si el
// medico va a decidir sobre el paciente necesita saber que se le esta dando (interacciones farmaco-nutriente:
// warfarina/vitK, metformina/B12, corticoides/vitD). Pero EDITAR la prescripcion es solo del nutricionista;
// el resto la ve en modo consulta (lectura). Guardado propio (saveNutraceuticals) con candado y firma de
// remonte, partido del protocolo para no pisarse en bloque.
export function NutraceuticalsSection({
  evaluationId,
  protocol,
  canPrescribe,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  canPrescribe: boolean; // el actor es nutricionista
  locked: boolean; // diagnostico sin confirmar o protocolo aprobado (inmutable)
}) {
  const [state, formAction, pending] = useActionState(saveNutraceuticalsAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [nutras, setNutras] = useState<NutraLine[]>(
    protocol.nutraceuticals.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      name: n.name,
      dosage: n.dosage ?? "",
      durationDays: n.durationDays?.toString() ?? "",
    })),
  );
  const [pickId, setPickId] = useState("");

  const recommended = resolveRecommendation(protocol.recommendedNutraceuticals, protocol.catalog);
  const isAdded = (id: string) => nutras.some((n) => n.nutraceuticalId === id);
  const addProduct = (id: string) => {
    if (!id || isAdded(id)) return;
    const item = protocol.catalog.find((c) => c.id === id);
    if (!item) return;
    setNutras((prev) => [...prev, { nutraceuticalId: id, name: item.name, dosage: "", durationDays: "" }]);
  };
  const addNutra = () => {
    addProduct(pickId);
    setPickId("");
  };
  const nutrasPayload = JSON.stringify(
    nutras.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      dosage: n.dosage.trim() === "" ? null : n.dosage.trim(),
      durationDays: n.durationDays.trim() === "" ? null : Number(n.durationDays),
    })),
  );

  // --- VISTA DE CONSULTA (no nutricionista): recomendados + prescritos en lectura, sin controles ---
  if (!canPrescribe) {
    return (
      <section className={bloqueCls("derivado")}>
      {/* CONTRAINDICACIONES DEL PACIENTE (2026-08-24). Guardar una contraindicacion que nadie ve es la
          mitad del valor: sin esto, el siguiente profesional no se entera de que otro ya descarto un
          producto por una razon clinica. Va ARRIBA y en tono critico, no como nota al pie, porque su
          trabajo es que se lea ANTES de prescribir. Vienen de TODAS las consultas del paciente, no de esta.
          Se muestra tambien en la vista de consulta (otras profesiones): es informacion clinica que
          cualquiera que atienda al paciente debe tener. */}
      <ContraindicacionesAviso protocol={protocol} />

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Nutracéuticos</h3>
          <Badge variant="outline" className="text-[10px] font-normal">
            Vista de consulta
          </Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          La prescripción la edita el nutricionista. Se muestra aquí para que tengas presente qué se le está
          dando al paciente (puede interactuar con lo que prescribas).
        </p>
        <RecommendedList recommended={recommended} readOnly />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Prescrito por el nutricionista</p>
          {protocol.nutraceuticals.length ? (
            <ul className="flex flex-col gap-1 text-sm text-foreground">
              {protocol.nutraceuticals.map((n) => (
                <li key={n.id}>
                  <span className="font-medium">{n.name}</span>
                  {n.dosage ? ` · ${n.dosage}` : ""}
                  {n.durationDays != null ? ` · ${n.durationDays} días` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nutracéuticos prescritos.</p>
          )}
        </div>
      </section>
    );
  }

  // --- VISTA DEL NUTRICIONISTA (editable; deshabilitada si locked) ---
  return (
    <section className={bloqueCls("derivado")}>
      <h3 className="text-base font-semibold text-foreground">Nutracéuticos</h3>
      {/* CONTRAINDICACIONES DEL PACIENTE (2026-08-24). Guardar una contraindicacion que nadie ve es la
          mitad del valor: sin esto, el siguiente profesional no se entera de que otro ya descarto un
          producto por una razon clinica. Va ARRIBA y en tono critico, no como nota al pie, porque su
          trabajo es que se lea ANTES de prescribir. Vienen de TODAS las consultas del paciente, no de esta.
          Se muestra tambien en la vista de consulta (otras profesiones): es informacion clinica que
          cualquiera que atienda al paciente debe tener. */}
      <ContraindicacionesAviso protocol={protocol} />

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        {/* Firma de concurrencia: la prescripcion que el cliente cargó. Si otro profesional la cambió, el
            servidor lo detecta bajo lock y rechaza sin pisar. */}
        <input type="hidden" name="baseSignature" value={prescriptionSignature(protocol)} />
        <input type="hidden" name="nutraceuticals" value={nutrasPayload} />
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <RecommendedList recommended={recommended} isAdded={isAdded} onAdd={addProduct} />
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
              {/* El ESTADO va en la etiqueta de cada opcion (cotejo 2026-08-24): sin el, se puede
                  prescribir un producto que no existe todavia y el paciente se va con una indicacion que
                  no puede cumplir. Los no disponibles NO se ocultan (el profesional debe saber que el
                  modelo los contempla), se marcan. */}
              {protocol.catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.commercialAvailability === "en_consultorio"
                    ? " · en consultorio"
                    : c.commercialAvailability === "solo_tienda"
                      ? " · solo en tienda"
                      : " · aún no disponible"}
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
                      setNutras(nutras.map((x, j) => (j === i ? { ...x, durationDays: e.target.value } : x)))
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
            <p className="text-sm text-muted-foreground">Sin nutracéuticos en la prescripción.</p>
          )}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar prescripción"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Nombre del producto de una contraindicacion. Si es de un COMPONENTE (sin producto asociado) o de uno
// retirado del catalogo, se dice asi en vez de mostrar un id o esconder la fila: una contraindicacion sin
// nombre sigue siendo una advertencia.
function nombreDe(protocol: TreatmentProtocol, nutraceuticalId: string | null): string {
  if (!nutraceuticalId) return "General";
  return protocol.catalog.find((c) => c.id === nutraceuticalId)?.name ?? "Producto retirado del catálogo";
}

function ContraindicacionesAviso({ protocol }: { protocol: TreatmentProtocol }) {
  if (protocol.contraindications.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border-2 border-clinical-critical bg-clinical-critical-bg px-3 py-2 text-sm text-clinical-critical"
    >
      <p className="font-medium">
        {protocol.contraindications.length === 1
          ? "Este paciente tiene una contraindicación registrada"
          : `Este paciente tiene ${protocol.contraindications.length} contraindicaciones registradas`}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {protocol.contraindications.map((c) => (
          <li key={c.id}>
            <span className="font-medium">{nombreDe(protocol, c.nutraceuticalId)}:</span> {c.reason}
            <span className="opacity-80"> ({new Date(c.createdAt).toLocaleDateString("es-CO")})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "30 mL · linea liquida" a partir de lo que el catalogo ya tiene. Sin inventar nada: si falta un campo,
// se muestra lo que haya, y si no hay ninguno, no se muestra la linea.
function posologia(p: { servingSize?: string | null; presentation?: string | null }): string {
  const linea = p.presentation ? `línea ${p.presentation}` : null;
  return [p.servingSize, linea].filter(Boolean).join(" · ");
}

// La lista "El modelo recomienda": en lectura (consulta) sin boton, o con "Agregar" (nutricionista).
function RecommendedList({
  recommended,
  isAdded,
  onAdd,
  readOnly,
}: {
  recommended: ReturnType<typeof resolveRecommendation>;
  isAdded?: (id: string) => boolean;
  onAdd?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (!recommended.length) {
    return (
      <p className="text-sm text-muted-foreground">El modelo no recomendó nutracéuticos para este fenotipo.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">El modelo recomienda</p>
      <ul className="flex flex-col gap-2">
        {recommended.map((r, i) =>
          r.status === "en_catalogo" ? (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-[10rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{r.product.name}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {AVAILABILITY_LABEL[r.product.commercialAvailability] ?? r.product.commercialAvailability}
                  </Badge>
                </div>
                {/* Posologia y composicion (cotejo 2026-08-24): el v8 las muestra en esta tarjeta
                    ("30 mL/dia · 1 vez al dia · linea liquida" y los ingredientes). Verificado que NO
                    son calculadas: salen de una tabla fija por producto. En Atlas ya vivian en el
                    catalogo y no se estaban leyendo. La FRECUENCIA es lo unico que su tabla trae y el
                    catalogo no: la fija el profesional al prescribir, que es donde tiene criterio. */}
                {posologia(r.product) ? (
                  <p className="text-xs font-medium text-foreground">{posologia(r.product)}</p>
                ) : null}
                {r.product.indication ? (
                  <p className="text-xs text-muted-foreground">{r.product.indication}</p>
                ) : null}
                {r.product.composition ? (
                  <p className="text-xs text-muted-foreground">{r.product.composition}</p>
                ) : null}
              </div>
              {!readOnly && onAdd && isAdded ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isAdded(r.product.id)}
                  onClick={() => onAdd(r.product.id)}
                >
                  {isAdded(r.product.id) ? "Agregado" : "Agregar"}
                </Button>
              ) : null}
            </li>
          ) : (
            <li
              key={i}
              className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
            >
              El modelo recomienda <span className="font-medium text-foreground">{r.motorName}</span>, que
              todavía no está en el catálogo.
            </li>
          ),
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        &ldquo;En consultorio&rdquo;: se lo puedes entregar en la consulta. &ldquo;Solo en tienda&rdquo;: el
        paciente lo compra en la tienda de CNV.
      </p>
    </div>
  );
}
