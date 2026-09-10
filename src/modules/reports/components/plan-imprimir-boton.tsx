"use client";

import { Printer } from "lucide-react";
import { startTransition, useActionState } from "react";

import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { registrarPlanImpresoAction } from "@/modules/treatment/actions";
import type { TreatmentActionState } from "@/modules/treatment/actions";

const VACIO: TreatmentActionState = { error: null, success: null, warning: null };

// IMPRIMIR EL PLAN PARA ENTREGARLO EN LA CONSULTA, Y REGISTRAR LA ENTREGA (2026-09-09).
//
// SEPARADO DE `HcImprimir` aunque haga lo mismo, y no por gusto: el rotulo es la mitad del mensaje. El de
// la historia clinica dice "Imprimir o guardar PDF" porque ese documento se guarda; este dice
// "Imprimir el plan" porque su proposito es ENTREGARLO en la mano, ahora. Un mismo boton con un rotulo
// generico en dos sitios distintos deja al profesional preguntandose por que hay dos.
//
// Y AHORA ADEMAS DEJA CONSTANCIA. Antes habia un segundo boton al lado, "Entregado en consulta", que
// sellaba la prescripcion y la cerraba; Santiago lo reporto como confuso. Imprimir ES el acto de entregar
// en consulta, asi que el registro va donde ya estaba el gesto y desaparece el tramite.
//
// POR QUE ESTO NO REPITE EL ERROR DE CONVERTIR UNA LECTURA EN UNA FIRMA. Ese argumento (imprimir es leer;
// se imprime para revisar, y dos veces si salio torcida) era correcto cuando emitir CERRABA la
// prescripcion. Ahora emitir solo REGISTRA: dos impresiones dejan dos lineas que dicen la verdad, y la
// prescripcion sigue abierta.
//
// EL ORDEN: se imprime YA y el registro viaja en paralelo. Al reves, el profesional esperaria a la nube
// para ver el dialogo de impresion, que es la peor forma de pagar una constancia. Si el registro falla,
// el aviso lo dice y nombra la via de reintento (volver a imprimir), porque ya no hay boton propio.
export function PlanImprimirBoton({ evaluationId }: { evaluationId: string }) {
  const [state, registrar, registrando] = useActionState(registrarPlanImpresoAction, VACIO);
  useFormToastAndRefresh(state);

  const imprimir = () => {
    const datos = new FormData();
    datos.set("evaluationId", evaluationId);
    startTransition(() => registrar(datos));
    window.print();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="no-print self-start"
      onClick={imprimir}
      disabled={registrando}
    >
      <Printer className="size-4" aria-hidden />
      Imprimir el plan
    </Button>
  );
}
