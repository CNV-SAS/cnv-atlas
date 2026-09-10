"use client";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { Panel } from "@/components/shared/panel";
import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormToast, useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import type { CompositionCorrections } from "@/modules/diagnoses/data/composition-map";

import {
  clearBisCorrectionAction,
  correctBisValueAction,
  saveMedidasProfesionalAction,
  type BisCorrectionState,
} from "../actions";
import { variableCruda } from "../services/medidas-corregibles";

// ANTROPOMETRIA EDITABLE. Porte del bloque "Datos Personales" de su archivo, con su nota:
//
//   "Peso, estatura, cintura y cadera son editables (si faltan en el archivo o llegaron mal). Los
//    indices IMC, ICC, ICT, ASMI y las clasificaciones de AF/FFMI/FMI se recalculan automaticamente
//    al editar."
//
// POR QUE HACIA FALTA: si el archivo del equipo trae la cintura mal, hoy la unica salida es cerrar la
// evaluacion y rehacerla. Para un digito es desproporcionado.
//
// EDAD Y SEXO NO SE EDITAN, como en su archivo (alli van en gris, sin borde). No son medidas: son
// identidad del paciente, y cambiarlas no es corregir una medicion.
//
// LA FUERZA PRENSIL Y EL PESO META SI SE EDITAN AQUI desde el 2026-09-07 (punto 4 de su cotejo). Estaban
// al final de las condiciones de la toma y los devolvio dos veces; la segunda con la razon que faltaba y
// que no es de ubicacion sino de SECUENCIA: "el peso meta se establece al revisar al paciente y sus datos;
// si lo ponen antes el profesional NO tiene como acordarse del contexto". Se decide DESPUES de ver la
// composicion, no antes de medir. Van en su propio bloque, debajo, porque no son medidas del equipo: una
// se MIDE con dinamometro y la otra se DECIDE. Cierra DIV-18.
//
// SOLO ANTES DEL DIAGNOSTICO. Despues la medicion queda sellada y el camino es "Corregir la
// evaluacion", que versiona. El gate de verdad esta en la transaccion del writer; esto solo evita
// ofrecer lo que el servidor va a rechazar.

const CAMPOS = [
  { key: "peso", label: "Peso", unidad: "kg" },
  { key: "talla", label: "Estatura", unidad: "cm" },
  { key: "cintura", label: "Cintura", unidad: "cm" },
  { key: "cadera", label: "Cadera", unidad: "cm" },
] as const;

const EMPTY: BisCorrectionState = { error: null, success: null, warning: null };

// De lo que hay ESCRITO en el campo al numero que la tabla pinta. Acepta la coma, que es como se escribe
// aqui, y devuelve null para lo vacio o lo que todavia no es un numero (un "7," a medio teclear): la tabla
// se queda sin referencia en vez de pintar una cifra falsa mientras se escribe.
const aNumero = (v: string): number | null => {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : n;
};

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ",");

