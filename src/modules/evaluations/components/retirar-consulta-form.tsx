"use client";

import { CalendarX } from "lucide-react";
import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { deshacerRetiroFormAction, retirarEvaluacionFormAction, type RetiroState } from "../actions";

const INICIAL: RetiroState = { error: null, success: null, warning: null };

/**
 * LOS DOS MOTIVOS POR LOS QUE SE RETIRA UNA CONSULTA (Santiago, 2026-11-06).
 *
 * El segundo es el que faltaba, y faltaba por una razón medible: María Camila tiene 26 consultas sin
 * medición que SÍ ocurrieron (la encuesta está respondida; la toma se mostró en el Biody Manager y nunca
 * se subió). Con un solo motivo, retirarlas obligaba a escribir en la historia clínica que no ocurrieron,
 * que es falso, así que nadie las retiraba y quedaban como pendientes para siempre.
 */
const MOTIVOS = [
  {
    id: "no_ocurrio",
    etiqueta: "No ocurrió",
    ayuda: "Se agendó y el paciente no vino, o se atendió otro día.",
    ejemplo: "Por ejemplo: agendó y no vino; se atendió el 25",
  },
  {
    id: "sin_medicion",
    etiqueta: "Ocurrió, pero la medición no se subió",
    ayuda: "La atención se hizo y la toma se quedó sin cargar al sistema.",
    ejemplo: "Por ejemplo: actividad del 12 de septiembre, la toma quedó en el Biody Manager",
  },
] as const;

