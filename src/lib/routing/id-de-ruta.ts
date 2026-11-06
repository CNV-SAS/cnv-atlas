import { notFound } from "next/navigation";
import { z } from "zod";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN ID DE RUTA QUE NO ES UN ID NO ES UN ERROR DEL SERVIDOR  ·  2026-11-06
//
// ═══ EL CASO (Sentry, 2026-11-05, Unhandled, pantalla caida) ═══
//
//   supersession-reader: invalid input syntax for type uuid: "ed83ff97-...-7081761594f7%7D"
//   GET /ani-bis-e/[id]
//
// Ese `%7D` es una llave de cierre (`}`) pegada al final del id: un enlace mal copiado. Atlas no genera
// ninguno asi (verificado el 2026-11-06: las quince superficies que arman enlaces interpolan `${id}`, y no
// hay ni un marcador con llaves en todo `src/`), asi que llego escrito a mano.
//
// LO QUE ESTABA MAL NO ERA EL ENLACE, ERA LA RESPUESTA. Ninguna de las veinte rutas dinamicas comprobaba su
// parametro, asi que el texto viajaba hasta Postgres, que contestaba 22P02 ("invalid input syntax for type
// uuid"), el lector lo relanzaba y la pagina se caia con un 500. Un id que no tiene forma de id es una
// direccion que no existe: eso es un 404. Y un 500 ademas ensucia Sentry con fallos que no son fallos, que
// es lo que esconde los que si (la misma razon del hazard 9 de CLAUDE.md).
//
// Y HAY UN SEGUNDO MOTIVO, mas serio que la pantalla: el mensaje de Postgres LLEVA EL VALOR que no pudo
// convertir. Si en vez de una llave llegara pegado un documento o un nombre, ese dato entraria a Sentry
// dentro del texto del error. Comprobar antes de preguntar corta las dos cosas.
//
// ═══ POR QUE `z.guid()` Y NO `z.uuid()` ═══
//
// Zod 4 valida con `.uuid()` los bits de version y variante del RFC 9562, y los ids fijos de la semilla no
// los cumplen: rechazarlos aqui tumbaria pantallas que funcionan (ya bloqueo un smoke una vez, y por eso
// `z.guid()` es la convencion del proyecto, escrita en `bis-intake/validations.ts`). Lo que hace falta aqui
// es exactamente lo que `z.guid()` comprueba: la FORMA 8-4-4-4-12, que es lo que Postgres sabe convertir.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ID = z.guid();

/**
 * ¿Este texto tiene forma de id de la base? Para las superficies que YA tienen su propia salida escrita
 * (el checkout del paciente dice "Link no disponible"), que es mejor que un 404 generico.
 */
export function esUnId(valor: string): boolean {
  return ID.safeParse(valor).success;
}

/**
 * El id de una ruta dinamica, o 404. SOLO para pages y route handlers: `notFound()` señaliza LANZANDO, y
 * desde una server action eso no es un 404, es un 500 con la pantalla caida (ver la memoria del proyecto
 * sobre los frenos que lanzan desde una accion).
 */
export function idDeRuta(valor: string): string {
  if (!esUnId(valor)) notFound();
  return valor;
}
