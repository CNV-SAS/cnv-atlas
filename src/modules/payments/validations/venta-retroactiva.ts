import { z } from "zod";

// Las lineas de una venta retroactiva, tal como las manda la pantalla (un JSON en un campo oculto).
//
// EL PRECIO SE TECLEA Y NO SALE DEL CATALOGO, a proposito: es el precio que tenia el producto EL DIA DE LA
// VENTA, que es el que dice la factura ya emitida. Tomarlo del catalogo de hoy reescribiria la historia con
// los precios de ahora, y la venta dejaria de cuadrar con su propio documento.
export const lineaRetroactivaSchema = z.object({
  nutraceuticalId: z.string().uuid(),
  cantidad: z.number().int().positive().max(1000),
  precioUnitario: z.number().positive().max(100_000_000),
});

export const lineasRetroactivasSchema = z.array(lineaRetroactivaSchema).min(1).max(50);

export type LineaRetroactivaValidada = z.infer<typeof lineaRetroactivaSchema>;
