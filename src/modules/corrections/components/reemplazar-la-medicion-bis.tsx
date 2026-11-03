"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { avisoDeHuellaRepetida, type HuellaRepetida } from "@/modules/bis/huella-repetida";

import { medicionDeOtroPacienteAction, type MedicionDeOtroState } from "../actions";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// "REEMPLAZAR LA MEDICION BIS": UN SOLO BOTON, Y EL MOTIVO DECIDE EL CAMINO
//
// ═══ DE DONDE SALE ═══
//
// Gildardo v12 §1.3: *"«Eliminar toma BIS»... Sirve para el caso del control: la toma quedo mal, se borra
// y el profesional la vuelve a subir."*
//
// Santiago, 2026-11-03, mirando Antrop. & BIS: *"Yo pensé que iba a aparecer un botón que dijera algo tipo
// Resubir Medición BIS o Reemplazar medición BIS o eliminar medición BIS... ¿No era lo que estaba pidiendo
// Gildardo? Ya que el botón de corregir es para corregir las condiciones BIS."*
//
// Y TENIA RAZON EN LAS DOS MITADES. Lo construido cubria SOLO el caso raro (la medicion es de otra
// persona) y lo nombraba por ese caso, asi que quien venia a repetir una toma mala no reconocia el sitio;
// y el camino para reimportar estaba escondido en un `details` plegado dentro de la seccion de la
// medicion, o sea un SEGUNDO sitio. Dos entradas parciales para el mismo acto.
//
// ═══ LA FORMA: EL MOTIVO PRIMERO, EL CAMINO DESPUES ═══
//
// Un boton visible, y al abrirlo la pregunta que de verdad decide: ¿la toma quedo mal, o es de otra
// persona? No es una etiqueta para el registro: de esa respuesta sale si en la historia clinica queda
// escrito que ese cuerpo era de otra persona (la marca de la 0226) y con que `trigger_type` se cuenta
// (0235). Preguntarlo DESPUES, en un campo de texto libre, dejaria la decision clinica dentro de una
// frase que nadie puede contar.
//
// Y EL CAMINO LO DECIDE EL ESTADO DE LA CONSULTA, no el profesional:
//
//   SIN DIAGNOSTICO   se reimporta en sitio. No hay nada sellado encima, y `importBisFromXlsx` BORRA la
//                     toma anterior antes de insertar la nueva (en la misma transaccion), asi que la
//                     consulta queda con una sola medicion y no hay version que emitir.
//   CON DIAGNOSTICO   version nueva SIN medicion, y la actual queda reemplazada y legible con su firma.
//                     Pisar la medicion por debajo de un diagnostico emitido dejaria un documento
//                     afirmando sobre una toma que ya no existe.
//
// ═══ Y EL AVISO DE LA HUELLA REPETIDA SIGUE AQUI, ENCABEZANDO ═══
//
// Es la decision de Santiago del 2026-10-28 y no se mueve: *"¿No seria mejor unificar ambos bloques en uno
// solo amarillo de advertencia?"* Un aviso que no lleva su salida al lado obliga a buscarla, y quien la
// busca y no la encuentra deja el dato mal. Por eso el aviso y el acto son UN bloque, arriba de la
// pestaña, y por eso el bloque existe tambien cuando no hay nada que avisar: el profesional puede darse
// cuenta por otro camino (la edad del equipo, una masa grasa imposible) y la salida tiene que estar igual.
//
// ═══ LOS HAZARDS QUE APLICAN ═══
//
//   · `enviarSinReset` y nunca la prop `action` (hazard 2): un error de validacion no puede borrar el
//     motivo que la persona acabo de escribir.
//   · LA CAUSA VIAJA EN UN `input hidden` CON `name` (hazard 5): si fuera el `value` del boton de envio,
//     `new FormData(form)` no la mandaria y el servidor no sabria por que se retira la toma.
//   · La confirmacion es una CASILLA DENTRO del formulario, con `name`, asi que viaja.
//   · El boton exige las dos cosas en su `disabled` Y LO DICE EN SU ROTULO (hazard 8).
//   · EL FORMULARIO DE IMPORTAR NO SE ANIDA (hazard 7): `BisImportForm` trae su propio `<form>`, y los dos
//     caminos son ramas excluyentes, asi que nunca queda uno dentro del otro.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const inicial: MedicionDeOtroState = {
  error: null,
  success: null,
  warning: null,
  nuevaEvaluacionId: null,
};

