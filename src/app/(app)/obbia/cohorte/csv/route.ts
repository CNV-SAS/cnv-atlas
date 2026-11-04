import { NextResponse } from "next/server";

import { formatDate } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import { leerCohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import { registrarLaEntregaDelResumen } from "@/modules/obbia/data/registro-de-la-entrega-writer";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
import {
  descripcionDelFiltro,
  filtroPedido,
  hayFiltro,
} from "@/modules/obbia/services/filtro-de-la-cohorte";
import {
  alcanceDelResumen,
  nombreDelResumen,
  resumenDeLaCohorteACsv,
} from "@/modules/obbia/services/exportar-la-cohorte";

// DESCARGAR EL RESUMEN DE LA COHORTE, Y QUE QUEDE REGISTRADO (Santiago, 2026-10-30).
//
// POR QUE UNA RUTA Y NO UNA ACTION: lo que se devuelve es un ARCHIVO. Es el mismo camino del export de
// respuestas de la encuesta, con su misma forma: policy, lectura, asiento, y el navegador haciendo lo que
// sabe hacer con un `Content-Disposition: attachment`.
//
// LO QUE SALE SON CIFRAS, NO FILAS, y eso no es una promesa del comentario: el CSV lo arma un modulo puro
// que solo recibe el resumen agregado (`resumenDeLaCohorteACsv`), asi que no tiene de donde sacar una fila
// de paciente aunque alguien quisiera. El dataset fila a fila sigue cerrado a proposito: seria
// seudonimizado (dato personal) y la verificacion de k-anonimato que `DATA_GOVERNANCE.md` exige para un
// export externo no esta construida.
//
// EL ORDEN IMPORTA: se REGISTRA antes de devolver el archivo. Si el registro falla, no sale nada; al
// reves, un archivo podria salir sin rastro, que es justo lo que `research_datasets` existe para impedir.
//
// Node runtime: el asiento va inline con Drizzle.
export const runtime = "nodejs";

// ═══ Y EL MISMO FILTRO QUE LA PANTALLA (2026-11-04) ═══
//
// La descarga se pide DESDE una pantalla que puede estar filtrada, asi que el archivo tiene que llevar
// ESA cohorte. Si ignorara el filtro, alguien que filtra "mujeres de 40 a 60 de Medellin" y descarga se
// llevaria la cohorte entera creyendo que lleva su recorte, y el registro de la entrega lo afirmaria.
//
// EL FILTRO SE LEE DE LA MISMA FUNCION que la pantalla (`filtroPedido`), no de un parseo propio: dos
// lecturas del mismo parametro es como la pantalla y el archivo acaban describiendo cohortes distintas.
export async function GET(request: Request) {
  const user = await requireUser();
  // LA MISMA POLICY QUE LA PANTALLA (regla dura 3): quien puede ver estas cifras puede llevarselas. No se
  // inventa un permiso nuevo para la descarga, porque el archivo no dice nada que la pantalla no diga.
  if (!canViewObbia(user)) return new NextResponse("No autorizado", { status: 403 });

  const filtro = filtroPedido(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  const cohorte = await leerCohorteDeInvestigacion(filtro);
  const generadoEl = new Date().toISOString().slice(0, 10);
  const csv = resumenDeLaCohorteACsv(cohorte, {
    generadoEl: formatDate(generadoEl),
    generadoPor: user.fullName || user.email,
  });

  await registrarLaEntregaDelResumen({
    alcance: alcanceDelResumen(cohorte, generadoEl, descripcionDelFiltro(filtro)),
    actorId: user.id,
    actorEmail: user.email,
    cifras: {
      vigentes: cohorte.vigentes,
      autorizadas: cohorte.conAutorizacion,
      pacientes: cohorte.pacientesAutorizados,
      conDiagnostico: cohorte.conDiagnostico,
    },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreDelResumen(generadoEl, hayFiltro(filtro))}"`,
      // Agregado y sin PII, pero es una entrega de investigacion: no se cachea en ningun intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}
