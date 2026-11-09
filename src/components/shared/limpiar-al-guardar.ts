"use client";

import { useState } from "react";

import type { FormToastState } from "./use-form-toast";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE GUARDO NO SE QUEDA EN EL CAMPO  ·  Santiago, 2026-11-09 (barrido del patron)
//
// ═══ EL DEFECTO, Y POR QUE NO ES COSMETICO ═══
//
// El 8 de noviembre Santiago reporto que al agregar una observacion habia que esperar unos cinco segundos
// para que el campo se limpiara y apareciera la vigente. La causa no era el guardado, que es inmediato:
// la pantalla esperaba al `router.refresh()`, que recompone la PAGINA ENTERA.
//
// Y LO QUE PASA EN ESA VENTANA es lo que importa: la accion ya termino, asi que el boton vuelve a estar
// habilitado, y el campo sigue lleno con lo que se acaba de guardar. En consulta, o en una vitrina con el
// telefono en la mano, eso es exactamente el momento en que alguien vuelve a pulsar. Si la accion CREA una
// fila, la segunda pulsacion no corrige: DUPLICA.
//
// ═══ EL BARRIDO (2026-11-09): DONDE MAS PASA ESTO EN ATLAS ═══
//
// Se midieron los 47 componentes cliente que mandan un formulario con un campo de texto. De los 22 que no
// limpiaban nada, la mayoria NO puede duplicar, y por razones que conviene dejar escritas para no
// "arreglar" lo que ya esta bien:
//
//   · LOS QUE RESUELVEN UN PENDIENTE (confirmar un faltante, cerrar una devolucion, resolver un sobrante,
//     verificar una devuelta, aprobar una eliminacion): el writer lee el estado de la fila y la segunda
//     pulsacion se rechaza, porque ya no esta pendiente. El item desaparece de la lista, ademas.
//   · LOS CREADORES CON GUARDA: pedir la eliminacion de un paciente ("ya hay una peticion esperando"), la
//     venta retroactiva (su aviso de duplicado con "Generar de todos modos"), proponer un paciente de
//     prueba.
//   · LOS QUE REESCRIBEN EL MISMO DATO de una consulta (las circunferencias, las medidas de
//     Antropometria): la segunda pulsacion escribe lo mismo encima.
//
// QUEDAN TRES QUE SI DUPLICAN, y los tres mueven inventario o dinero:
//
//   1. DECLARAR UNA REMESA: crea el movimiento de despacho. Dos pulsaciones, dos remesas (solo las limita
//      la existencia en la central).
//   2. DECLARAR UNA DEVOLUCION: solo comprueba el disponible, asi que declarar 5 dos veces teniendo 10
//      pasa las dos. Su propio comentario ya avisaba del riesgo de "declarar dos veces las mismas cinco".
//   3. REGISTRAR EL CONTEO: crea una sesion de conteo nueva, y de ahi salen los FALTANTES. Un conteo
//      duplicado abre faltantes duplicados, que tienen consecuencia economica para el Integrante.
//
// ═══ QUE HACE ESTE HOOK, Y QUE NO ═══
//
// Cuenta los EXITOS de la accion. Ese numero sirve de `key` para remontar los campos no controlados (que
// nacen vacios) y, con `reponer`, para devolver a su sitio el estado de un formulario controlado.
//
// SOLO CON `success`, NUNCA CON ERROR: si el servidor rechaza, lo escrito se queda donde estaba. Es la
// leccion del hazard 2 de CLAUDE.md (el auto-reset de React 19 borrando lo que el paciente lleno) y vale
// igual aqui: limpiar un campo porque la accion VOLVIO, sin mirar como volvio, pierde el trabajo justo
// cuando hay que corregirlo.
//
// Y NO ES UN EFECTO: se compara el estado con el ultimo visto durante el render, que es el patron que ya
// usa `corregir-fecha-de-nacimiento`. Un `useEffect` que limpia encadena un render de mas y deja un
// instante con el campo lleno y el boton vivo, que es justo la ventana que esto cierra.
//
// LO QUE ESTO **NO** SUSTITUYE es pintar la fila recien guardada (lo que hace la pantalla de
// observaciones con la fila que devuelve su accion). Eso es mejor donde la fila se LISTA en la misma
// pantalla; esto es para los formularios cuyo resultado se ve en otra parte.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El numero de veces que la accion ha salido BIEN. Cambia solo con un exito.
 *
 * @param reponer Se llama una vez por exito, para reponer el estado de un formulario controlado. Solo
 *                para eso: corre durante el render, asi que ahi dentro no cabe nada que no sea un
 *                `setState`.
 */
export function useLimpiarAlGuardar(state: FormToastState, reponer?: () => void): number {
  const [visto, setVisto] = useState(state);
  const [exitos, setExitos] = useState(0);
  if (state !== visto) {
    setVisto(state);
    if (state.success) {
      setExitos((n) => n + 1);
      reponer?.();
    }
  }
  return exitos;
}
