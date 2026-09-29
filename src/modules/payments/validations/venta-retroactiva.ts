import { z } from "zod";

// Las lineas de una venta retroactiva, tal como las manda la pantalla (un JSON en un campo oculto).
//
// EL PRECIO SE TECLEA Y NO SALE DEL CATALOGO, a proposito: es el precio que tenia el producto EL DIA DE LA
// VENTA, que es el que dice la factura ya emitida. Tomarlo del catalogo de hoy reescribiria la historia con
// los precios de ahora, y la venta dejaria de cuadrar con su propio documento.
// EL ID VA CON z.guid() Y NO CON .uuid(), y esto BLOQUEO EL SMOKE (2026-09-29). Zod 4 valida en `.uuid()`
// los bits de version y variante del RFC, y los UUID fijos del seed (77777777-7777-...) NO los cumplen:
// el primer producto de la lista era uno de esos, asi que la venta se rechazaba SIEMPRE, con cualquier
// precio. Y el mensaje culpaba al formato del numero, que estaba bien.
//
// La regla ya estaba escrita en SEIS modulos y tenia test en comodato; este archivo se escribio despues y
// no la aplico. Ahora hay un candado que barre TODO el codigo (`ids-con-guid`).
export const lineaRetroactivaSchema = z.object({
  nutraceuticalId: z.guid(),
  cantidad: z.number().int().positive().max(1000),
  precioUnitario: z.number().positive().max(100_000_000),
});

export const lineasRetroactivasSchema = z.array(lineaRetroactivaSchema).min(1).max(50);

export type LineaRetroactivaValidada = z.infer<typeof lineaRetroactivaSchema>;
