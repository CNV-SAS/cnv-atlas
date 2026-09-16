import { NextResponse, type NextRequest } from "next/server";

import { cotejarConWompi } from "@/modules/payments/services/conciliacion-service";

// EL COTEJO CON WOMPI, disparado por Vercel Cron (Bloque 3b, sesion 3): /api/cron/cotejo-wompi a las 8 a. m. de
// Colombia (vercel.json, en UTC). Recupera los pagos aprobados cuyo webhook no llego, que hoy no los recupera
// nada: Wompi reintenta 3 veces en 24 horas y despues no mas. Sin sesion: el proxy excluye /api.
//
// LA SEGURIDAD ES EL SECRETO, igual que en los avisos: "Authorization: Bearer <CRON_SECRET>". Y correrlo dos
// veces no hace dano: cada pago se aplica por la ruta idempotente del webhook. La logica vive en el servicio
// (regla 2).
//
// LA VENTANA ES DE TRES DIAS a proposito, no de uno: el ultimo reintento de Wompi cae pasadas 24 horas, y un
// problema que dure un fin de semana tiene que quedar cubierto igual.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una consulta a Wompi (15 s) y, por cada pago recuperado, sellar y facturar en Alegra, que espera a la DIAN.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "config" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await cotejarConWompi({ origen: "tarea" });
  return NextResponse.json({
    ambiente: r.ambiente,
    revisadas: r.revisadas,
    recuperadas: r.recuperadas.length,
    ya_estaban: r.yaEstaban,
    discrepancias: r.discrepancias.length,
    fallo: r.falloPor,
  });
}
