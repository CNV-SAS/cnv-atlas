"use client";

import { startTransition } from "react";

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
export function enviarSinReset(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };
}
