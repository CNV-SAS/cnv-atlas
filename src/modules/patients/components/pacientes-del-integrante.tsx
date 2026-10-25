"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnlyShort } from "@/lib/format/date";

import type { ProfesionalDestino } from "@/modules/professionals/data/profesionales-para-reasignar";

import {
  confirmarPacienteRealAction,
  desmarcarPacienteDePruebaAction,
  marcarPacienteDePruebaAction,
  reasignarPacienteAction,
  reasignarPacientesEnLoteAction,
  type MarcaDePruebaState,
} from "../actions";
import { ROTULO_DE_PRUEBA } from "../de-prueba";

// ═══ MARCAR UN PACIENTE DE PRUEBA DESDE ADMIN (Santiago, 2026-10-01) ═══
//
// POR QUÉ AQUÍ: esta es la pantalla donde admin mira la operación de un integrante, así que es donde se ve
// qué pacientes son de verdad y cuáles se crearon para probar. El camino de "el profesional propone y admin
// confirma" sirve para el paciente que alguien reconoce; no sirve para limpiar los quince de una cuenta de
// demostración, porque ese profesional no va a proponer nada.
//
// Y LO QUE OCURRE AL MARCAR NO ES COSMÉTICO: desde hoy saca también SU DINERO de las cifras (sus ventas, sus
// comisiones, lo que se deshizo, los insights). Por eso pide motivo, queda quién lo marcó, y se puede quitar.
// Un paciente real marcado por error desaparecería de las cifras, y eso tiene que ser reversible.

export type PacienteDelIntegrante = {
  id: string;
  nombre: string;
  documento: string;
  /** Lo que las cifras excluyen: marcado a mano O derivado de su profesional. */
  esDePrueba: boolean;
  /** Si la decision la tomo una persona. Un derivado no se desmarca: se confirma como real. */
  marcadoAMano: boolean;
  confirmadoReal: boolean;
  motivo: string | null;
  /** El dia en que se le asigno este profesional, fecha PURA en hora de Colombia (aaaa-mm-dd). */
  asignadoEl: string;
};

const inicial: MarcaDePruebaState = { error: null, success: null, warning: null };

function Marcar({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(marcarPacienteDePruebaAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      {/* EL MOTIVO ES OBLIGATORIO Y VA AQUÍ, no en un diálogo: seis meses después alguien va a preguntar por
          qué esa venta no cuenta, y "porque alguien lo marcó" no es una respuesta. */}
      <Input
        name="motivo"
        required
        minLength={5}
        maxLength={200}
        placeholder="Por qué es de prueba"
        className="h-8 w-56 text-xs"
        disabled={pending}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Marcando..." : "Marcar de prueba"}
      </Button>
    </form>
  );
}

function Desmarcar({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(desmarcarPacienteDePruebaAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="patientId" value={patientId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Quitando..." : "Quitar la marca"}
      </Button>
    </form>
  );
}

// ═══ EL BOTÓN QUE FALTABA, Y SIN ÉL LA EXCEPCIÓN ERA TEÓRICA (Santiago, 2026-10-01) ═══
//
// A un paciente DERIVADO no se le puede "quitar la marca": nadie se la puso. Lo que se puede decir es que es
// real a pesar de su profesional, y eso es una columna que existía desde la 0202 sin ninguna pantalla que
// pudiera escribirla. Un mecanismo sin superficie que lo alcance hace creer que una regla se puede aplicar
// cuando no.
function ConfirmarReal({ patientId, confirmado }: { patientId: string; confirmado: boolean }) {
  const [state, action, pending] = useActionState(confirmarPacienteRealAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="confirmar" value={confirmado ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending
          ? "Guardando..."
          : confirmado
            ? "Quitar la confirmación"
            : "Es real aunque su profesional sea de prueba"}
      </Button>
    </form>
  );
}

// ═══ REASIGNAR A OTRO PROFESIONAL (Santiago, 2026-10-24) ═══
//
// POR QUE AQUI: esta es la pantalla donde admin mira la operacion de un integrante, asi que es donde se
// decide que pasa con sus pacientes cuando se va o cuando otra persona cubrio sus citas. La regla dura 14
// dice "offboarding = desactivar y reasignar", y la segunda mitad no tenia ninguna superficie.
//
// EL MOTIVO VA EN LA PROPIA FILA, no en un dialogo: dentro de un ano alguien va a preguntar por que esta
// historia clinica cambio de manos, y "porque alguien lo movio" no es una respuesta.
//
// Y SE DICE QUE LA FIRMA NO SE MUEVE, antes de pulsar. Lo que cambia es quien atiende y quien ve la ficha;
// quien firmo un diagnostico se queda, porque es un hecho que ocurrio.
function Reasignar({
  patientId,
  destinos,
}: {
  patientId: string;
  destinos: ProfesionalDestino[];
}) {
  const [state, action, pending] = useActionState(reasignarPacienteAction, inicial);
  useFormToastAndRefresh(state);
  if (destinos.length === 0) return null;
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <select
        name="haciaProfesionalId"
        required
        defaultValue=""
        disabled={pending}
        aria-label="Profesional que lo va a atender"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">Reasignar a...</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
            {d.profesion ? ` · ${d.profesion}` : ""}
          </option>
        ))}
      </select>
      <Input
        name="motivo"
        required
        minLength={5}
        maxLength={200}
        placeholder="Por qué se reasigna"
        className="h-8 w-56 text-xs"
        disabled={pending}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Moviendo..." : "Reasignar"}
      </Button>
    </form>
  );
}

