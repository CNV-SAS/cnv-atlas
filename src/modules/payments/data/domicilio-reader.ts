import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ LO QUE EL DOMICILIO NECESITA SABER (0190, PODADO EL 2026-10-05) ═══
//
// LO QUE SE FUE, con la decision contable que saco el flete de CNV:
//
//   · `configuracionDeFlete` leia `commercial_config.flete_tarifa` y `flete_margen`. Ya no hay tarifa que
//     precargar ni margen que compensar, porque CNV no cobra el envio.
//   · `ciudadesConCobertura` y `ofertaVigente` resolvian un PORTON (a que destinos se ofrece). El porton
//     existia para no perder dinero en un envio; sin flete, CNV no pone dinero en ninguno.
//
// LO QUE SE QUEDA, y por una razon que no es el flete: el CODIGO DANE del municipio de destino. Lo pide el
// analisis de ICA, que es un impuesto sobre la venta del PRODUCTO y no sobre el envio, asi que no se fue con
// el flete. Ahora `delivery_cities` se usa como DIRECTORIO (traduce una ciudad a su codigo) y no como lista
// de permitidos: la ciudad que no este devuelve null en vez de bloquear la venta.

/** El codigo DANE de una ciudad, si esta en el directorio. null = no esta, y la venta sigue igual. */
export async function daneDe(ciudad: string, departamento?: string | null): Promise<string | null> {
  const nombre = ciudad.trim();
  if (nombre === "") return null;
  const [f] = await db.execute<{ dane_code: string | null }>(sql`
    select dane_code from delivery_cities
     where lower(city) = lower(${nombre})
       and (${departamento ?? null}::text is null or lower(department) = lower(${(departamento ?? "").trim()}))
     limit 1`);
  return f?.dane_code ?? null;
}

/** El departamento de una ciudad del directorio, cuando la pantalla no lo manda. */
export async function departamentoDe(ciudad: string): Promise<string | null> {
  const nombre = ciudad.trim();
  if (nombre === "") return null;
  const [f] = await db.execute<{ department: string }>(sql`
    select department from delivery_cities where lower(city) = lower(${nombre}) limit 1`);
  return f?.department ?? null;
}
