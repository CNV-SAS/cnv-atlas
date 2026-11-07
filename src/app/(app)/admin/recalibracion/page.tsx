import { redirect } from "next/navigation";

import { ENGINE_VERSION } from "@/clinical-engine";
import { requireUser } from "@/modules/auth/session";
import { informesSinCapasCongeladas } from "@/modules/clinical-pipeline/data/capas-congeladas-reader";
import { evaluacionesDesfasadas } from "@/modules/clinical-pipeline/data/desfasadas-reader";
import { canReemitDiagnosis } from "@/modules/clinical-pipeline/policies/can-reemit-diagnosis";

import { PanelDeRecalibracion } from "./panel-de-recalibracion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// RECALIBRACION CIENTIFICA  ·  reemitir los diagnosticos que quedaron en una version anterior
//
// ═══ POR QUE ESTA PANTALLA EXISTE, Y POR QUE NO ES UN SCRIPT ═══
//
// Reemitir escribe registros clinicos: necesita un ACTOR autenticado (el rastro registra quien reemitio),
// autorizacion por policy (regla 3) y la IP. Un script con la service role pasaria por encima de las tres
// y firmaria el acto con un correo pasado por bandera.
//
// Y HAY UNA RAZON TECNICA ADEMAS: ningun script de node puede importar un servicio nuestro. `server-only`
// no es un paquete instalado (lo resuelve el bundler de Next) y el alias `@/` no lo resuelve node. Los
// scripts de `scripts/` corren porque son `.mjs` con supabase-js: no importan la app.
//
// ═══ NO LLEVA UN SOLO DATO DE PACIENTE ═══
//
// Ni nombre, ni documento, ni cifras. Solo el id de la evaluacion, con que version esta sellada y de
// cuando es. Es una operacion sobre el historico, no una lista de personas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// LAS TANDAS SON LARGAS: una invocacion por tanda, y cada fila son varias idas a la base. El tope por
// defecto de una funcion (60 s) alcanzaba para las tandas de 50 de la reemision, pero sin margen declarado;
// 300 es el mismo tope que ya lleva `importar-html`, que es la otra operacion masiva de administracion.
export const maxDuration = 300;

export default async function RecalibracionPage() {
  const user = await requireUser();
  if (!canReemitDiagnosis(user)) redirect("/");

  const desfasadas = await evaluacionesDesfasadas();
  // LOS INFORMES REEMITIDOS A LOS QUE LES FALTA UNA CAPA CONGELADA (2026-11-07). Es la reparacion de un
  // defecto nuestro, no una operacion de rutina: cuando la cifra sea 0, el bloque desaparece solo.
  const sinCapas = await informesSinCapasCongeladas();

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Recalibración científica</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Reemite el diagnóstico de las evaluaciones que quedaron selladas con una versión anterior del
          motor. Crea una versión nueva del diagnóstico y deja intactos{" "}
          <strong>el tratamiento y los informes ya enviados</strong>.
        </p>
        <p className="text-sm text-muted-foreground">
          Motor vigente: <span className="font-medium text-foreground">{ENGINE_VERSION}</span>
        </p>
      </header>
      <PanelDeRecalibracion desfasadas={desfasadas} sinCapas={sinCapas} />
    </div>
  );
}