// ═══ RETIRAR UNA CONSULTA QUE NO OCURRIO, Y DESHACERLO (0212, Santiago 2026-10-07) ═══
//
// EL CASO: la paciente agendó el 21, no pudo venir, y se atendió el 25. La del 21 queda en su historia
// clínica como una consulta que nunca pasó, con su encuesta y su consentimiento firmados ese día.
//
// ── LO QUE ESTA PANTALLA TIENE QUE DECIR, Y NO ES OBVIO ────────────────────────────────────────────
//
//   1. QUE NO BORRA NADA. Si el profesional cree que borra, no lo va a usar (o lo va a usar y después se va
//      a asustar). El consentimiento firmado y la encuesta respondida son actos reales de una persona.
//   2. QUE SE PUEDE DESHACER. Es la diferencia con cerrar un cascarón, que es irreversible a propósito.
//      Retirar es un JUICIO sobre si la consulta ocurrió, y un juicio se revisa.
//   3. Y PIDE EL MOTIVO ANTES, diciendo para qué: queda en la historia clínica, y dentro de seis meses
//      alguien va a preguntar por qué falta una consulta.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta dentro de una tabla que ya vive en pantallas con
// formularios, y un `<form>` dentro de otro lo descarta el navegador. Campos sin `name`, controlados.
export function RetirarConsultaForm({
  evaluationId,
  retirada,
  motivo,
  abierto,
  onAbrir,
}: {
  evaluationId: string;
  retirada: boolean;
  /** El motivo con el que se retiró, para poder leerlo sin abrir el audit. */
  motivo?: string | null;
  /**
   * EL PANEL ABIERTO LO CONTROLA LA FILA, no este componente (capturas de Santiago, 2026-10-09).
   *
   * POR QUE SE LEVANTO EL ESTADO: el formulario vivía DENTRO de la celda de Resultados, que es la última y la
   * más estrecha, así que al abrirse crecía hacia la izquierda y quedaba visualmente debajo de la columna
   * Estado. Parecía pertenecer a otra columna, y empujaba la fila entera.
   *
   * Con el estado en la fila, la fila puede rendir el panel en un `<tr>` propio a todo el ancho, que es el
   * patrón normal de una fila que se despliega. El icono se queda en su celda.
   */
  abierto: boolean;
  onAbrir: () => void;
}) {
  const [stateDeshacer, accionDeshacer, pendingDeshacer] = useActionState(deshacerRetiroFormAction, INICIAL);
  useFormToastAndRefresh(stateDeshacer);

  // YA RETIRADA: se dice con qué motivo y se ofrece deshacerlo. Sin el motivo a la vista habría que ir al
  // audit para saber por qué falta una consulta, y nadie va a ir.
  if (retirada) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">
          Retirada{motivo ? `: ${motivo}` : ""}
        </span>
        <Button
          key="deshacer-retiro"
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendingDeshacer}
          onClick={() => {
            const fd = new FormData();
            fd.set("evaluationId", evaluationId);
            ejecutarAccion(accionDeshacer, fd);
          }}
        >
          {pendingDeshacer ? "Deshaciendo..." : "Deshacer"}
        </Button>
      </div>
    );
  }

  if (!abierto) {
    return (
      /* ═══ UN ICONO, NO UN RENGLON (Santiago, smoke del 2026-10-09) ═══

         SU REPORTE: *"el texto aparece como en otro renglón y daña el diseño. Propongo poner un icono y al
         hacer hover aparezca el texto, para que ellos entiendan que la pueden eliminar."*

         Y TIENE RAZON EN LO DEL DISEÑO: una frase de cuatro palabras dentro de una celda de tabla forzaba la
         fila al doble de alto, en TODAS las filas, para una accion que se usa una vez cada tanto.

         EL ICONO ELEGIDO ES `CalendarX`, no un bote de basura: lo que esto registra es que la consulta NO
         OCURRIO, no que se borre algo. Un icono de borrar prometería lo contrario de lo que el bloque dice al
         abrirse ("no se borra nada: su encuesta y su consentimiento se conservan"), y la pantalla no puede
         decir dos cosas opuestas del mismo botón.

         Y LLEVA `aria-label` ADEMAS DEL TOOLTIP: un hover no existe para quien navega con teclado ni para un
         lector de pantalla, así que un icono sin nombre accesible sería un botón sin nombre. */
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            key="abrir-retiro"
            type="button"
            variant="ghost"
            size="icon"
            // ═══ EL ROTULO YA NO AFIRMA QUE NO OCURRIO (Santiago, 2026-11-06) ═══
            //
            // Decia "Esta consulta no ocurrió", que es UNO de los dos motivos y no el nombre de la
            // accion. Por eso no servia para las 26 de María Camila: esas consultas SI ocurrieron (la
            // encuesta esta respondida), lo que falto fue subir la medicion. Un boton que afirma algo
            // falso sobre lo que paso no se pulsa, y el pendiente se queda ahi para siempre.
            aria-label="Retirar esta consulta"
            onClick={onAbrir}
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <CalendarX className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Retirar esta consulta</TooltipContent>
      </Tooltip>
    );
  }

  // ABIERTO: el icono se queda apagado y el PANEL lo rinde la fila, a todo el ancho. Ver `PanelRetirarConsulta`.
  return (
    <span className="text-xs text-muted-foreground">Retirando...</span>
  );
}

