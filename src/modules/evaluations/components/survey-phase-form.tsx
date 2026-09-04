"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CalendarClock,
  Droplet,
  Footprints,
  Home,
  Leaf,
  PersonStanding,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

import { saveProgressAction, submitSurveyAnswersAction } from "../actions";
import type { SaveProgressState, SurveyFormState } from "../validations";
import type { SurveyQuestionView } from "../data/survey-view-types";
import { AboutYouSection, type AboutYouPrefill } from "./about-you-section";
import { ResumeLinkBox } from "./resume-link-box";
import { SurveyQuestion } from "./survey-widgets";

// FASE 2 del intake: la ENCUESTA. Se llega aqui ya firmado (fase 1) con un resume_token que autentica la
// escritura de respuestas sin sesion. Guarda a medida (al pasar de seccion) para que quien pause y vuelva
// no pierda lo que llevaba, y envia al final. La recoleccion es OPCIONAL: el servidor no exige respuestas.
//
// HAZARDS de navegador (ver CLAUDE.md): (1) keys DISTINTAS en "Siguiente" vs "Enviar"; (2) accion por
// onSubmit + startTransition, NUNCA prop `action` (si el envio falla, el auto-reset de React 19 borraria
// TODAS las respuestas del paciente). No hay OTP en esta fase (el codigo ya se verifico al firmar).

/** El id del contenedor de una pregunta, para el salto desde la lista de pendientes. */
const anclaPregunta = (questionId: string) => `pregunta-${questionId}`;

/**
 * UN ICONO POR DOMINIO, para que las ocho secciones no se lean como ocho pantallas iguales.
 *
 * SON DE IDENTIDAD, NUNCA DE VEREDICTO, y esa es la regla entera. Un plato, una gota o una casa dicen
 * DONDE estás; un triángulo de alerta o un visto bueno dicen QUÉ TAL vas, y eso califica al paciente antes
 * de que conteste. Es la línea que cruza su archivo: pone ⚠ en "Conductas alimentarias" y pinta "Alergias
 * y digestión" en rojo, sobre preguntas tan neutras como cuántas comidas haces o si te han operado.
 *
 * VAN EN `text-muted-foreground`, en ink y sin color propio. Un tono por dominio sería identidad legítima,
 * pero la capa de interfaz no tiene hoy una rampa categórica: solo el azul de marca, que además es el
 * color de acción, así que ocho encabezados azules se leerían como pulsables. Ampliar la paleta es
 * decisión de Santiago (`BRAND.md`) y va después de ver la encuesta terminada; con la forma basta.
 *
 * Se anclan en la ETIQUETA de la sección, que es la misma cadena que agrupa las preguntas. Si una etiqueta
 * cambia, la sección se queda sin icono y no pasa nada más: se degrada a lo que había.
 */
const ICONO_DOMINIO: Record<string, LucideIcon> = {
  Alimentación: UtensilsCrossed,
  "Percepción corporal": PersonStanding,
  Hábitos: Footprints,
  "Conductas alimentarias": CalendarClock,
  "Antecedentes y estilo de vida": Stethoscope,
  "Alergias y digestión": Leaf,
  Hidratación: Droplet,
  "Contexto social": Home,
};

const initialSubmit: SurveyFormState = { error: null, fields: null, done: false };
const initialSave: SaveProgressState = { saved: false, error: null };

export type SurveyPhaseFormProps = {
  resumeToken: string;
  isFollowup: boolean;
  questions: SurveyQuestionView[];
  // Respuestas ya guardadas (reanudacion): questionId -> valor. En el flujo normal (recien firmado) es
  // null y todo arranca en blanco.
  prefill?: Record<string, string> | null;
  // Paso inicial (reanudacion): la ultima seccion DE ENCUESTA con alguna respuesta. En el flujo normal, 0.
  initialStep?: number;
  // Caracterizacion ya guardada (reanudacion), para no perderla al reanudar.
  characterizationPrefill?: AboutYouPrefill | null;
  // Etnia: el campo solo aparece si el paciente otorgo la autorizacion de investigacion (consent v1.0).
  ethnicityAuthorized?: boolean;
};

