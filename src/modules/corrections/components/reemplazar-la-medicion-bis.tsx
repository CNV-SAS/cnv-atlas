"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
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
/**
 * Los dos motivos, con sus dos rotulos.
 *
 * ═══ POR QUE SON DOS ROTULOS Y NO UNO (2026-11-03) ═══
 *
 * `boton` es lo que se PULSA, asi que empieza por el VERBO: lo que se va a hacer. `titulo` encabeza la
 * pantalla a la que se llega, asi que describe el HECHO: lo que paso. Son dos frases para dos trabajos, y
 * mezclarlas deja un boton que no dice que hace o un titulo que suena a orden.
 */
const MOTIVOS: { causa: Causa; boton: string; titulo: string; detalle: string }[] = [
  {
    causa: "toma_mal_hecha",
    boton: "Repetir la toma (salió mal)",
    titulo: "La toma quedó mal",
    detalle:
      "El paciente no estaba en condiciones, los electrodos no hicieron contacto o el archivo del equipo salió incompleto. La medición es de este paciente, pero no sirve.",
  },
  {
    causa: "otro_paciente",
    boton: "El archivo es de otra persona",
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
  versionReemplazada = false,
  versionVigenteId = null,
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
  /**
   * ESTA VERSION YA FUE REEMPLAZADA por una correccion (2026-11-05). Entonces el acto NO se ofrece: el
   * servicio lo frena igual, y un boton que solo puede fallar se siente roto.
   */
  versionReemplazada?: boolean;
  /** A donde ir. Un aviso sin su enlace obliga a buscar la version vigente a mano. */
  versionVigenteId?: string | null;
}) {
  const [state, action, pending] = useActionState(medicionDeOtroPacienteAction, inicial);
  // EL TOAST SIN REFRESCO: al terminar se NAVEGA a la version nueva (ver abajo). Un `router.refresh()`
  // ademas montaria los segmentos dos veces y la pagina saltaria al inicio dos veces.
  useFormToast(state);
  const router = useRouter();
  const [abiertoPorElUsuario, setAbierto] = useState(false);
  // ═══ PLEGADO POR DEFECTO CUANDO NO HAY NADA QUE AVISAR (Santiago, 2026-11-05) ═══
  //
  // *"Hoy al abrir Antrop. & BIS sale el recuadro entero. Que quede plegado detras de un boton
  // «Reemplazar medicion BIS», y que se abra solo al pulsarlo."*
  //
  // Y NO CONTRADICE SU PETICION DEL 3 DE NOVIEMBRE ("las dos salidas a la vista, sin un paso que las
  // esconda"): lo que el boton abre son LAS DOS OPCIONES JUNTAS, cada una con su linea. El paso que se
  // quito entonces era el que escondia la DECISION detras de una pregunta ciega; el que se pone ahora es
  // la entrada al bloque, que es otra cosa. Se lee antes de elegir, igual que entonces.
  //
  // CON AVISO NO SE PLIEGA NUNCA (ver abajo): una alerta plegada no es una alerta.
  const [desplegado, setDesplegado] = useState(false);
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
    setDesplegado(false);
    setCausa(null);
    setMotivo("");
    setConfirmado(false);
  };

  // ── VERSION REEMPLAZADA: NINGUN ACTO, Y EL CAMINO (2026-11-05) ──────────────────────────────────
  //
  // VA ANTES QUE TODO, incluso que el aviso de la huella repetida: en una version reemplazada no hay nada
  // que hacer aqui ni con aviso ni sin el, y lo que hay que hacer (ir a la vigente) es lo unico que se
  // dice. El aviso de la huella, si aplica, sale en la version vigente, que es donde se puede arreglar.
  if (versionReemplazada) {
    return (
      <section className="no-print flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">Versión reemplazada</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          La medición se cambia en la versión vigente de esta consulta, no aquí: esta se conserva como
          registro de lo que se emitió.
          {versionVigenteId ? (
            <>
              {" "}
              <Link
                href={`/ani-bis-e/${versionVigenteId}`}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Ir a la versión vigente
              </Link>
              .
            </>
          ) : null}
        </p>
      </section>
    );
  }

  // ── PLEGADO: SOLO EL BOTON (2026-11-05) ─────────────────────────────────────────────────────────
  //
  // Es el estado por defecto del 99 % de las consultas: no hay nada que avisar y el bloque no tiene por
  // que ocupar la cabecera de la pestaña. Pulsar lo despliega con las dos opciones a la vista.
  //
  // SOLO CUANDO NO HAY AVISO. Con una huella repetida el bloque se pinta entero y abierto, porque ahi no
  // es una herramienta que se ofrece: es una alerta sobre un dato de salud que esta en dos historias, y
  // una alerta plegada detras de un boton no avisa a nadie.
  if (!abierto && !desplegado && !repetida) {
    return (
      <section className="no-print">
        {/* ═══ EL BOTON SOLO, CON BORDE AZUL  ·  Santiago, 2026-11-05 ═══

            *"Mas cerca, justo encima de las condiciones de la toma, sin el margen de hoy. Fuera la linea
            'Para cuando la toma quedo mal y hay que repetirla, o cuando el archivo es de otra persona'.
            Con borde en azul electrico. Rojo no: reemplazar no borra nada, crea una version."*

            ═══ LA LINEA DE DEBAJO SALE, Y SE PERDIO POCO ═══

            Se puso ayer con el plegado, para que el boton no quedara mudo ("reemplazar" se puede leer como
            corregir las condiciones de la toma, que es otro boton). Lo que paso es que el bloque que el
            boton ABRE ya trae las dos opciones con su linea cada una, asi que la explicacion estaba dos
            veces: una fuera y otra dentro, a un clic de distancia.

            ═══ EL AZUL NO ES COSMETICA, Y ES LA PARTE QUE IMPORTA DE SU MENSAJE ═══

            Su razon es la que decide el color: *"reemplazar no borra nada, crea una version"*. El rojo de
            `destructive` significa en Atlas un acto que QUITA algo, y aqui no se quita: la version vieja
            se conserva legible como registro de lo que se emitio, y el paciente conserva su historia. Un
            rojo le diria al profesional que esta a punto de perder datos, y dudaria de un acto que es
            seguro; es la misma clase de error que pintar de clinico un estado de proceso.

            El azul es `--primary` (#205dfd), el de accion de BRAND.md, que es la capa de INTERFAZ y no la
            clinica: no insinua ninguna severidad sobre el paciente. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit border-primary text-primary hover:border-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => setDesplegado(true)}
        >
          Reemplazar medición BIS
        </Button>
      </section>
    );
  }

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
        {/* ═══ LAS DOS SALIDAS A LA VISTA, SIN UN PASO QUE LAS ESCONDA (Santiago, 2026-11-03) ═══

            SU DUDA: *"no sé si para el profesional le quede clara esta ruta solo con darle a un botón que
            diga reemplazar BIS y la explicación corta."*

            Y ES LA DUDA CORRECTA. Un botón que abre una pregunta esconde la decisión detrás de un clic a
            ciegas: para saber qué se le va a preguntar hay que pulsarlo, y el que no sabe si es su caso
            no pulsa. Es el mismo defecto que ya costó que este control no se encontrara cuando era un
            desplegable plegado: lo que no se ve, no existe.

            AHORA LOS DOS CAMINOS SON DOS BOTONES, cada uno con la línea que dice cuándo es el suyo. El
            profesional LEE antes de pulsar, y pulsa sabiendo a qué va. Lo que se gana no es un clic menos:
            es que la decisión (que es clínica, y decide qué queda escrito en la historia) se tome mirando
            las dos opciones, no descubriéndolas. */}
        <p className="max-w-prose text-sm text-muted-foreground">
          Las dos cosas quedan escritas en la historia clínica y no dicen lo mismo, así que se elige antes:
        </p>
        <div className="flex flex-col gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m.causa}
              type="button"
              onClick={() => {
                setCausa(m.causa);
                setAbierto(true);
              }}
              className="flex max-w-prose flex-col gap-1 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="text-sm font-semibold text-foreground">{m.boton}</span>
              <span className="text-xs text-muted-foreground">{m.detalle}</span>
            </button>
          ))}
        </div>
        {/* VOLVER A PLEGARLO, y solo cuando el bloque se desplego a mano: con un aviso no hay nada que
            cerrar, porque el aviso no se puede esconder. */}
        {desplegado && !repetida ? (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDesplegado(false)}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  // ── ABIERTO Y SIN MOTIVO: LA PANTALLA DE CAMBIAR DE OPINION ──────────────────────────────────────
  //
  // DESDE EL 2026-11-03 YA NO SE LLEGA AQUI AL ABRIR: los dos motivos son dos botones del estado cerrado,
  // asi que el camino normal entra directo al que se eligio. Esta pantalla es a donde lleva "Cambiar el
  // motivo", y se queda por eso: volver atras tiene que ofrecer las dos, no devolver al bloque cerrado.
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
