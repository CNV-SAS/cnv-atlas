import { NextResponse, type NextRequest } from "next/server";

import { avisarDeVencimientos } from "@/modules/nutraceuticals/services/vencimientos-service";

// LA ALERTA DE VENCIMIENTO, disparada por Vercel Cron (0186): una vez al dia, 8:30 a. m. de Colombia
// (vercel.json, en UTC). Sin sesion: el proxy excluye /api.
//
// LA SEGURIDAD ES EL SECRETO, igual que en /api/cron/avisos: Vercel manda "Authorization: Bearer
// <CRON_SECRET>". Y correrla dos veces no hace daño: el registro de la alerta es unico por lote y ubicacion,
// asi que la segunda corrida no genera nada nuevo ni reinicia el reloj de la anticipacion.
//
// SEPARADA DEL RESUMEN DE VENTAS a proposito, aunque las dos avisen: el publico es otro (aqui el correo va al
// INTEGRANTE, no solo a CNV) y un fallo de una no puede impedir la otra. Los avisos de ventas son de dinero
// que ya se movio; este es de dinero que se va a perder si nadie actua.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Un correo por Integrante con lotes nuevos, mas el resumen a CNV. Con siete Integrantes sobra.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "config" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resultado = await avisarDeVencimientos();
  return NextResponse.json(resultado);
}
