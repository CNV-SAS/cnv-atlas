"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormToast } from "@/components/shared/use-form-toast";

import { formatDateTime } from "@/lib/format/date";

import { confirmDiagnosisAction, type DiagnosisActionState } from "../actions";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const EMPTY: DiagnosisActionState = { error: null, success: null, warning: null };

// B-0 (T2b): superficie de confirmacion del diagnostico. Es el acto MAS PELIGROSO de la app: un clic
// IRREVERSIBLE sobre un registro clinico (confirmar es definitivo; sin deshacer ni correccion, salvo
// versionar), y es lo que habilita prescribir. Por eso: va al FINAL de la pagina (obliga a pasar por
// lo confirmado), en DOS pasos (boton -> dialogo -> confirmar), el dialogo DICE que es irreversible y
// que habilita prescribir, y la salida (no confirmar + remitir) queda a la vista. Confirmado: se ve
// quien y cuando, y el boton desaparece.
export function ConfirmDiagnosisPanel({
  evaluationId,
  confirmed,
  confirmedAt,
  confirmedByName,
}: {
  evaluationId: string;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null;
}) {
  const [state, formAction, pending] = useActionState(confirmDiagnosisAction, EMPTY);
  useFormToast(state);

  if (confirmed) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border-2 border-clinical-optimal/40 bg-clinical-optimal-bg p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-clinical-optimal" aria-hidden />
          <h2 className="text-lg font-bold text-clinical-optimal">Diagnóstico confirmado</h2>
        </div>
        <p className="text-sm text-foreground/90">
          Confirmado{confirmedByName ? ` por ${confirmedByName}` : ""}
          {confirmedAt ? ` el ${formatDateTime(confirmedAt)}` : ""}. La confirmación
          es definitiva y no se puede deshacer. Hoy no existe una vía para corregir un diagnóstico ya
          confirmado: si detectas un error, la única opción es crear una evaluación nueva del paciente.
          La medición del equipo se puede volver a importar, así que corregir no exige volver a medir al
          paciente.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">Confirmar el diagnóstico</h2>
        <p className="text-sm text-muted-foreground">
          Confirmar el diagnóstico es el paso que habilita prescribir el tratamiento. Es una decisión
          clínica y no se puede deshacer.
        </p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="self-start">Confirmar diagnóstico</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar el diagnóstico</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-2 text-sm text-foreground/90">
                <span>Confirmas que el diagnóstico refleja tu criterio profesional.</span>
                <span className="font-semibold text-clinical-warning">
                  Esta acción NO se puede deshacer.
                </span>
                <span>Confirmarlo es lo que habilita prescribir el tratamiento.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <form onSubmit={enviarSinReset(formAction)}>
              <input type="hidden" name="evaluationId" value={evaluationId} />
              <Button type="submit" disabled={pending}>
                {pending ? "Confirmando..." : "Confirmar definitivamente"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salida (decision 4): a la vista, tamano de cuerpo. Es la valvula de seguridad (NO confirmar es
          legitimo), no una nota al pie; por eso NO va en gris tenue. Dice solo lo que existe hoy: remitir
          no es una accion en Atlas todavia (no deja registro), las indicaciones SI se consultan sin
          confirmar (rutas/remisiones se renderizan sin el gate). Ver BACKLOG (via de remision con
          registro) y el texto del panel de confirmado (a actualizar cuando exista el flujo de correccion). */}
      <p className="text-sm text-foreground/90">
        Si no estás de acuerdo con el diagnóstico, no confirmarlo es una opción válida: no estás obligado
        a prescribir sobre él. Las indicaciones de remisión del análisis se pueden consultar en la pestaña
        Tratamiento sin confirmar el diagnóstico.
      </p>
    </section>
  );
}