// ═══ EL PANEL, EN SU PROPIA FILA (capturas de Santiago, 2026-10-09) ═══
//
// VA APARTE DEL BOTON porque va en otro sitio del DOM: el icono vive en la celda de Resultados y el panel en un
// `<tr>` a todo el ancho, debajo. Mientras estuvieron juntos, el panel crecia dentro de la ultima columna (la
// mas estrecha) y quedaba visualmente debajo de Estado, pareciendo de otra columna.
//
// NO COMPARTEN ESTADO Y NO HACE FALTA: el boton solo abre, y el panel solo escribe y cancela. Cada uno tiene lo
// suyo, asi que separarlos no duplica nada.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta dentro de una tabla que vive en pantallas con
// formularios, y un `<form>` dentro de otro lo descarta el navegador. Campos sin `name`, controlados, y los
// botones en `type="button"`.
export function PanelRetirarConsulta({
  evaluationId,
  onCerrar,
}: {
  evaluationId: string;
  onCerrar: () => void;
}) {
  const [state, action, pending] = useActionState(retirarEvaluacionFormAction, INICIAL);
  useFormToastAndRefresh(state);
  const [razon, setRazon] = useState("");
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]["id"] | null>(null);
  const elegido = MOTIVOS.find((m) => m.id === motivo) ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-left">
      <p className="max-w-prose text-xs text-muted-foreground">
        {/* EL AVISO SE ADAPTA AL MOTIVO, y no es un detalle: con "ocurrió pero no se subió la medición",
            decir que la consulta "deja de contar en la historia del paciente" sería falso sobre un acto
            que sí pasó. Lo que deja de contar es el PENDIENTE. */}
        {elegido?.id === "sin_medicion"
          ? "La consulta deja de contar como pendiente y no entra a investigación. "
          : "La consulta deja de contar en la historia del paciente. "}
        <strong className="text-foreground">No se borra nada:</strong> su encuesta y su consentimiento se
        conservan, y esto se puede deshacer.
      </p>
      {/* ═══ EL MOTIVO, EN DOS OPCIONES (Santiago, 2026-11-06) ═══

          *"El botón de retirar: 'Retirar esta consulta', con el motivo en dos opciones, 'No ocurrió' y
          'Ocurrió, pero la medición no se subió', más el texto libre. Así María Camila cierra sus 26."*

          SON DOS HECHOS DISTINTOS y por eso no basta el texto libre: uno dice que la atención no existió
          y el otro que existió y le falta el dato. Quien lea la historia clínica dentro de seis meses
          necesita saber cuál de los dos, y un campo libre deja eso a cómo redacte cada quien.

          RADIOS Y NO UN DESPLEGABLE: son dos, y las dos tienen que verse sin abrir nada. Sin `name` (ver
          abajo), controladas, dentro de un bloque que vive en una pantalla con formularios. */}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium">Por qué se retira</legend>
        {MOTIVOS.map((m) => (
          <label key={m.id} className="flex items-start gap-2 text-xs">
            <input
              type="radio"
              checked={motivo === m.id}
              onChange={() => setMotivo(m.id)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-foreground">{m.etiqueta}</span>
              <span className="block text-muted-foreground">{m.ayuda}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`motivo-retiro-${evaluationId}`} className="text-xs font-medium">
          Detalle (opcional)
        </label>
        {/* SIN `name`, a propósito: este bloque vive dentro de una pantalla con formularios y un campo con
            nombre viajaría en ESE envío. */}
        <Input
          id={`motivo-retiro-${evaluationId}`}
          maxLength={300}
          value={razon}
          onChange={(e) => setRazon(e.target.value)}
          placeholder={elegido?.ejemplo ?? "Elige primero por qué se retira"}
          disabled={!elegido}
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          key="confirmar-retiro"
          type="button"
          size="sm"
          // EL DETALLE YA NO ES OBLIGATORIO: la opción elegida ya dice el porqué, y exigir además cinco
          // caracteres libres es lo que hace que alguien escriba "xxxxx" para poder enviar. Lo que sí es
          // obligatorio es ELEGIR, que es el dato que la historia clínica necesita.
          disabled={pending || !elegido}
          onClick={() => {
            const fd = new FormData();
            fd.set("evaluationId", evaluationId);
            // EL MOTIVO QUE SE GUARDA lleva la opción delante y el detalle detrás, con el mismo formato
            // que ya usa el proyecto para "Otro: <texto>". Así se lee entero en la historia clínica y
            // además se puede contar por opción sin volver a interpretar texto libre.
            fd.set("motivo", razon.trim() ? `${elegido!.etiqueta}: ${razon.trim()}` : elegido!.etiqueta);
            ejecutarAccion(action, fd);
          }}
        >
          {pending ? "Retirando..." : "Retirar la consulta"}
        </Button>
        <Button
          key="cancelar-retiro"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onCerrar}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