// Introduccion por seccion (ECA2): encuadra la pregunta ANTES de responder. La de Alimentacion es la que
// mas cambia el dato de origen ("piensa en como comes habitualmente, no en lo que comiste ayer" evita que
// el paciente responda por el ultimo dia). Verbatim de ATLAS_v8.html. Keyed por la etiqueta de seccion.
const SECTION_INTRO: Record<string, string> = {
  Alimentación:
    "Piensa en cómo comes habitualmente, no en lo que comiste ayer. Para cada alimento, elige con qué frecuencia lo consumes en una semana típica. La referencia debajo de cada grupo te ayuda a imaginar la cantidad usual.",
};

export function SurveyPhaseForm({
  resumeToken,
  isFollowup,
  questions,
  prefill = null,
  initialStep = 0,
  characterizationPrefill = null,
  ethnicityAuthorized = false,
}: SurveyPhaseFormProps) {
  const [state, submit, submitting] = useActionState(submitSurveyAnswersAction, initialSubmit);
  const [saveState, save, saving] = useActionState(saveProgressAction, initialSave);
  const formRef = useRef<HTMLFormElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // En seguimiento el perfil ya se capturo (dato estable): "Sobre ti" solo muestra el motivo. En inicial
  // muestra los 4 campos de perfil + motivo.
  const includeProfile = !isFollowup;

  // Agrupa las preguntas por dominio (section), preservando el orden del reader.
  const sections = useMemo(() => {
    const groups: { title: string; questions: SurveyQuestionView[] }[] = [];
    for (const q of questions) {
      const title = q.section ?? "Otras";
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.questions.push(q);
      else groups.push({ title, questions: [q] });
    }
    return groups;
  }, [questions]);

  // El wizard tiene "Sobre ti" como paso 0 y luego las secciones de encuesta (pasos 1..N). Se arranca en
  // "Sobre ti" salvo al reanudar CON respuestas: ahi se aterriza en la seccion donde iba (initialStep+1).
  const totalSteps = sections.length + 1;
  const resuming = Boolean(prefill && Object.keys(prefill).length > 0);
  const initialWizardStep = resuming
    ? Math.min(Math.max(initialStep, 0), sections.length - 1) + 1
    : 0;
  const [step, setStep] = useState(initialWizardStep);
  // Advertencia de envio con preguntas sin responder (no bloquea): al pulsar "Enviar", si faltan, se
  // muestra el conteo y se deja enviar igual. null = sin advertencia pendiente.
  const [confirmMissing, setConfirmMissing] = useState<number | null>(null);
  // Las preguntas sin responder, para el listado que lleva a cada una. Se calcula al pedirlo (no en cada
  // tecla): recorrer el formulario entero en cada cambio no aporta nada y el paciente lo pide una vez.
  const [pendientes, setPendientes] = useState<SurveyQuestionView[] | null>(null);
  // Total de preguntas de ENCUESTA (sin "Sobre ti", que es opcional): el denominador de la barra.
  const totalPreguntas = questions.length;
  // Arranca contando el PREFILL, no en cero: quien reanuda con media encuesta hecha tiene que ver la
  // barra donde la dejo. Arrancar en cero le diria que perdio el avance justo cuando volvio a
  // comprobar que no lo perdio. Se usa el MISMO isAnswered que el resto, sobre el valor tal como lo
  // guarda el servidor (que es lo que trae el prefill), no sobre el DOM, que aun no esta montado.
  const [respondidas, setRespondidas] = useState(() =>
    prefill ? questions.filter((q) => isAnswered(prefill[q.id])).length : 0,
  );
  const isAbout = step === 0;
  const current = isAbout ? null : sections[step - 1];
  const isLast = step === totalSteps - 1;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Guarda el SNAPSHOT COMPLETO (contrato del writer): lee todo el formulario (todas las secciones estan
  // montadas, solo ocultas) y lo manda. Los guardados se serializan por useActionState; como cada uno
  // lleva todo lo contestado, el ultimo gana y no se pierde nada aunque se avance mientras guarda.
  const persist = () => {
    const form = formRef.current;
    if (!form) return;
    startTransition(() => save(new FormData(form)));
  };

  // GUARDADO DENTRO DE LA SECCION (2026-08-27). Antes solo se guardaba AL PASAR de seccion, asi que una
  // seccion de 18 preguntas eran 18 respuestas que se perdian si el telefono se quedaba sin bateria, se
  // cerraba la pestaña o se caia la conexion a mitad. La encuesta es larga y el paciente la contesta en
  // un rato, no de corrido.
  //
  // CADA CUANTO: no en cada pulsacion. Se espera a que deje de responder (1,2 s sin cambios) y entonces
  // se guarda UNA vez; marcar cinco opciones seguidas produce un guardado, no cinco. Y como persist
  // manda el SNAPSHOT COMPLETO, un guardado que llegue tarde no puede dejar el estado a medias: el
  // ultimo siempre gana. Por eso mismo el indicador tampoco parpadea en cada clic.
  //
  // NUNCA BLOQUEA. Es una accion aparte del envio, asi que un fallo de red no detiene la encuesta: el
  // paciente sigue contestando y el siguiente cambio reintenta solo. Y el envio final manda todo de
  // nuevo, asi que un guardado intermedio fallido cuesta el punto de retomado, nunca las respuestas.
  const guardadoPendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistDiferido = () => {
    // El conteo se refresca EN EL ACTO (es leer el formulario, no una llamada), aunque el guardado
    // espere: la barra tiene que moverse cuando el paciente responde, no 1,2 s despues.
    recontar();
    if (guardadoPendiente.current) clearTimeout(guardadoPendiente.current);
    guardadoPendiente.current = setTimeout(() => {
      guardadoPendiente.current = null;
      persist();
    }, 1200);
  };

  // CUANTAS LLEVA RESPONDIDAS, con LA MISMA VARA que el aviso de "te faltan N" (countUnanswered) y que
  // el gate del servidor. Si la barra contara distinto, el paciente veria la barra al 100 % y el aviso
  // diciendole que le faltan tres: dos superficies leyendo fuentes distintas, que es justo el fallo que
  // ya nos costo un smoke. "Sobre ti" es opcional y no entra en el conteo, igual que en el aviso.
  const recontar = () => {
    const form = formRef.current;
    if (!form) return;
    setRespondidas(questions.length - countUnanswered(form));
  };

  // Toda navegacion guarda primero (el snapshot captura la seccion que se deja). Navegar tambien
  // descarta la advertencia pendiente: el paciente esta revisando, ya no esta en el punto de envio.
  const goTo = (i: number) => {
    if (i < 0 || i > totalSteps - 1) return;
    // Cancela el guardado en espera: navegar ya guarda, y dejarlo correr dispararia dos seguidos.
    if (guardadoPendiente.current) {
      clearTimeout(guardadoPendiente.current);
      guardadoPendiente.current = null;
    }
    persist();
    setConfirmMissing(null);
    setStep(i);
    scrollTop();
  };
  const goNext = () => {
    if (isLast) return;
    persist();
    setConfirmMissing(null);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    scrollTop();
  };
  const goBack = () => {
    if (step === 0) return;
    persist();
    setConfirmMissing(null);
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  // Preguntas de encuesta sin responder, con EL MISMO predicado que el gate del profesional (isAnswered).
  // Antes contaba "cualquier valor no vacio", asi que una multi con "Otra" SIN texto (emitida como el token
  // pelado) se contaba como respondida aqui pero el gate la veia como hueco: dos varas para lo mismo, y el
  // paciente veia la que miente. Ahora se reconstruye el valor TAL COMO lo guarda el servidor (multi -> JSON,
  // resto -> el valor) y se evalua con el mismo isAnswered. "Sobre ti" es opcional y NO cuenta aqui.
  // DEVUELVE LA LISTA, no el conteo, y el conteo sale de la lista (2026-09-04). Antes devolvia un numero
  // y el aviso solo podia decir "te faltan 61", que es lo que Santiago pidio cambiar: la lista lleva a
  // cada pregunta. Se hace asi, con UNA funcion, y no con una segunda que las liste: dos recorridos del
  // mismo formulario son dos varas, y la barra diciendo 100 % con el aviso diciendo que faltan tres es
  // exactamente el fallo que ya nos costo un smoke.
  const sinResponder = (form: HTMLFormElement): SurveyQuestionView[] => {
    const fd = new FormData(form);
    return questions.filter((q) => {
      const raw = fd
        .getAll(`answer_${q.id}`)
        .map((v) => String(v).trim())
        .filter((v) => v !== "");
      const stored =
        q.type === "opcion_multiple" ? (raw.length ? JSON.stringify(raw) : "") : (raw[0] ?? "");
      return !isAnswered(stored);
    });
  };
  const countUnanswered = (form: HTMLFormElement): number => sinResponder(form).length;

  /**
   * Lleva a una pregunta: cambia a su seccion y la deja a la vista.
   *
   * EL SCROLL VA EN EL CUADRO SIGUIENTE porque la seccion destino todavia no esta VISIBLE cuando se pide
   * el salto: `setStep` es un cambio de estado, y el nodo esta montado pero oculto hasta que React pinta.
   * Buscarlo antes devuelve un elemento sin caja y `scrollIntoView` no hace nada.
   */
  const irAPregunta = (q: SurveyQuestionView) => {
    const i = sections.findIndex((s) => s.title === q.section);
    if (i < 0) return;
    setPendientes(null);
    setConfirmMissing(null);
    setStep(i + 1);
    requestAnimationFrame(() => {
      document.getElementById(anclaPregunta(q.id))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Envio real, SIN auto-reset (transicion sobre el form del ref, no la prop `action`): si falla, no
  // borra las respuestas del paciente (hazard React 19, ver CLAUDE.md).
  const doSubmit = () => {
    const form = formRef.current;
    if (!form) return;
    setConfirmMissing(null);
    startTransition(() => submit(new FormData(form)));
  };

  // "Enviar": si faltan preguntas y aun no se advirtio, muestra el aviso y NO envia todavia (una sola
  // vez; el propio boton de "Enviar" ya no vuelve a frenar porque el aviso trae su propio "Enviar asi").
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const faltan = sinResponder(form);
    if (faltan.length > 0) {
      // El aviso aparece pegado al boton (abajo): no se hace scroll, se veria fuera de pantalla.
      setConfirmMissing(faltan.length);
      setPendientes(faltan);
      return;
    }
    doSubmit();
  };

  // Indicador de guardado (no puede mentir): "Guardado" SOLO tras confirmacion del servidor. Un fallo se
  // muestra explicito, con reintento; el envio final manda todo de nuevo, asi que un guardado intermedio
  // fallido no pierde datos, solo el punto de retomado.
  const saveStatus: "saving" | "saved" | "error" | "idle" = saving
    ? "saving"
    : saveState.error
      ? "error"
      : saveState.saved
        ? "saved"
        : "idle";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      onChange={persistDiferido}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isLast && e.target instanceof HTMLElement && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="resumeToken" value={resumeToken} />
      <div ref={topRef} />

      {/* Enlace de reanudacion + aviso de que puede pausar. Al inicio de la fase 2 (no en una pantalla
          aparte): el paciente lo ve y lo puede copiar ANTES de empezar, no solo tras guardar. */}
      <ResumeLinkBox resumeToken={resumeToken} />

      {/* Progreso */}
      <div className="flex flex-col gap-2">
        {/* El TITULO de la seccion ya va en el h2 de abajo: aqui salia dos veces, con los chips en medio.
            En un telefono eso son dos renglones de una pantalla que todavia no muestra ninguna pregunta. */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {respondidas} de {totalPreguntas} {totalPreguntas === 1 ? "pregunta" : "preguntas"}
          </p>
          {current ? (
            <p className="text-xs text-muted-foreground">
              Sección {step} de {sections.length}
            </p>
          ) : null}
        </div>
        {/* LA BARRA MIDE TRABAJO, NO PASOS (2026-08-27). Antes iba por paso, y "paso 2 de 9" con la barra
            al 22 % mentia por el lado que desanima: ese paso 2 es Alimentación, que tiene 18 preguntas
            por delante, mientras que otros tienen tres. El paciente veia poco avance justo donde mas
            estaba trabajando. Contar respuestas dice lo que de verdad lleva hecho. */}
        <Progress value={totalPreguntas > 0 ? Math.round((respondidas / totalPreguntas) * 100) : 0} />
        {/* Subpestanas: "Sobre ti" (paso 0) + las secciones de encuesta. Todas alcanzables (opcional). */}
        <nav
          aria-label="Secciones de la encuesta"
          className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
        >
          {["Sobre ti", ...sections.map((s) => s.title)].map((title, i) => {
            const activo = i === step;
            return (
              <button
                key={`${title}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-current={activo ? "step" : undefined}
                ref={
                  activo
                    ? (el) => {
                        // En la tira con desplazamiento el chip activo puede quedar fuera de vista al
                        // avanzar; se trae al centro. "nearest" evita mover la pagina entera.
                        el?.scrollIntoView({ block: "nearest", inline: "center" });
                      }
                    : undefined
                }
                className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                {title}
              </button>
            );
          })}
        </nav>
      </div>

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {/* Paso 0: "Sobre ti" (caracterizacion opcional). Montado siempre; solo visible en el paso 0. */}
      <div className={isAbout ? "" : "hidden"}>
        <AboutYouSection
          includeProfile={includeProfile}
          prefill={characterizationPrefill}
          ethnicityAuthorized={ethnicityAuthorized}
        />
      </div>

      {/* Secciones de encuesta (todas montadas; solo se muestra la actual). Paso i+1 en el wizard. */}
      {sections.map((s, i) => {
        const active = step === i + 1;
        return (
          <section key={s.title} className={`flex flex-col gap-4 ${active ? "" : "hidden"}`}>
            <div className="flex flex-col gap-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                {ICONO_DOMINIO[s.title] ? (
                  (() => {
                    const Icono = ICONO_DOMINIO[s.title];
                    return <Icono className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
                  })()
                ) : null}
                {s.title}
              </h2>
              {SECTION_INTRO[s.title] ? (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {SECTION_INTRO[s.title]}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Responde lo que aplique a tu caso. Puedes dejar en blanco lo que no sepas.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:gap-6">
              {/* SIN ENCABEZADOS DE CATEGORIA, y es deliberado (Santiago, 2026-08-31). Los tres rotulos de
                  la matriz de frecuencia ("Alimentación Real protectora", "energética (moderar)",
                  "Procesados y ultraprocesados") estuvieron aqui, portados de su archivo, y se RETIRARON por
                  sesgo de deseabilidad: nombrar la categoria antes de que el paciente conteste empuja la
                  respuesta hacia lo que se espera de el, y esto es un cuestionario de frecuencia. Viven
                  ahora en las vistas del profesional (survey-readonly y survey-edit-form). El ORDEN, que es
                  el mensaje que el pidio, se conserva intacto. Candado: encabezados-frecuencia.test.ts. */}
              {s.questions.map((q) => (
                <div
                  key={q.id}
                  // ANCLA para el salto desde la lista de preguntas pendientes. Va sobre el contenedor y
                  // no sobre el input: al saltar tiene que verse el ENUNCIADO, no el control suelto.
                  id={anclaPregunta(q.id)}
                  className="scroll-mt-24 rounded-lg border border-border/60 bg-muted/20 p-3 sm:bg-transparent sm:p-0 sm:border-0"
                >
                  <SurveyQuestion q={q} answer={prefill?.[q.id] ?? null} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Navegacion + estado de guardado */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {/* El texto dice lo que el sistema HACE. Antes decia "al pasar de sección" y era cierto;
              desde que se guarda tambien dentro de la seccion, dejarlo habria sido describir mal el
              mecanismo, y eso hace que el paciente decida mal (aqui: cerrar la pestaña creyendo que
              pierde lo que lleva de esta seccion). */}
          <span className="text-muted-foreground">Guardamos tu avance a medida que respondes.</span>
          {saveStatus === "saving" ? (
            <span className="font-medium text-muted-foreground">Guardando…</span>
          ) : saveStatus === "saved" ? (
            <span className="font-medium text-primary">Avance guardado</span>
          ) : saveStatus === "error" ? (
            <span className="flex items-center gap-2 font-medium text-destructive">
              No se pudo guardar el avance.
              <button type="button" onClick={persist} className="underline">
                Reintentar
              </button>
            </span>
          ) : null}
        </div>

        {/* Confirmacion de envio con preguntas sin responder: informa, no culpa, no bloquea. Solo en el
            ultimo paso (donde vive "Enviar"). "Enviar asi" es type=button (no otro submit) para no
            reintroducir el hazard de keys compartidas entre botones de envio (ver CLAUDE.md).

            SUPERFICIE NEUTRA, y es un ARREGLO del 2026-09-04. Esto usaba `clinical-warning`, o sea la
            capa donde el color SIGNIFICA severidad y sale de los clasificadores de Gildardo. **Una
            pregunta en blanco no es una severidad clinica.** El texto decia "puedes enviarla asi" y el
            contenedor decia "algo va mal", y en un cuestionario que el paciente contesta eso es de la
            misma familia que los encabezados de categoria que retiramos el 2026-08-31: presion sobre la
            respuesta antes de darla. Solo que aqui la presion es para que conteste algo que le acabamos
            de decir que puede dejar.

            Y NO SE USA `attention` (el ambar operativo) TAMPOCO, aunque existe y seria correcto en el eje:
            ese token dice "esto pide que hagas algo", y aqui las dos salidas son igual de validas. Lo que
            hay es una eleccion, no un pendiente. Neutro es lo que no empuja a ninguna de las dos. */}
        {isLast && confirmMissing !== null ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            <p>
              Te {confirmMissing === 1 ? "falta" : "faltan"}{" "}
              <span className="font-semibold">
                {confirmMissing} {confirmMissing === 1 ? "pregunta" : "preguntas"}
              </span>{" "}
              por responder. Puedes enviarla así y completarlas con tu profesional, o volver a revisarlas.
            </p>
            {/* LA LISTA, QUE LLEVA A CADA PREGUNTA (2026-09-04, portado de su encuesta). Antes decia
                cuantas faltaban y nada mas, asi que el paciente tenia que buscarlas a mano por ocho
                secciones. Su archivo lo resuelve con un listado en el que cada fila salta a su pregunta.

                LO QUE NO SE PORTA ES EL TONO. El suyo pinta las filas de ambar con numeros naranja, y el
                contador en rojo. Eso convierte lo que el paciente NO SABE en un error suyo, y es lo
                contrario de la frase de arriba: acabamos de decirle que puede dejarlas. La lista es una
                ayuda para navegar, no un reproche, y va en superficie neutra.

                SE MUESTRAN LAS PRIMERAS OCHO. Con 61 sin responder, una lista de 61 dentro de un aviso no
                se lee ni se navega, y en un telefono empuja los dos botones fuera de la pantalla. Ocho
                son un punto por donde empezar; al volver a "Enviar" se recalcula lo que quede. */}
            {pendientes && pendientes.length > 0 ? (
              <div className="flex flex-col gap-1">
                {pendientes.slice(0, 8).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => irAPregunta(q)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="shrink-0 font-medium text-muted-foreground">{q.number}.</span>
                    <span className="min-w-0 flex-1 truncate">{q.text}</span>
                    <span className="shrink-0 text-muted-foreground">{q.section}</span>
                  </button>
                ))}
                {pendientes.length > 8 ? (
                  <p className="px-2 text-xs text-muted-foreground">
                    y {pendientes.length - 8} más.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button key="confirm-send" type="button" onClick={doSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Enviando..." : "Enviar así"}
              </Button>
              <Button
                key="confirm-review"
                type="button"
                variant="outline"
                onClick={() => setConfirmMissing(null)}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Volver a revisar
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={`flex items-center justify-between gap-3 ${
            isLast && confirmMissing !== null ? "hidden" : ""
          }`}
        >
          <Button key="nav-back" type="button" variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
            Anterior
          </Button>
          {/* keys DISTINTAS a proposito (ver CLAUDE.md): sin ellas React reutiliza el nodo al pasar de
              "Siguiente" a "Enviar" y el navegador auto-envia al entrar a la ultima seccion, perdiendola
              en TODOS los pacientes. Solo se ve en navegador real. */}
          {isLast ? (
            <Button key="nav-submit" type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : isFollowup ? "Enviar seguimiento" : "Enviar"}
            </Button>
          ) : (
            <Button key="nav-next" type="button" onClick={goNext}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
