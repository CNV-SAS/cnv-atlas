"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

// IMPRIMIR EL PLAN PARA ENTREGARLO EN LA CONSULTA.
//
// SEPARADO DE `HcImprimir` aunque haga lo mismo, y no por gusto: el rotulo es la mitad del mensaje. El de
// la historia clinica dice "Imprimir o guardar PDF" porque ese documento se guarda; este dice
// "Imprimir el plan" porque su proposito es ENTREGARLO en la mano, ahora. Un mismo boton con un rotulo
// generico en dos sitios distintos deja al profesional preguntandose por que hay dos.
export function PlanImprimirBoton() {
  return (
    <Button type="button" variant="outline" size="sm" className="no-print self-start" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Imprimir el plan
    </Button>
  );
}
