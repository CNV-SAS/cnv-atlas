// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL TUNEL DE ERRORES: POR QUE LOS FALLOS DE UN USUARIO REAL NO LLEGABAN
//
// ═══ EL CASO (Santiago, 2026-11-03) ═══
//
// Una integrante abre Antrop. & BIS y ve *"Esta pestaña no se pudo mostrar. Ya registramos el problema."*
// Refresca y sigue igual. Santiago entra como admin a la MISMA consulta y la ve bien. **Y Sentry no tiene
// ni un evento.**
//
// ═══ LA CAUSA DE QUE NO HAYA EVENTO, Y ES INDEPENDIENTE DE CUAL SEA EL FALLO ═══
//
// El SDK de navegador de Sentry hace POST directo a su host de ingest (`*.ingest.sentry.io`). Esa
// direccion esta en las listas de bloqueo de CUALQUIER bloqueador de anuncios, de muchas extensiones de
// privacidad y de bastantes redes corporativas: la peticion no sale, el SDK no reintenta y el evento se
// pierde SIN QUE NADA LO DIGA, ni en su pantalla ni en la nuestra.
//
// POR ESO NOSOTROS NUNCA LO VIMOS: en nuestras maquinas sale, asi que el instrumento parecia sano. Lo que
// estaba roto era justo el camino de los usuarios REALES, que son los unicos que encuentran estos fallos.
//
// Y HAY UNA SEGUNDA MITAD, mas grave que un evento perdido: la pantalla le PROMETE a quien lo sufre que
// "ya registramos el problema". Si no llega, esa frase es falsa, y el profesional se queda esperando una
// reaccion que nadie va a tener. Un aviso que miente sobre lo que el sistema hizo es peor que no avisar.
//
// ═══ EL TUNEL ═══
//
// El SDK de Next sabe mandar los eventos a una ruta de NUESTRO dominio, que los reenvia a Sentry desde el
// servidor. Para el navegador es una peticion a `atlas.cnvsystem.com`, igual que cualquier otra de la
// aplicacion: no hay nada que bloquear sin romper la aplicacion entera.
//
// LA RUTA NO DICE "sentry" NI "error" a proposito: una ruta llamada `/sentry` o `/errors` vuelve a ser
// reconocible para una lista de bloqueo, que es exactamente el problema que esto viene a resolver.
//
// ═══ UNA SOLA FUENTE, PORQUE SON TRES SITIOS ═══
//
// La ruta la necesitan la configuracion del build (que la crea), el proxy (que tiene que dejarla pasar sin
// sesion) y la CSP. Escrita tres veces, el dia que cambie una el tunel deja de funcionar EN SILENCIO, que
// es el mismo modo de fallo que vino a arreglar. Un candado comprueba que los tres la lean de aqui.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La ruta de nuestro dominio por la que viajan los eventos de error del navegador.
 *
 * SE LLAMA COMO LO QUE HACE Y NO COMO LO QUE LLEVA: "monitoreo" describe la funcion sin nombrar al
 * proveedor, que es lo que la mantiene fuera de las listas de bloqueo.
 */
export const RUTA_DEL_TUNEL_DE_ERRORES = "/monitoreo";

/**
 * ¿Esta peticion es del tunel? El proxy la deja pasar SIN SESION, igual que los webhooks de pago.
 *
 * POR QUE SIN SESION, que es la parte que no es obvia: los errores que mas falta hacen son los de las
 * pantallas PUBLICAS (la encuesta del paciente, el consentimiento por QR, el checkout), donde por
 * definicion no hay sesion. Si el tunel exigiera una, se perderian justo esos.
 *
 * Y NO ABRE NADA: el tunel solo reenvia un cuerpo de evento al host de ingest. No lee ni escribe la base.
 */
export function esElTunelDeErrores(path: string): boolean {
  return path === RUTA_DEL_TUNEL_DE_ERRORES || path.startsWith(`${RUTA_DEL_TUNEL_DE_ERRORES}/`);
}