// EL GUARD DEL SCROLL VIENE POR `ejecutarAccion` (2026-09-10). Estos formularios escribian a mano lo que
// el helper ya hace (`preventDefault` + FormData + `startTransition`), y al hacerlo se quedaban fuera del
// unico sitio donde se arma el guard. Invocar una server action navega con ScrollBehavior.Default: sin
// guard, la pagina salta al inicio.
export function AntropometriaEditable({
  evaluationId,
  valores,
  corrections = {},
  pesoMetaKg,
  fuerzaPrensilKg,
  sellada,
  onMetaEnVivo,
}: {
  evaluationId: string;
  valores: Partial<Record<(typeof CAMPOS)[number]["key"], number | null>>;
  corrections?: CompositionCorrections;
  /**
   * Avisa del valor de la meta MIENTRAS se escribe, para que la tabla de Wang se recalcule en vivo
   * (2026-09-09). No sustituye al guardado: eso sigue ocurriendo al salir del campo, con su accion y sus
   * guardas. Esto solo adelanta el DIBUJO.
   */
  onMetaEnVivo?: (kg: number | null) => void;
  /** Peso meta (kg). Vive en `evaluations`, no en la medicion: es una decision, no una medida. */
  pesoMetaKg: number | null;
  /** Fuerza prensil (Kgf). Entra al motor como criterio primario del fenotipo de sarcopenia. */
  fuerzaPrensilKg: number | null;
  /** true tras el diagnostico: la medicion ya no se toca aqui. */
  sellada: boolean;
}) {
  const [state, corregir, pending] = useActionState(correctBisValueAction, EMPTY);
  const [limpiarState, limpiar, limpiando] = useActionState(clearBisCorrectionAction, EMPTY);
  useFormToast(state);
  useFormToast(limpiarState);

  return (
    <Panel>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-foreground">Medidas del paciente</h4>
        <p className="text-xs text-muted-foreground">
          {sellada
            ? "El diagnóstico ya se generó sobre estas medidas, así que aquí no se cambian. Para corregirlas, usa Corregir la evaluación: queda una versión nueva y no se reescribe lo emitido."
            : "Puedes corregirlas si faltan en el archivo del equipo o llegaron mal. Los índices (IMC, ICC, ICT, ASMI) y las clasificaciones de AF, FFMI y FMI se recalculan al guardar."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS.map((c) => {
          // Las correcciones vienen keyed por el nombre CRUDO (el encabezado normalizado del Biody),
          // que es como se guardan. La traduccion la hace el MISMO helper que usa el writer: con dos
          // traducciones distintas volveriamos al fallo mudo de buscar en un sitio y guardar en otro.
          const fix = corrections[variableCruda(c.key)];
          const actual = valores[c.key];
          return (
            <div key={c.key} className="flex flex-col gap-1">
              <label htmlFor={`antro-${c.key}`} className="text-xs font-medium text-foreground">
                {c.label} ({c.unidad})
              </label>
              {sellada ? (
                <p className="text-sm text-foreground">{fmt(actual) || "sin dato"}</p>
              ) : (
                // NO se usa la prop `action`: en React 19 resetea los inputs no controlados tras la
                // accion, asi que un valor rechazado borraria lo que el profesional acaba de escribir
                // (hazard 2 de CLAUDE.md).
                <form
                  // KEY DERIVADA DEL VALOR GUARDADO: sin esto el input es no controlado y conserva lo
                  // que el profesional escribio, asi que al restaurar "el del equipo" el aviso decia
                  // que se restauro y el campo seguia mostrando lo otro. Con la key, el campo se
                  // remonta cuando el valor del servidor cambia. Mismo patron que el panel.
                  key={`${c.key}-${actual ?? "sin"}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const datos = new FormData(e.currentTarget);
                    ejecutarAccion(corregir, datos);
                  }}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="evaluationId" value={evaluationId} />
                  <input type="hidden" name="variableName" value={c.key} />
                  <Input
                    id={`antro-${c.key}`}
                    name="value"
                    defaultValue={fmt(actual)}
                    inputMode="decimal"
                    className="h-9 w-28"
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>
                    Guardar
                  </Button>
                </form>
              )}

              {/* CUAL ES CUAL. Un valor corregido que se ve igual que uno medido deja al profesional
                  sin saber que esta mirando, y el crudo del equipo sigue siendo la evidencia de lo que
                  ese aparato midio. Por eso el medido se conserva y se muestra al lado. */}
              {fix ? (
                <p className="text-xs text-clinical-warning">
                  Corregido. El equipo midió {fmt(fix.medido) || "sin dato"} · {fix.porEmail}
                  {sellada ? null : (
                    <>
                      {" · "}
                      <button
                        type="button"
                        disabled={limpiando}
                        onClick={() => {
                          const datos = new FormData();
                          datos.set("evaluationId", evaluationId);
                          datos.set("variableName", c.key);
                          ejecutarAccion(limpiar, datos);
                        }}
                        className="underline"
                      >
                        volver al del equipo
                      </button>
                    </>
                  )}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <MedidasDelProfesional
        evaluationId={evaluationId}
        pesoMetaKg={pesoMetaKg}
        pesoActualKg={valores.peso ?? null}
        fuerzaPrensilKg={fuerzaPrensilKg}
        sellada={sellada}
        onMetaEnVivo={onMetaEnVivo}
      />
    </Panel>
  );
}

// LAS DOS MEDIDAS DEL PROFESIONAL. Bloque propio dentro de Antropometria, no una fila mas de la rejilla
// de arriba, y la separacion es la que Gildardo lleva pidiendo desde el 2026-08-30 ("nunca la puse en las
// condiciones del BIS"): las de arriba son lo que el EQUIPO midio y el profesional corrige si llego mal;
// estas dos son lo que el profesional APORTA (una con dinamometro, la otra como decision clinica).
//
// UN SOLO GUARDADO PARA LOS DOS, a diferencia de las de arriba, que van campo por campo. Las de arriba se
// corrigen de a una y en momentos distintos; estas dos se llenan en el mismo gesto al cerrar la lectura
// de la composicion. Y el formulario manda SIEMPRE los dos campos: vaciar uno significa borrarlo, que es
// una decision del profesional, no "no lo toques".
function MedidasDelProfesional({
  evaluationId,
  pesoMetaKg,
  pesoActualKg,
  fuerzaPrensilKg,
  sellada,
  onMetaEnVivo,
}: {
  onMetaEnVivo?: (kg: number | null) => void;
  evaluationId: string;
  pesoMetaKg: number | null;
  /** El peso MEDIDO. Va aqui para que la meta se fije con el dato de partida a la vista. */
  pesoActualKg: number | null;
  fuerzaPrensilKg: number | null;
  sellada: boolean;
}) {
  const [state, guardar, pending] = useActionState(saveMedidasProfesionalAction, EMPTY);
  // POR LOS DOS LADOS, como en el resumen de IA: la accion revalida y la pantalla pide el arbol. Con uno
  // solo, el arreglo se nota en la siguiente navegacion y no al guardar, que es cuando se mira.
  useFormToastAndRefresh(state);

  // GUARDADO AL SALIR DEL CAMPO (2026-09-09). Ver la nota junto al pie del formulario para el porque.
  const formRef = useRef<HTMLFormElement>(null);
  // SOLO SI CAMBIO, y esto es lo que evita el ruido: sin la comparacion, pasar por los dos campos con el
  // tabulador sin tocar nada dispararia dos escrituras y dos entradas de auditoria por cada visita a la
  // pantalla. `bis.medidas_profesional.recorded` dejaria de significar "el profesional registro algo".
  const ultimoGuardado = useRef({
    weightGoalKg: fmt(pesoMetaKg),
    gripStrengthKg: fmt(fuerzaPrensilKg),
  });
  function guardarSiCambio(e: React.FocusEvent<HTMLInputElement>) {
    const campo = e.currentTarget.name as "weightGoalKg" | "gripStrengthKg";
    const valor = e.currentTarget.value.trim();
    if (valor === ultimoGuardado.current[campo]) return;
    ultimoGuardado.current[campo] = valor;
    const form = formRef.current;
    if (!form) return;
    ejecutarAccion(guardar, new FormData(form));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-foreground">Medidas del profesional</h4>
        <p className="text-xs text-muted-foreground">
          {sellada
            ? "Quedaron selladas con el diagnóstico: ya no se pueden editar aquí."
            : "Las aporta el profesional en la consulta, después de revisar la composición del paciente."}
        </p>
      </div>

      {sellada ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Meta de peso</dt>
            <dd className="text-sm font-semibold text-foreground">
              {pesoMetaKg == null ? "Sin registrar" : `${fmt(pesoMetaKg)} kg`}
            </dd>
            {/* Tambien sellada: una meta sin el peso del que partio no dice cuanto se pedia bajar. */}
            {pesoMetaKg != null && pesoActualKg != null ? (
              <dd className="text-xs text-muted-foreground">desde {fmt(pesoActualKg)} kg</dd>
            ) : null}
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Fuerza prensil</dt>
            <dd className="text-sm font-semibold text-foreground">
              {fuerzaPrensilKg == null ? "Sin registrar" : `${fmt(fuerzaPrensilKg)} Kgf`}
            </dd>
          </div>
        </dl>
      ) : (
        // Mismo patron que arriba: NO se usa la prop `action` (React 19 resetea los inputs no
        // controlados tras la accion y un valor rechazado borraria lo escrito), y la `key` deriva de los
        // valores guardados para que el campo se remonte cuando el servidor cambia.
        <form
          key={`medidas-${pesoMetaKg ?? "sin"}-${fuerzaPrensilKg ?? "sin"}`}
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            ejecutarAccion(guardar, datos);
          }}
          className="flex flex-col gap-3"
          ref={formRef}
        >
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              {/* EL PESO ACTUAL, EN LA MISMA FILA QUE LA ETIQUETA (corrección del smoke, 2026-09-10).
                  Estaba ENTRE la etiqueta y el input: ocupaba una línea propia, empujaba el campo hacia
                  abajo, y los dos de la rejilla dejaban de alinearse. Y en tinta atenuada y tamaño mínimo
                  pasaba desapercibido, que es exactamente lo que se venía a evitar.
                  Ahora va a la derecha de la etiqueta, con el número en el tamaño del cuerpo y en negrita:
                  se ve, y no compite con el campo porque no ocupa línea propia ni lleva caja. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <label htmlFor="peso-meta" className="text-xs font-medium text-foreground">
                  Meta de peso (kg) <span className="text-muted-foreground">(opcional)</span>
                </label>
                {pesoActualKg != null ? (
                  <span className="text-sm text-muted-foreground">
                    actual{" "}
                    <span className="font-semibold text-foreground">{fmt(pesoActualKg)} kg</span>
                  </span>
                ) : null}
              </div>
              <Input
                id="peso-meta"
                name="weightGoalKg"
                defaultValue={fmt(pesoMetaKg)}
                inputMode="decimal"
                placeholder="Ej. 70"
                className="h-9"
                disabled={pending}
                onBlur={guardarSiCambio}
                // EN VIVO MIENTRAS SE ESCRIBE: la tabla de Wang de arriba recalcula la fila de Peso con
                // este valor. El GUARDADO sigue siendo al salir del campo (`onBlur`), que es un acto
                // aparte. Es el mismo patron de la tabla de validacion del nutricionista.
                onChange={(e) => onMetaEnVivo?.(aNumero(e.currentTarget.value))}
              />
              {/* QUE HACE EL CAMPO, junto al campo. Es "la palanca" en sus palabras (2026-08-26), y hasta
                  el 2026-08-31 se GUARDABA y no lo leia nadie: el profesional lo fijaba y la prescripcion
                  no se movia. Decir a donde va es lo que impide volver a dejarlo suelto. */}
              <p className="text-xs text-muted-foreground">
                Es la base del cálculo: el gasto y los gramos de proteína del plan salen de este peso, no
                del medido. Si lo dejas vacío, el modelo usa un peso calculado. El nutricionista puede
                ajustarlo en Tratamiento, pero es el mismo dato, no otro.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              {/* Mismo envoltorio aunque no lleve dato a la derecha: sin el, esta etiqueta ocupa
                  una altura distinta de la de al lado y los dos inputs vuelven a desalinearse. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <label htmlFor="fuerza-prensil" className="text-xs font-medium text-foreground">
                  Fuerza prensil (Kgf) <span className="text-muted-foreground">(opcional)</span>
                </label>
              </div>
              <Input
                id="fuerza-prensil"
                name="gripStrengthKg"
                defaultValue={fmt(fuerzaPrensilKg)}
                inputMode="decimal"
                placeholder="Ej. 35,4"
                className="h-9"
                disabled={pending}
                onBlur={guardarSiCambio}
              />
              {/* Protocolo EWGSOP2 como texto de ayuda junto al campo (Gildardo 2026-08-17 §6): un numero
                  de dinamometro sin protocolo no es comparable entre consultas. */}
              <p className="text-xs text-muted-foreground">
                La mide el profesional en consulta, después de cintura y cadera y antes del BIS: mano
                dominante, sentado, codo a 90°, mejor de tres intentos con descanso. Se registra el mejor,
                no el promedio, en Kgf con un decimal.
              </p>
            </div>
          </div>
          {/* SIN BOTON DE GUARDAR (2026-09-09, peticion de Gildardo via Santiago). Los dos campos se
              guardan AL SALIR del campo, y no en cada tecla: en cada tecla escribiria un "7" mientras se
              teclea "70", y esos valores intermedios son los que alimentan la cadena calorica.

              POR QUE ESTOS DOS Y NO LOS CUATRO DE ARRIBA, que es la distincion de Santiago y es correcta:
              peso, talla, cintura y cadera CONTRADICEN al equipo (el XLSX dice una cosa y el profesional
              otra), asi que corregirlos es una decision y lleva su boton. La meta de peso y la prensil no
              contradicen nada: son datos que solo existen si el profesional los escribe.

              VERIFICADO QUE NO CHOCA CON LA SARCOPENIA: la prensil entra al motor, pero se LEE en el
              momento de generar el diagnostico, desde la fila del intake. No hay ningun calculo colgando
              del guardado, asi que guardar antes o despues no cambia el resultado. Lo unico que habia que
              cuidar es que el guardado haya LLEGADO antes de generar, y de eso se encarga el `pending`,
              que deshabilita los campos mientras la escritura viaja. */}
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {pending ? "Guardando..." : "Se guarda solo al salir del campo."}
          </p>
        </form>
      )}
    </div>
  );
}
