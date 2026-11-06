import { NextResponse } from "next/server";

import { esUnId } from "@/lib/routing/id-de-ruta";
import { requireUser } from "@/modules/auth/session";
import { getHistoriaClinicaDoc } from "@/modules/reports/data/hc-documento-reader";
import { renderHistoriaClinicaPdf } from "@/modules/reports/services/render-report";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA HISTORIA CLINICA COMO PDF DEL SERVIDOR  ·  2026-11-03
//
// ═══ DE DONDE SALE ═══
//
// Santiago, sobre la HC descargada: *"Muestra la URL del paciente incluido el origen. Considero que esto
// no debería de aparecer."* Y en cada hoja salia tambien la fecha y la hora de impresion y el "5/9".
//
// ESO NO LO PONE ATLAS: lo pone el NAVEGADOR al imprimir una pagina. No hay CSS que lo quite (es
// configuracion del dialogo de impresion de cada persona), asi que mientras el boton fuera
// `window.print()`, la URL completa de la consulta iba a seguir saliendo impresa en un documento clinico
// que se le puede entregar a un paciente.
//
// ═══ Y EL ARGUMENTO QUE SOSTENIA `window.print()` YA NO SE SOSTIENE ═══
//
// Era bueno y estaba escrito: *"generar la historia otra vez en el servidor exigiria una SEGUNDA
// construccion del mismo documento, y dos construcciones del mismo insumo se desincronizan sin que nada
// avise"*. Lo que cambio es el hecho: esa segunda construccion YA EXISTE desde el 2026-10-xx, es
// `HistoriaClinicaDocument`, y es la que se le ENVIA al paciente por correo cuando la pide.
//
// Asi que no estabamos eligiendo entre una construccion y dos: ya habia dos, y el boton usaba la que
// mete la URL en el papel. Apuntarlo a la otra REDUCE las superficies en uso, no las aumenta.
//
// Y LA CONDICION QUE HIZO ACEPTABLE AQUEL PORTE SE CUMPLE AQUI: el documento llega COMPUESTO, no se
// compone aqui. Lo arma `getHistoriaClinicaDoc`, que llama a los MISMOS lectores que la pantalla y a la
// MISMA composicion, asi que el PDF y lo que el profesional tiene delante salen del mismo sitio.
//
// ═══ LA AUTORIZACION ES LA MISMA QUE LA DE LA PANTALLA ═══
//
// `requireUser` mas la RLS: `getHistoriaClinicaDoc` lee con el cliente de sesion, asi que un profesional
// que no puede ver esa consulta no recibe documento. No se duplica aqui ninguna regla de acceso, que es
// justo como se cuelan las divergencias entre una pantalla y su descarga.
//
// LA PANTALLA SIGUE IMPRIMIENDOSE con Ctrl+P y su hoja `imprimible`: lo que cambia es a donde apunta el
// BOTON. Quien prefiera imprimir lo que ve, puede.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// @react-pdf/renderer necesita el runtime de Node.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // UN TEXTO QUE NO ES UN ID se contesta igual que un documento que no existe (404), y no con el 500 que
  // sale cuando viaja hasta Postgres (`lib/routing/id-de-ruta.ts`). Aqui no va `notFound()`: este archivo
  // responde con sus propias respuestas, como las tres lineas de abajo.
  if (!esUnId(id)) return new NextResponse("Historia clínica no encontrada", { status: 404 });
  await requireUser();

  const hc = await getHistoriaClinicaDoc(id);
  // null = la RLS no alcanzo la consulta, o no existe. Las dos se contestan igual: no hay documento.
  if (!hc) return new NextResponse("Historia clínica no encontrada", { status: 404 });

  const pdf = await renderHistoriaClinicaPdf(hc);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`: se abre en el visor del navegador, desde donde se guarda o se imprime. Es lo que el
      // boton promete ("Imprimir HC") y lo mismo que hace el preview del informe.
      "Content-Disposition": `inline; filename="historia-clinica-${id}.pdf"`,
      // NUNCA SE CACHEA: la historia clinica cambia con la consulta, y una copia cacheada seria un
      // documento clinico desactualizado circulando sin que nadie lo sepa.
      "Cache-Control": "no-store",
    },
  });
}
