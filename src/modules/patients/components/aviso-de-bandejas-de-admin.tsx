import Link from "next/link";

import type { CurrentUser } from "@/modules/auth/roles";
import { leerHuellasConfirmadas } from "@/modules/bis/data/huellas-confirmadas-reader";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";

import { propuestasDePruebaPendientes } from "../data/de-prueba-writer";
import { peticionesDeEliminacionPendientes } from "../data/eliminacion-del-paciente-writer";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS BANDEJAS DE ADMINISTRACION, VISIBLES DESDE CUALQUIER PANTALLA  ·  2026-11-05
//
// ═══ EL CASO (Santiago) ═══
//
// *"Pedí una eliminación y no la encuentro. Que se vea en el menú de admin con el número de pendientes."*
//
// Y la peticion SI estaba: verificado en produccion, una pendiente del 5 de noviembre. O sea que el
// defecto no era que no se registrara, era que **no habia forma de enterarse**: las tres bandejas de
// /admin solo se pintan cuando tienen algo (correcto, una seccion vacia permanente entrena a no mirarla)
// y estan al pie de una pagina larga. Quien pide una eliminacion no sabe que tiene que entrar a /admin y
// bajar.
//
// ES LA MISMA FORMA DE LA "pieza terminada sin el ultimo cable": el acto se registra, la bandeja existe,
// la resolucion funciona, y nadie se entera de que hay algo que resolver.
//
// ═══ POR QUE UNA FRANJA Y NO UN NUMERO EN EL MENU ═══
//
// Lo pidio "en el menu", y la franja hace mas: la barra lateral se pliega (y en el movil no se ve), asi
// que un numero ahi se esconde justo cuando mas falta. La franja va arriba, en CUALQUIER pantalla, con el
// enlace al sitio. Es el mismo patron que `AvisoDePendientes` ya usa para los pendientes de ventas, que
// nacio del mismo problema y funciona.
//
// Y DICE EL NUMERO Y DE QUE ES, no "tienes pendientes": tres bandejas distintas con tres actos distintos
// (confirmar que un paciente es de prueba, eliminar un perfil, revisar una medicion importada sobre otra
// historia), y un aviso que no las distingue obliga a entrar para saber si corre prisa.
//
// ═══ NI UN NOMBRE DE PACIENTE EN LA FRANJA ═══
//
// Solo conteos. La franja sale en cualquier pantalla y la puede ver quien comparte el escritorio; el
// nombre y el documento viven en /admin, donde el acto se resuelve.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
export async function AvisoDeBandejasDeAdmin({ user }: { user: CurrentUser }) {
  if (!canAccessAdmin(user)) return null;

  const [eliminaciones, propuestas, huellas] = await Promise.all([
    peticionesDeEliminacionPendientes(),
    propuestasDePruebaPendientes(),
    leerHuellasConfirmadas(),
  ]);

  const partes: string[] = [];
  if (eliminaciones.length > 0) {
    partes.push(
      `${eliminaciones.length} petición${eliminaciones.length === 1 ? "" : "es"} de eliminar un perfil`,
    );
  }
  if (propuestas.length > 0) {
    partes.push(
      `${propuestas.length} paciente${propuestas.length === 1 ? "" : "s"} propuesto${propuestas.length === 1 ? "" : "s"} como de prueba`,
    );
  }
  if (huellas.length > 0) {
    partes.push(
      `${huellas.length} medición${huellas.length === 1 ? "" : "es"} importada${huellas.length === 1 ? "" : "s"} sobre otra historia`,
    );
  }
  if (partes.length === 0) return null;

  return (
    <div className="border-b border-attention/30 bg-attention-bg px-4 py-2 text-sm text-attention">
      {partes.join(" · ")}.{" "}
      <Link href="/admin" className="font-medium underline underline-offset-4">
        Resolver en Administración
      </Link>
    </div>
  );
}
