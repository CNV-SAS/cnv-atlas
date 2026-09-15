import { NextResponse, type NextRequest } from "next/server";

import { enviarResumen } from "@/modules/avisos/services/avisos-service";

// EL RESUMEN DE AVISOS, disparado por Vercel Cron (Bloque A): /api/cron/avisos/am a las 7 a. m. y /pm a las 5 p. m.
// de Colombia (vercel.json, en UTC). Sin sesion: el proxy excluye /api.
//
// LA SEGURIDAD ES EL SECRETO: Vercel manda "Authorization: Bearer <CRON_SECRET>" en cada invocacion. Sin el, no
// se arma nada. Y aunque alguien con el secreto la llamara dos veces, el servicio reclama el dia y la franja: el
// mismo resumen no sale dos veces. La logica vive en el servicio (regla 2).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Un correo por destinatario agrupado y otro de escalamiento, cada uno con 15 s de timeout. Sobra.
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ franja: string }> }) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "config" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { franja } = await params;
  if (franja !== "am" && franja !== "pm") return NextResponse.json({ error: "franja" }, { status: 400 });
  const resultado = await enviarResumen(franja);
  return NextResponse.json(resultado);
}
