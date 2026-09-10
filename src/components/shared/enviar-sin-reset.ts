"use client";

import { startTransition } from "react";

import { preservarScroll } from "./preservar-scroll";

// ENVIAR UN FORMULARIO SIN QUE REACT LO RESETEE.
//
// EL DEFECTO, verificado en el react-dom instalado (19.2.4), no razonado: cuando un `<form>` lleva la prop
// `action`, React programa un `form.reset()` NATIVO como parte de la transicion de la accion:
//
//     null === action ? noop : function () { requestFormReset$1(formFiber); return action(formData); }
//     ...
//     5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
//
// Y LOS INPUTS SOBREVIVEN AL RESET PERO LOS SELECTS Y LOS CHECKBOX NO. Es lo que hacia el defecto tan
// dificil de leer, porque el mismo formulario se porta de dos maneras:
//
//   · input / textarea: `element.defaultValue = value` en CADA actualizacion, asi que el reset lo devuelve
//     al mismo valor que ya tenia. Inmunes.
//   · select: `setDefaultSelected && (node[i].defaultSelected = true)`, y `setDefaultSelected` solo es
//     cierto AL MONTAR. El reset devuelve el select a la opcion elegida cuando el componente se monto.
//   · checkbox / radio CONTROLADO: `null == checked && null != defaultChecked && (element.defaultChecked
//     = ...)`. Con `checked` presente, React NO toca `defaultChecked`. El reset lo devuelve al de montaje.
//
// SINTOMA (panel de tratamiento, smoke del 2026-09-01): al pulsar "Guardar ajustes", los dos desplegables
// del PAL saltaban a otro nivel durante uno o dos segundos, lo que tarda el `router.refresh()` en devolver
// y remontar la seccion con el valor bueno. Pasaba SIN TOCAR EL PAL, porque el reset es del FORMULARIO
// ENTERO y no del campo, y pasaba en los dos desplegables a la vez por la misma razon.
//
// NO ES SOLO COSMETICO: durante esa ventana el DOM y el estado de React dicen cosas distintas, y si el
// profesional toca un campo ahi, el `onChange` parte del valor RESETEADO, no del que tenia.
//
// ESTABA ESCRITO EN CLAUDE.md desde hace semanas, con este mismo arreglo, porque ya nos mordio en el
// formulario del paciente (ahi borraba lo que la persona habia llenado). Se aplico alli y en ningun otro
// sitio. La leccion no es la tecnica: es que un hazard documentado sigue vivo en todas las superficies
// donde nadie fue a aplicarlo, y solo se ve en un navegador real.
//
// NO ES UN HOOK (no usa ninguno): se llama en el JSX, y el prefijo `use` activaria las reglas de hooks de
// eslint sin motivo.
// ═══ Y AQUI SE ARMA EL GUARD DEL SCROLL (2026-09-10) ═══
//
// POR QUE AQUI Y NO EN LOS HOOKS DEL TOAST, que es donde estaba: por las dos razones a la vez.
//
//   1. ALCANCE. Los hooks del toast los usan 29 archivos de los 59 que tienen formularios de accion. Este
//      helper lo usan 47. El comentario que decia "el mecanismo unico por donde pasan los 78 formularios"
//      describia a los hooks, y era falso: treinta archivos no pasaban por ninguno.
//   2. MOMENTO. Aqui la pagina esta DONDE EL PROFESIONAL LA DEJO. Los hooks corren al llegar el resultado,
//      que es despues del viaje al servidor y (posiblemente) despues del salto.
//
// El detalle completo, en `preservar-scroll.ts`.
export function enviarSinReset(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    preservarScroll();
    startTransition(() => action(new FormData(e.currentTarget)));
  };
}

/**
 * Lo mismo para un boton SIN formulario: invoca la accion en una transicion y arma el guard del scroll.
 *
 * EXISTE PORQUE HAY CINCO SITIOS ASI (generar el resumen del diagnostico, resolver un conflicto de
 * identidad, la fase de encuesta, la venta en efectivo y la identidad automatica): no tienen `<form>`,
 * llaman a la accion desde un `onClick`, y por eso quedaban fuera de todo. No se pide que se conviertan
 * en formularios: se les da la misma puerta.
 */
export function ejecutarAccion(action: (fd: FormData) => void, fd: FormData): void {
  preservarScroll();
  startTransition(() => action(fd));
}