// ═══ LA PASADA EN LOTE, Y POR QUÉ LAS CASILLAS NO VAN DENTRO DE ESTE FORMULARIO ═══
//
// EL CASO: 25 pacientes que entraron el mismo día por el enlace de un profesional cubriendo la agenda de
// otra, con el mismo destino y el mismo motivo. Y el caso permanente, el de la regla dura 14: cuando un
// integrante se va, sus pacientes se reasignan todos. Teclear el motivo noventa veces no es una garantía;
// es la manera de conseguir que alguien escriba cualquier cosa para poder seguir.
//
// LAS CASILLAS VIVEN EN LAS FILAS, FUERA DE ESTE formulario, y eso es deliberado: cada fila ya tiene sus
// propios formularios (marcar de prueba, reasignar uno), así que un formulario que envolviera la lista los
// anidaría, y el navegador DESCARTA el de adentro (hazard 7: sus campos se cuelan en el envío de afuera y
// su botón ejecuta la acción equivocada). Así que, siguiendo el remedio escrito del hazard 8:
//
//   · las casillas son CONTROLADAS y SIN `name`, de modo que su valor no viaja por sí mismo,
//   · lo que viaja es el campo oculto `patientIds`, que sí está DENTRO de este formulario,
//   · y la exigencia de "marca al menos uno" se rehace donde sí se cumple, en el `disabled` del botón,
//     DICIÉNDOLO en su rótulo. Un `required` en una casilla de afuera sería una bandera inerte, y una
//     bandera inerte engaña más que su ausencia.
function ReasignarEnLote({
  marcados,
  resumen,
  destinos,
  alTerminar,
}: {
  marcados: string[];
  /** Que es lo marcado, en una frase, para leerlo ANTES de pulsar. */
  resumen: string;
  destinos: ProfesionalDestino[];
  alTerminar: () => void;
}) {
  const [state, action, pending] = useActionState(reasignarPacientesEnLoteAction, inicial);
  useFormToastAndRefresh(state);
  // LA SELECCIÓN SE LIMPIA CUANDO EL MOVIMIENTO SALIÓ BIEN, no al pulsar: si se limpiara al pulsar y la
  // acción fallara, quien mira tendría que volver a marcar veinticinco casillas para reintentar.
  useEffect(() => {
    if (state.success) alTerminar();
  }, [state.success, alTerminar]);

  return (
    <form
      onSubmit={enviarSinReset(action)}
      className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3"
    >
      <input type="hidden" name="patientIds" value={marcados.join(",")} />
      <select
        name="haciaProfesionalId"
        required
        defaultValue=""
        disabled={pending}
        aria-label="Profesional que los va a atender"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">Reasignar los marcados a...</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
            {d.profesion ? ` · ${d.profesion}` : ""}
          </option>
        ))}
      </select>
      <Input
        name="motivo"
        required
        minLength={5}
        maxLength={200}
        placeholder="Por qué se reasignan (el mismo motivo para todos)"
        className="h-8 w-80 text-xs"
        disabled={pending}
      />
      <Button type="submit" size="sm" disabled={pending || marcados.length === 0}>
        {pending
          ? "Moviendo..."
          : marcados.length === 0
            ? "Marca los pacientes que se mueven"
            : `Reasignar ${marcados.length === 1 ? "el marcado" : `los ${marcados.length} marcados`}`}
      </Button>
      {/* ═══ QUE ES LO MARCADO, EN UNA FRASE Y ANTES DE PULSAR (Gildardo, 2026-10-24) ═══

          No basta con que el botón diga "los 25": hay que poder leer que esos 25 son EXACTAMENTE un día de
          asignación y no una mezcla. La frase lo dice, y cuando la selección es mixta lo dice también, que
          es el caso en el que conviene parar a mirar. */}
      {marcados.length > 0 ? (
        <p className="w-full text-xs font-medium text-foreground">{resumen}</p>
      ) : null}
      <p className="w-full text-xs text-muted-foreground">
        Pasan al profesional nuevo el acceso a la ficha y la atribución de sus consultas.{" "}
        <strong className="text-foreground">La firma de un diagnóstico no se mueve</strong>: quien firmó lo
        firmó, y eso es un hecho que ocurrió. Los movimientos van en una sola transacción, así que si uno
        falla no se mueve ninguno.
      </p>
    </form>
  );
}

