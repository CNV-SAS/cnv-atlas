"use client";

import { useState } from "react";

import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { DetailsSection } from "@/modules/diagnoses/components/details-section";
import type { Composition, CompositionCorrections } from "@/modules/diagnoses/data/composition-map";

import { AntropometriaEditable } from "./antropometria-editable";

// LAS MEDIDAS Y LA TABLA, JUNTAS, PARA QUE LA TABLA SE RECALCULE MIENTRAS SE ESCRIBE (2026-09-09).
//
// EL SMOKE QUE LO PIDIO: con el guardado al salir del campo, para ver el efecto de la meta de peso habia
// que salir del campo. Santiago lo quiere como la subpestaña del nutricionista, donde se escribe y la
// tabla de validacion se recalcula en vivo.
//
// ES EL MISMO PATRON QUE YA RESOLVIMOS ALLI, y por eso no se inventa nada: el valor VIVO gobierna lo que
// se PINTA, y el guardado sigue siendo un acto aparte. Alli la tabla de validacion recalcula con los
// cuatro ajustes sin guardar; aqui la fila de Peso de Wang recalcula con la meta sin guardar.
//
// POR QUE HACE FALTA ESTE ENVOLTORIO. Los dos son componentes cliente, pero los montaba un componente de
// SERVIDOR (`entrada-evaluacion`), asi que no tenian estado en comun: el input estaba en uno y la tabla en
// otro. Este archivo es lo unico que los une, y no hace nada mas.
//
// LO QUE **NO** CAMBIA, y es lo que mantiene la garantia de la tabla: la meta sigue sin escribirse en el
// snapshot, sigue sin viajar al documento, y el guardado sigue pasando por la misma accion con sus guardas.
// Lo unico que se adelanta es el DIBUJO.
export function MedidasConTabla({
  evaluationId,
  composition,
  corrections,
  pesoMetaKg,
  fuerzaPrensilKg,
  sellada,
  tituloTabla,
}: {
  evaluationId: string;
  composition: Composition;
  corrections: CompositionCorrections;
  pesoMetaKg: number | null;
  fuerzaPrensilKg: number | null;
  sellada: boolean;
  /**
   * Titulo del desplegable que envuelve la tabla.
   *
   * ES UNA CADENA, Y NO PUEDE SER OTRA COSA. La primera version recibia una FUNCION
   * (`envoltorioTabla: (tabla) => ReactNode`) para que la pagina decidiera el envoltorio, y eso reventaba
   * la ruta entera: **una funcion no cruza la frontera servidor -> cliente**. React no puede serializarla
   * y lanza "Functions cannot be passed directly to Client Components". Lo monta un componente de
   * SERVIDOR, asi que toda prop tiene que ser serializable. Un ReactNode ya rendido si cruza; una funcion
   * que lo produce, no.
   */
  tituloTabla: string;
}) {
  // EL VALOR VIVO, inicializado del guardado. Se re-deriva cuando el servidor cambia porque la pagina
  // remonta este arbol con la clave de los valores guardados (misma mecanica que el formulario de dentro).
  const [metaEnVivo, setMetaEnVivo] = useState<number | null>(pesoMetaKg);

  return (
    <>
      {/* Las medidas van ANTES de la tabla: se corrigen y despues se lee lo que sale de ellas. Al reves,
          el profesional lee una tabla calculada sobre un valor que aun no ha revisado. */}
      <AntropometriaEditable
        evaluationId={evaluationId}
        valores={{
          peso: composition.peso,
          talla: composition.talla,
          cintura: composition.cintura,
          cadera: composition.cadera,
        }}
        corrections={corrections}
        pesoMetaKg={pesoMetaKg}
        fuerzaPrensilKg={fuerzaPrensilKg}
        sellada={sellada}
        onMetaEnVivo={setMetaEnVivo}
      />
      {/* ABIERTA POR DEFECTO desde el 2026-09-07 (punto 6 de su cotejo). Gildardo escribio "no estan los
          datos antropometricos por nivel de Wang, por que" y la tabla SI estaba: estaba plegada. Que la
          pieza exista no basta si no se ve.

          SE CONSERVA EL DESPLEGABLE, y no es tibieza: son unas treinta filas por encima del bloque de
          sarcopenia, asi que quitarlo obliga a recorrerla entera cada vez que se vuelve. Abierta de
          entrada resuelve la causa real y deja plegarla despues.

          Y VIVE AQUI DENTRO, no en la pagina: envolverla desde fuera exigiria pasar una funcion a este
          componente, que es lo que rompio la ruta. */}
      <DetailsSection title={tituloTabla} defaultOpen>
        <CompositionSection
          composition={composition}
          showDiagnosis={false}
          showTitle={false}
          // LA META VIVA, no la guardada: es lo que hace que la fila de Peso se recalcule al teclear.
          pesoMetaKg={metaEnVivo}
        />
      </DetailsSection>
    </>
  );
}
