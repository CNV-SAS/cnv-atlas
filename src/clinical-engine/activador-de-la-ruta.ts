// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE ACTIVO ESTA RUTA EN ESTA CONSULTA  ·  2026-11-07
//
// ═══ EL CASO QUE LO PIDIO, Y POR QUE NO SE ARREGLA EN EL MOTOR ═══
//
// El smoke de `ed83ff97` mostro la tarjeta de la R1 diciendo *"Activación: IFC bajo + IRC alto + IAE
// acelerado"* mientras su IRC era 2,71, que es NORMAL. No es un defecto del port: su archivo (v16) tiene
// DOS reglas para la R1 y las dos estan portadas verbatim.
//
//   · El ROTULO `RUTAS.R1.activacion` (su L11685) acompaña a su predicado `condicion` de la linea
//     siguiente: un Y de tres, `ifc < 4.5 && irc >= 3.5 && iae >= 5`. Ese predicado NO decide nada: en su
//     propio archivo solo lo llama `activar`, que nadie usa, y en el nuestro (`RUTA_COND`) solo lo tocan
//     los tests.
//   · La ACTIVACION de verdad es el DFI, y su archivo lo declara con ese titulo: *"DFI como UNICA fuente
//     de rutas"*. Es `if(dom1.sev>=2) rutas.push("R1 ...")` (su L14095), y el dominio 1 sale de la matriz
//     D1 sobre las ETIQUETAS de IFC e IRC (su L14023), donde `"Normal|Normal"` vale 2. El IAE no entra en
//     el dominio 1: vive en el 3, que es el que activa la R4.
//
// Asi que el rotulo no miente sobre SU archivo: describe su otra regla. Lo que engaña es ponerlo donde se
// lee como el motivo de ESTA consulta. La Regla 0 cierra las dos salidas faciles: cambiar el rotulo es
// editar su contenido clinico y cambiar la activacion es editar su DFI. Las dos se le devuelven a el
// (PENDIENTES, pregunta 38) con las cifras medidas.
//
// LO QUE SI PODEMOS HACER, y es lo que hace este modulo: MOSTRAR EL DATO CAPTURADO. El dominio que la
// activo, su severidad y su clasificacion ya estan sellados en el snapshot; decirlos no construye
// contenido clinico, representa el archivo (Regla 0: *"Mostrar un dato capturado NO es construir
// contenido"*). Con la frase al lado, el profesional ve que la R1 entro por el dominio 1 y no por el IAE.
//
// PURO: sin React, sin Next, sin Supabase (regla dura 12). Vive en el motor porque el MAPA ruta->dominio
// es suyo, leido de su `computeDFI`, y tiene que moverse con el si el lo mueve.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import type { DfiDomain } from "./types";

/**
 * Ruta -> dominio que la empuja, LEIDO de su `computeDFI` (v16 L14095-14100):
 *
 *   if(dom1.sev>=2)              rutas.push("R1 · Restauración Celular")
 *   if(dom2.sev>=2)              rutas.push("R2 · Reducción Cardiometabólica")
 *   if(dom4.veto||dom4.sev===3)  rutas.push("R3 · Conductual (prioritaria)")
 *   if(dom3.sev>=2)              rutas.push("R4 · Desaceleración Envejecimiento")
 *   if(dom5.sev>=2)              rutas.push("R5 · Contextual")
 *   if(!rutas.length)            rutas.push("R6 · Mantenimiento")
 *
 * OJO CON EL CRUCE: la R3 sale del dominio 4 y la R4 del dominio 3. El numero de la ruta NO es el del
 * dominio, y escribirlo "obvio" (R3->d3) habria puesto una explicacion equivocada en una tarjeta clinica.
 */
const DOMINIO_DE_LA_RUTA: Record<string, string> = {
  R1: "d1",
  R2: "d2",
  R3: "d4",
  R4: "d3",
  R5: "d5",
};

/**
 * La frase que dice que activo esta ruta EN ESTA CONSULTA, o null cuando no se puede decir sin inventar.
 *
 * Devuelve null (y la tarjeta no dice nada) en los tres casos en que afirmarlo seria falso:
 *   · la R6, que no la activa un dominio sino la AUSENCIA de las otras cinco;
 *   · un snapshot viejo que no trae los dominios sellados;
 *   · un dominio con severidad null, que es "no se midio" y no un cero.
 */
export function activadorDeLaRuta(rutaId: string, domains: DfiDomain[] | null | undefined): string | null {
  if (rutaId === "R6") {
    return "La activa que ninguna de las otras cinco rutas esté activa en esta consulta.";
  }
  const id = DOMINIO_DE_LA_RUTA[rutaId];
  if (!id || !domains) return null;
  const d = domains.find((x) => x.id === id);
  if (!d || d.sev == null) return null;
  const n = id.slice(1);
  // EL VETO VA PRIMERO en la R3: cuando esta, es lo que la empuja aunque la severidad no llegue a 3.
  if (rutaId === "R3" && d.veto) {
    return `En esta consulta la activó el veto conductual del dominio ${n} (${d.nombre}).`;
  }
  return `En esta consulta la activó el dominio ${n} (${d.nombre}), severidad ${d.sev} de 3: ${d.clasif}.`;
}