// ═══ LA PRESELECCIÓN POR DÍA: ELEGIR 25 DE 93 A MANO ES COMO SE MUEVE EL PACIENTE EQUIVOCADO ═══
//
// (Gildardo, 2026-10-24, sobre el caso real de los 25 del 13 de octubre.)
//
// POR DÍA DE ASIGNACIÓN y no por una fecha escrita a mano: el caso que hay que resolver es "los que entraron
// por el enlace de esta persona tal día", y ese grupo lo define la base, no quien mira. Un campo de fecha
// libre vuelve a poner el error donde estaba: un día mal teclado marca otro grupo, y marca ALGO, así que no
// se nota. Un desplegable con los días que existen y su conteo no puede señalar un grupo que no existe.
//
// Y NO ES SOLO PARA ESTE CASO: cuando un integrante se va (regla dura 14), lo que se mueve es todo, y para
// eso está "Marcar los N". Los dos caminos conviven porque son dos preguntas distintas.
function agruparPorDia(pacientes: PacienteDelIntegrante[]): { dia: string; ids: string[] }[] {
  const porDia = new Map<string, string[]>();
  for (const p of pacientes) {
    const ya = porDia.get(p.asignadoEl);
    if (ya) ya.push(p.id);
    else porDia.set(p.asignadoEl, [p.id]);
  }
  // Del más reciente al más antiguo: el día que se va a corregir casi siempre es uno de los últimos.
  return [...porDia.entries()]
    .map(([dia, ids]) => ({ dia, ids }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

/**
 * QUE ES LO MARCADO, en una frase que se lee antes de pulsar. Dice el dia cuando la seleccion es
 * EXACTAMENTE un grupo completo, y avisa cuando es una mezcla: ese es el caso en el que conviene mirar.
 */
function describirSeleccion(
  marcados: string[],
  pacientes: PacienteDelIntegrante[],
  grupos: { dia: string; ids: string[] }[],
): string {
  const n = marcados.length;
  const cuantos = `${n} de ${pacientes.length}`;
  if (n === pacientes.length) return `Marcados los ${pacientes.length}, es decir TODOS sus pacientes.`;
  const dias = new Set(
    pacientes.filter((p) => marcados.includes(p.id)).map((p) => p.asignadoEl),
  );
  if (dias.size === 1) {
    const [dia] = [...dias];
    const grupo = grupos.find((g) => g.dia === dia);
    const completo = grupo !== undefined && grupo.ids.length === n;
    return completo
      ? `Marcados ${cuantos}: exactamente los asignados el ${formatDateOnlyShort(dia)}.`
      : `Marcados ${cuantos}, todos del ${formatDateOnlyShort(dia)}, pero no los ${grupo?.ids.length ?? 0} de ese día.`;
  }
  return `Marcados ${cuantos}, de ${dias.size} días de asignación distintos. Conviene revisar la lista antes de mover.`;
}

export function PacientesDelIntegrante({
  pacientes,
  destinos = [],
}: {
  pacientes: PacienteDelIntegrante[];
  /** Vacio = quien mira no puede reasignar, o no hay otro profesional activo. */
  destinos?: ProfesionalDestino[];
}) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const limpiar = useCallback(() => setMarcados([]), []);
  const puedeReasignar = destinos.length > 0;
  const alternar = (id: string) =>
    setMarcados((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    );

  if (pacientes.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiene pacientes asignados.</p>;
  }
  const dePrueba = pacientes.filter((p) => p.esDePrueba).length;
  const grupos = agruparPorDia(pacientes);

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        Un paciente de prueba sale de <strong className="text-foreground">todas las cifras</strong>: sus
        ventas, su comisión, lo que se deshizo, los insights y la facturación. Sigue visible aquí y en la
        lista de su profesional, con su rótulo, porque esconderlo es como alguien lo confunde con uno real.{" "}
        <strong className="text-foreground">
          Si el profesional es de prueba, sus pacientes lo son sin que nadie los marque
        </strong>{" "}
        (migración 0202), y para el caso raro está la salida: decir que uno SÍ es real.
        {dePrueba > 0 ? ` Hoy ${dePrueba} de ${pacientes.length} no cuentan.` : ""}
      </p>
      {puedeReasignar ? (
        <>
          <ReasignarEnLote
            marcados={marcados}
            resumen={describirSeleccion(marcados, pacientes, grupos)}
            destinos={destinos}
            alTerminar={limpiar}
          />
          {/* ESTE BLOQUE VIVE FUERA DEL FORMULARIO y nada de aquí viaja en el envío: solo mueve la
              selección. Por eso el desplegable va SIN `name` y controlado (hazard 8), y los botones son
              `type="button"`. Lo que viaja es el campo oculto `patientIds`, que está dentro. */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value=""
              onChange={(e) => {
                const grupo = grupos.find((g) => g.dia === e.target.value);
                if (grupo) setMarcados(grupo.ids);
              }}
              aria-label="Marcar los pacientes asignados un día"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Marcar los de un día de asignación...</option>
              {grupos.map((g) => (
                <option key={g.dia} value={g.dia}>
                  {formatDateOnlyShort(g.dia)} · {g.ids.length}{" "}
                  {g.ids.length === 1 ? "paciente" : "pacientes"}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMarcados(pacientes.map((p) => p.id))}
            >
              Marcar los {pacientes.length}
            </Button>
            {marcados.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                Quitar la selección
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      <ul className="flex flex-col gap-2 text-sm">
        {pacientes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <span className="flex min-w-0 items-center gap-2">
              {puedeReasignar ? (
                <input
                  type="checkbox"
                  checked={marcados.includes(p.id)}
                  onChange={() => alternar(p.id)}
                  aria-label={`Marcar a ${p.nombre} para reasignar`}
                  className="size-4 accent-primary"
                />
              ) : null}
              <span className="min-w-0">
                {p.nombre} <span className="text-muted-foreground">· {p.documento}</span>
                {/* LA FECHA DE ASIGNACIÓN EN LA FILA: sin ella la preselección por día habría que
                    creérsela. Con ella se puede comprobar a ojo que lo marcado es lo que se quería. */}
                {puedeReasignar ? (
                  <span className="text-muted-foreground"> · asignado el {formatDateOnlyShort(p.asignadoEl)}</span>
                ) : null}
                {/* ═══ EL RÓTULO DISTINGUE DERIVADO DE MARCADO, y la distinción no es cosmética ═══

                    De ella depende qué botón tiene sentido: un derivado no se desmarca (nadie lo marcó), se
                    confirma como real. Decir solo "de prueba" en los dos casos dejaba al que mira sin saber
                    por qué un paciente que nadie tocó no cuenta en las cifras. */}
                {p.esDePrueba ? (
                  <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {p.marcadoAMano
                      ? `${ROTULO_DE_PRUEBA}${p.motivo ? `: ${p.motivo}` : ""}`
                      : "De prueba porque su profesional lo es"}
                  </span>
                ) : p.confirmadoReal ? (
                  <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Confirmado real, aunque su profesional sea de prueba
                  </span>
                ) : null}
              </span>
            </span>
            {/* LAS DOS ACCIONES CONVIVEN EN LA FILA: la marca de prueba decide si el paciente cuenta en las
                cifras, y la reasignacion decide quien lo atiende. Son preguntas distintas sobre el mismo
                paciente, asi que no se excluyen (a diferencia de marcar y desmarcar, que si). */}
            <span className="flex flex-wrap items-center gap-3">
              {p.marcadoAMano ? (
                <Desmarcar patientId={p.id} />
              ) : p.esDePrueba || p.confirmadoReal ? (
                <ConfirmarReal patientId={p.id} confirmado={p.confirmadoReal} />
              ) : (
                <Marcar patientId={p.id} />
              )}
              <Reasignar patientId={p.id} destinos={destinos} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
