import { TriangleAlert } from "lucide-react";

import type { LasDosLecturas } from "../data/freno-de-la-contradiccion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS LECTURAS DEL ENVEJECIMIENTO NO DICEN LO MISMO  ·  EL AVISO DEL FRENO
//
// ═══ POR QUE EXISTE ═══
//
// El freno vive en el SERVICIO de entrega (ahi no se puede saltar). Pero un freno que solo habla cuando
// ya se pulso el boton deja al profesional recibiendo un error que no esperaba, con el paciente delante.
// Este aviso es la otra mitad: se lee ANTES, junto al documento que frena.
//
// ═══ QUE DICE, Y POR QUE LAS DOS CIFRAS ═══
//
// Nombrar el defecto sin mostrar en que se contradicen dejaria al profesional sin poder juzgar lo que
// tiene delante. Van las dos lecturas con su origen, para que se vea que no es un error de su consulta.
//
// Y NO LE PIDE QUE LO ARREGLE, porque no puede: es un desfase nuestro entre dos versiones del motor, y el
// criterio que lo cierra es de la Direccion Cientifica. Un freno que exige una accion imposible es peor
// que el defecto que frena.
//
// SERVIDOR, SIN ESTADO: es texto derivado de un dato ya leido. No necesita hidratarse.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function AvisoDeContradiccion({ lecturas }: { lecturas: LasDosLecturas }) {
  const iae = lecturas.iae.toFixed(1).replace(".", ",");
  const conSigno = lecturas.iae > 0 ? `+${iae}` : iae;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-clinical-warning bg-clinical-warning-bg p-4">
      <h3 className="flex items-start gap-2 text-sm font-semibold text-clinical-warning">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Este documento se contradice sobre el envejecimiento, y por eso no se puede entregar
      </h3>
      <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        <li>
          La <strong>edad biológica estimada</strong> de esta consulta da un IAE de{" "}
          <strong>{conSigno} años</strong>, o sea{" "}
          {lecturas.segunLaEbBis === "acelerado" ? "acelerado" : "acorde con sus pares"}.
        </li>
        <li>
          El <strong>diagnóstico funcional</strong> lee ese mismo envejecimiento como{" "}
          {lecturas.segunElDfi === "acelerado" ? "acelerado" : "no acelerado"}, y de ahí salen su dominio
          de envejecimiento y las rutas que se activan.
        </li>
      </ul>
      <p className="max-w-prose text-sm text-muted-foreground">
        No es un error de tu consulta ni hay nada que corregir en ella: las dos cifras salen de versiones
        distintas del motor, y cuál debe regir lo define la Dirección Científica. Mientras tanto el informe
        y la historia clínica no se le entregan al paciente, para que no reciba un documento que afirma dos
        cosas opuestas sobre su cuerpo. El plan y las rutas sí se pueden imprimir y entregar.
      </p>
    </section>
  );
}
