"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, IdCard } from "lucide-react";
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
// (morado, naranja, rojo, azul, gris, verde...). Aqui son DOS y con UN solo acento, por dos razones:
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
// ── Y SON DOS, NO TRES (Santiago, 2026-09-10, segunda vuelta) ───────────────────────────────────────
//
// "Nueva evaluacion" se retira: llevaba al MISMO sitio que el panel, asi que era un segundo boton para lo
// mismo con otro icono, que es peor que no tenerlo (obliga a leer los dos para descubrir que dan igual).
// Con uno menos los dos que quedan pueden ser mas grandes, que es lo que pedia el area de pulsacion.
//
// ── EL BLOQUE DE COLOR, de la referencia de Biody ───────────────────────────────────────────────────
//
// Su interfaz pinta los iconos como TESELAS: un cuadrado redondeado relleno con el icono en blanco. Eso
// se porta, y da la profundidad que faltaba. Lo que NO se porta es que cada tesela lleve un color
// distinto: aqui el relleno es el azul de MARCA, uno solo, y el segundo boton va en neutro. Dos teselas
// de dos colores saturados en la misma fila que el semaforo clinico competirian con el, y el color en
// Atlas significa.
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
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Link href={`/pacientes/${patientId}`} aria-label="Abrir el panel del paciente">
              <IdCard className="size-[1.125rem]" aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        {/* CORTO Y DIRECTO (Santiago): el tooltip se lee de paso, no se estudia. "Panel del paciente: su
            historia completa" obligaba a pararse encima del boton para terminar de leerlo. */}
        <TooltipContent>Panel del paciente</TooltipContent>
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
                className="size-9 rounded-lg bg-muted text-muted-foreground hover:bg-foreground hover:text-background"
                disabled={pending}
                aria-label={archivado ? "Desarchivar el paciente" : "Archivar el paciente"}
              >
                {archivado ? (
                  <ArchiveRestore className="size-[1.125rem]" aria-hidden />
                ) : (
                  <Archive className="size-[1.125rem]" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{archivado ? "Desarchivar" : "Archivar"}</TooltipContent>
          </Tooltip>
        </form>
      ) : null}
    </>
  );
}