type Causa = "toma_mal_hecha" | "otro_paciente";

/** Lo que cada motivo dice en pantalla. Una sola fuente: el boton, el titulo y el texto salen de aqui. */
const MOTIVOS: { causa: Causa; titulo: string; detalle: string }[] = [
  {
    causa: "toma_mal_hecha",
    titulo: "La toma quedó mal",
    detalle:
      "El paciente no estaba en condiciones, los electrodos no hicieron contacto o el archivo del equipo salió incompleto. La medición es de este paciente, pero no sirve.",
  },
  {
    causa: "otro_paciente",
    titulo: "Importé el archivo de otra persona",
    detalle:
      "Lo que está cargado es la bioimpedancia de otro paciente. No es un dato mal digitado: el diagnóstico de esta consulta se calculó con el cuerpo de alguien más.",
  },
];

export function ReemplazarLaMedicionBis({
  evaluationId,
  repetida = null,
  diagnosticoGenerado,
  reimportar = null,
}: {
  evaluationId: string;
  /**
   * EL AVISO DE QUE ESTA MEDICION ESTA EN OTRA CONSULTA. null = no esta repetida, y entonces el bloque
   * queda discreto: no hay nada que avisar, solo la salida.
   */
  repetida?: HuellaRepetida | null;
  /** Decide el camino, no el motivo: con diagnostico sellado no se pisa la medicion, se versiona. */
  diagnosticoGenerado: boolean;
  /**
   * EL FORMULARIO DE IMPORTAR, montado por la pestaña (que es de servidor) y colocado aqui.
   *
   * Viene como `children` y no se construye aqui a proposito: necesita datos de servidor (el dispositivo,
   * si ya hay medicion) y este componente es de cliente. null cuando no hay camino de reimport, que es
   * exactamente cuando ya hay diagnostico.
   */
  reimportar?: ReactNode | null;
}) {
  const [state, action, pending] = useActionState(medicionDeOtroPacienteAction, inicial);
  // EL TOAST SIN REFRESCO: al terminar se NAVEGA a la version nueva (ver abajo). Un `router.refresh()`
  // ademas montaria los segmentos dos veces y la pagina saltaria al inicio dos veces.
  useFormToast(state);
  const router = useRouter();
  const [abiertoPorElUsuario, setAbierto] = useState(false);
  const [causaElegida, setCausa] = useState<Causa | null>(null);
  const [motivoEscrito, setMotivo] = useState("");
  const [confirmadoPorElUsuario, setConfirmado] = useState(false);

  // ═══ AL TERMINAR SE CIERRA, SE LIMPIA Y SE VA A LA VERSION NUEVA (Santiago, 2026-10-29) ═══
  //
  // Y LAS CUATRO COSAS SE DERIVAN DEL HECHO, no se apagan a mano: `nuevaEvaluacionId` ES el hecho de que
  // la correccion ocurrio, asi que lo que se ve se calcula de ahi y no puede quedar desincronizado. Es la
  // misma leccion que la marca del tratamiento apoyado en un diagnostico anterior: una bandera que hay que
  // acordarse de bajar sobrevive al arreglo o muere antes.
  //
  // Y SIGUE CUMPLIENDO LO QUE IMPORTA: si la navegacion no ocurre (un fallo de red no llega al catch del
  // servidor y la pantalla queda muda), lo que queda delante NO es un formulario listo para repetir un
  // acto irreversible que ya se hizo.
  const yaSeCorrigio = state.nuevaEvaluacionId != null;
  const abierto = abiertoPorElUsuario && !yaSeCorrigio;
  const causa = yaSeCorrigio ? null : causaElegida;
  const motivo = yaSeCorrigio ? "" : motivoEscrito;
  const confirmado = yaSeCorrigio ? false : confirmadoPorElUsuario;
  const motivoSuficiente = motivo.trim().length >= 15;
  const elMotivo = MOTIVOS.find((m) => m.causa === causa) ?? null;

  // LA NAVEGACION SI ES UN EFECTO, porque es lo unico que no se puede derivar: ir a otra URL es una
  // accion, no un estado. `replace` y no `push`: la version vieja queda legible como registro, pero no es
  // un sitio al que volver con el boton de atras, donde diria "reemplazada" sin explicar por que.
  useEffect(() => {
    if (!state.nuevaEvaluacionId) return;
    router.replace(`/ani-bis-e/${state.nuevaEvaluacionId}`);
  }, [state.nuevaEvaluacionId, router]);

  const cerrar = () => {
    setAbierto(false);
    setCausa(null);
    setMotivo("");
    setConfirmado(false);
  };

  // ── CERRADO: EL AVISO (si lo hay) Y EL BOTON ─────────────────────────────────────────────────────
  if (!abierto) {
    return (
      <section
        className={
          repetida
            ? "no-print flex flex-col gap-2 rounded-xl border border-attention bg-attention-bg p-4"
            : "no-print flex flex-col gap-2 rounded-xl border border-dashed border-clinical-warning/40 bg-muted/20 p-4"
        }
      >
        {repetida ? (
          <>
            <h3 className="flex items-start gap-2 text-sm font-semibold text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
              {avisoDeHuellaRepetida(repetida)}
            </h3>
            <p className="max-w-prose text-sm text-muted-foreground">
              Las cuatro lecturas eléctricas del equipo son idénticas hasta el último decimal, así que es
              la misma toma física y no dos mediciones parecidas. Este aviso desaparece solo cuando la toma
              deje de estar en dos consultas.
            </p>
          </>
        ) : (
          <h3 className="text-sm font-semibold text-foreground">
            ¿Hay que reemplazar la medición BIS de esta consulta?
          </h3>
        )}
        <p className="max-w-prose text-sm text-muted-foreground">
          Sirve para los dos casos: la toma quedó mal y hay que repetirla, o el archivo importado era de
          otra persona. Al pulsar se pregunta cuál de los dos es, porque no se resuelven igual.
        </p>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
            Reemplazar la medición BIS
          </Button>
        </div>
      </section>
    );
  }

  // ── ABIERTO Y SIN MOTIVO: LA PREGUNTA QUE DECIDE ─────────────────────────────────────────────────
  if (!causa) {
    return (
      <section className="no-print flex flex-col gap-3 rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg p-4">
        <h3 className="text-sm font-semibold text-clinical-warning">
          ¿Por qué hay que reemplazar la medición?
        </h3>
        <p className="max-w-prose text-sm text-foreground">
          Las dos quedan en la historia clínica, y no dicen lo mismo: una es una toma que hay que repetir,
          la otra es un dato de salud de otra persona en esta historia.
        </p>
        <div className="flex flex-col gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m.causa}
              type="button"
              onClick={() => setCausa(m.causa)}
              className="flex max-w-prose flex-col gap-1 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="text-sm font-semibold text-foreground">{m.titulo}</span>
              <span className="text-xs text-muted-foreground">{m.detalle}</span>
            </button>
          ))}
        </div>
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={cerrar}>
            Cancelar
          </Button>
        </div>
      </section>
    );
  }

  // ── CON MOTIVO Y SIN DIAGNOSTICO: SE REIMPORTA EN SITIO ──────────────────────────────────────────
  //
  // El formulario de importar va FUERA de cualquier `<form>` propio (hazard 7): aqui no se abre ninguno.
  if (!diagnosticoGenerado) {
    return (
      <section className="no-print flex flex-col gap-3 rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg p-4">
        <h3 className="text-sm font-semibold text-clinical-warning">{elMotivo?.titulo}</h3>
        <p className="max-w-prose text-sm text-foreground">
          Esta consulta todavía no tiene diagnóstico, así que no hay nada emitido sobre esa toma: se sube el
          archivo correcto y <strong>la medición actual se reemplaza</strong>, en un solo paso. Queda rastro
          de que hubo un reemplazo y de cuál era la medición anterior.
        </p>
        {causa === "otro_paciente" ? (
          <p className="max-w-prose text-xs text-muted-foreground">
            La toma de la otra persona se retira de esta consulta por completo, así que no queda nada suyo
            en esta historia clínica. Su propio archivo lo puede importar en su consulta sin que el sistema
            lo rechace.
          </p>
        ) : null}
        {reimportar ?? (
          <p className="max-w-prose text-sm text-muted-foreground">
            El import no está disponible en esta consulta. Confirma primero la identidad del paciente.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCausa(null)}>
            Cambiar el motivo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={cerrar}>
            Cancelar
          </Button>
        </div>
      </section>
    );
  }

  // ── CON MOTIVO Y CON DIAGNOSTICO: VERSION NUEVA SIN MEDICION ─────────────────────────────────────
  return (
    <section className="no-print flex flex-col gap-3 rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg p-4">
      <h3 className="text-sm font-semibold text-clinical-warning">{elMotivo?.titulo}</h3>
      <div className="max-w-prose text-sm text-foreground">
        <p className="mb-2">
          Esta consulta tiene diagnóstico, y está sellado sobre esa medición. Al confirmar pasan{" "}
          {causa === "otro_paciente" ? "tres" : "dos"} cosas, y ninguna se deshace:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Esta versión de la consulta queda <strong>reemplazada</strong>. Su diagnóstico no se borra:
            queda legible como el registro de lo que se emitió, con la firma de quien lo firmó.
          </li>
          <li>
            Nace una <strong>versión nueva sin medición</strong>, con la encuesta, la fuerza prensil y el
            peso meta de este paciente. Su pendiente dirá <strong>Montar BIS</strong>: ahí se sube{" "}
            {causa === "otro_paciente" ? "el archivo que sí es suyo" : "la toma buena"}, y el diagnóstico se
            genera de nuevo.
          </li>
          {causa === "otro_paciente" ? (
            <li>
              La medición queda marcada como de otra persona, y eso es lo que{" "}
              <strong>deja al paciente dueño cargar su propio archivo</strong>. Sin la marca, el sistema se
              lo rechazaría diciéndole que su medición es de otro.
            </li>
          ) : null}
        </ul>
        {causa === "toma_mal_hecha" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            La toma no se marca como de otra persona, porque sí es de este paciente: queda registrada como
            una toma que hubo que repetir. Y la medición nueva se puede subir aunque el equipo exporte las
            mismas lecturas, porque las dos versiones quedan unidas en la historia.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Las condiciones de la toma se conservan y vuelven a quedar pendientes de registro: describen un
          momento que no era este, así que hay que confirmarlas con la medición buena.
        </p>
      </div>
      <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        {/* LA CAUSA VIAJA AQUI y no en el `value` del boton de envio (hazard 5). */}
        <input type="hidden" name="causa" value={causa} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            {causa === "otro_paciente"
              ? "De quién era la medición y cómo se supo (queda en la historia clínica)"
              : "Qué pasó con la toma y cómo se supo (queda en la historia clínica)"}
          </span>
          <textarea
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            disabled={pending}
            placeholder={
              causa === "otro_paciente"
                ? "Por ejemplo: el archivo importado era el de otro paciente atendido el mismo día; la edad del equipo no coincide con la de este paciente."
                : "Por ejemplo: el paciente venía de almorzar y la toma salió con agua extracelular imposible; se repitió la medición en ayunas."
            }
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        {/* LA CASILLA VIAJA (tiene `name`) y es controlada, para poder exigirla tambien en el boton. */}
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="confirmar"
            value="si"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            {causa === "otro_paciente"
              ? "Confirmo que la medición de esta consulta no es de este paciente y que esta versión queda reemplazada."
              : "Confirmo que esta toma hay que repetirla y que esta versión de la consulta queda reemplazada."}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending || !motivoSuficiente || !confirmado}>
            {pending
              ? "Corrigiendo..."
              : !motivoSuficiente
                ? "Escribe el motivo para continuar"
                : !confirmado
                  ? "Marca la confirmación para continuar"
                  : "Retirar la medición y crear la versión nueva"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setCausa(null)}>
            Cambiar el motivo
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={cerrar}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}
