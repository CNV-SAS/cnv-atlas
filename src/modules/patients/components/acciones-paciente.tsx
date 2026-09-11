"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, IdCard, Stethoscope } from "lucide-react";
import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { archivarPacienteAction } from "../actions";
import type { ArchivarPacienteState } from "../types";

const INICIAL: ArchivarPacienteState = { error: null, success: null, warning: null };

// ═══ LA COLUMNA DE ACCIONES (Santiago, 2026-09-10, sobre la referencia de Biody Manager) ═══
//
// LO QUE SE PORTA DE LA REFERENCIA ES LA FORMA, no la paleta: una columna de botones de icono con su
// explicacion al pasar por encima. Su tabla lleva OCHO botones y cada uno de un color saturado distinto
// (morado, naranja, rojo, azul, gris, verde...). Aqui son TRES y van neutros, por dos razones:
//
//   · Ocho acciones por fila en una lista de 73 convierten la columna en el elemento mas ruidoso de la
//     pantalla, y esta lista ya tiene dos cosas que SI deben saltar: la columna de pendientes y el chip.
//   · Y el color en Atlas significa. Un arcoiris de botones le pondria peso visual a lo administrativo
//     por encima de lo clinico, que es al reves de como se lee esta pantalla.
//
// EL ROTULO NO ES SOLO UN `title`: va en tooltip con portal, que aparece tambien con el foco del teclado
// y se anuncia como descripcion. Un boton de icono sin nombre accesible es un boton que solo existe para
// quien ve el dibujo.
//
// Y NO HAY BOTON DE ELIMINAR, aunque la referencia lo tenga: un paciente con datos clinicos arrastra
// evaluaciones, diagnosticos sellados y su rastro de auditoria. Borrarlo rompe la trazabilidad de la regla
// dura 8. Lo que hay es ARCHIVAR, que es reversible. La razon completa vive en `can-archive-patient`.
export function AccionesPaciente({
  patientId,
  archivado,
  puedeArchivar,
}: {
  patientId: string;
  archivado: boolean;
  puedeArchivar: boolean;
}) {
  const [state, action, pending] = useActionState(archivarPacienteAction, INICIAL);
  useFormToastAndRefresh(state);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link href={`/pacientes/${patientId}`} aria-label="Abrir el panel del paciente">
              <IdCard className="size-4" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Panel del paciente: su historia completa</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="size-8">
            {/* LA EVALUACION NUEVA EMPIEZA EN SU PANEL, no en una accion suelta: el enlace o el QR se le
                pasan desde ahi, y ahi esta ademas lo que hay que mirar antes (autorizaciones vigentes y
                lo que quedo de la consulta anterior). Un boton que creara la evaluacion desde la lista se
                saltaria esa mirada. */}
            <Link
              href={`/pacientes/${patientId}#seguimiento`}
              aria-label="Empezar una evaluación nueva"
            >
              <Stethoscope className="size-4" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nueva evaluación: emite su enlace de seguimiento</TooltipContent>
      </Tooltip>

      {puedeArchivar ? (
        <form onSubmit={enviarSinReset(action)} className="contents">
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="archivar" value={archivado ? "0" : "1"} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={pending}
                aria-label={archivado ? "Desarchivar el paciente" : "Archivar el paciente"}
              >
                {archivado ? (
                  <ArchiveRestore className="size-4" aria-hidden />
                ) : (
                  <Archive className="size-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {archivado
                ? "Desarchivar: vuelve a la lista"
                : "Archivar: sale de la lista. No se borra nada"}
            </TooltipContent>
          </Tooltip>
        </form>
      ) : null}
    </>
  );
}
