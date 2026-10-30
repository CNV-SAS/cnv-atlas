import { NextResponse } from "next/server";

import { formatDate } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import { leerCohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import { registrarLaEntregaDelResumen } from "@/modules/obbia/data/registro-de-la-entrega-writer";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
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

export async function GET() {
  const user = await requireUser();
  // LA MISMA POLICY QUE LA PANTALLA (regla dura 3): quien puede ver estas cifras puede llevarselas. No se
  // inventa un permiso nuevo para la descarga, porque el archivo no dice nada que la pantalla no diga.
  if (!canViewObbia(user)) return new NextResponse("No autorizado", { status: 403 });

  const cohorte = await leerCohorteDeInvestigacion();
  const generadoEl = new Date().toISOString().slice(0, 10);
  const csv = resumenDeLaCohorteACsv(cohorte, {
    generadoEl: formatDate(generadoEl),
    generadoPor: user.fullName || user.email,
  });

  await registrarLaEntregaDelResumen({
    alcance: alcanceDelResumen(cohorte, generadoEl),
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
      "Content-Disposition": `attachment; filename="${nombreDelResumen(generadoEl)}"`,
      // Agregado y sin PII, pero es una entrega de investigacion: no se cachea en ningun intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}
