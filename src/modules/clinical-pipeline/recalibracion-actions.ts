"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { canReemitDiagnosis } from "./policies/can-reemit-diagnosis";
import { completarCapasCongeladas } from "./services/completar-capas-congeladas";
import { reemitirDiagnostico } from "./services/reemitir-diagnostico";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ACTIONS DE LA RECALIBRACION  ·  thin (regla 2): autoriza por policy, valida con Zod, delega
//
// ═══ POR QUE ESTO ES UNA ACTION Y NO UN SCRIPT, y vale dejarlo escrito ═══
//
// El primer intento fue un script de node, y NO PUEDE FUNCIONAR: `server-only` no es un paquete
// instalado (lo resuelve el bundler de Next) y el alias `@/` no lo resuelve node. O sea que ningun
// script fuera del runner de tests puede importar un servicio nuestro. Los demas scripts de `scripts/`
// corren porque son `.mjs` con supabase-js y rutas relativas: no importan la app.
//
// Y AL BUSCAR COMO ARREGLARLO SALIO QUE EL SCRIPT ERA LA FORMA EQUIVOCADA. Esto escribe registros
// clinicos: necesita un ACTOR autenticado (el rastro registra quien reemitio), autorizacion por policy
// (regla 3) y la IP. Un script con la service role habria pasado por encima de las tres cosas, y habria
// firmado el acto con un correo pasado por bandera en la linea de comandos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const reemitirSchema = z.object({
  // Las evaluaciones a reemitir. Tope de 50 por tanda: una tanda mas grande se parte, para que un fallo
  // a la mitad deje un tramo revisable y no un estado difuso sobre 351 registros clinicos.
  evaluationIds: z.array(z.guid()).min(1).max(50),
  confirmado: z.literal(true),
});

export type ReemitirActionState = {
  error: string | null;
  // Una linea por evaluacion, en el orden en que se corrieron. La UI las pinta tal cual.
  resultados: { evaluationId: string; estado: "hecha" | "saltada" | "fallo"; detalle: string }[];
};

export async function reemitirDiagnosticosAction(
  input: unknown,
): Promise<ReemitirActionState> {
  const user = await requireUser();
  if (!canReemitDiagnosis(user)) {
    return { error: "No tienes permiso para reemitir diagnósticos.", resultados: [] };
  }
  const parsed = reemitirSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "La lista de evaluaciones no es válida, o falta confirmar la operación.",
      resultados: [],
    };
  }

  const ip = await getClientIp();
  const resultados: ReemitirActionState["resultados"] = [];

  // EN SERIE Y NO EN PARALELO, a proposito: cada reemision es su propia transaccion y una tanda no es un
  // acto. En paralelo, un fallo dejaria un conjunto indeterminado de transacciones a medio camino y el
  // orden del informe no diria nada sobre donde se corto.
  for (const evaluationId of parsed.data.evaluationIds) {
    const r = await reemitirDiagnostico({
      evaluationId,
      motivo: "recalibracion_ciencia",
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    if (r.ok) {
      resultados.push({
        evaluationId,
        estado: "hecha",
        detalle: `${r.value.versionAnterior} → ${r.value.versionNueva}`,
      });
      continue;
    }
    // "SALTADA" Y "FALLO" SE DISTINGUEN, y no es cosmetico: saltada es que ya estaba al dia (esperado, y
    // lo que hace la tanda repetible sin duplicar nada); fallo es que algo no se pudo hacer y hay que
    // mirarlo. Juntarlas en "no se hizo" obligaria a revisar 300 lineas para encontrar las dos que
    // importan.
    const yaEstaba = r.error.message.includes("no hay nada que reemitir");
    resultados.push({
      evaluationId,
      estado: yaEstaba ? "saltada" : "fallo",
      detalle: r.error.message,
    });
  }

  revalidatePath("/admin/recalibracion");
  return { error: null, resultados };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COMPLETAR LAS CAPAS CONGELADAS QUE LA REEMISION NO ESCRIBIO  ·  2026-11-07
//
// La reparacion de un defecto nuestro: 424 informes reemitidos salieron sin `rutasContent`, `efrContent`
// ni `validityCaveats`, y cinco superficies quedaron vacias sin que nada fallara. El porque de cada
// guarda vive en el servicio; aqui va la misma forma que la otra action (policy, Zod, tope, en serie),
// por la misma razon: una tanda grande que falla a la mitad deja un estado que nadie puede reanudar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const completarSchema = z.object({
  reportIds: z.array(z.guid()).min(1).max(50),
  confirmado: z.literal(true),
});

export type CompletarCapasActionState = {
  error: string | null;
  resultados: { reportId: string; estado: "hecha" | "saltada" | "fallo"; detalle: string }[];
};

export async function completarCapasCongeladasAction(
  input: unknown,
): Promise<CompletarCapasActionState> {
  const user = await requireUser();
  if (!canReemitDiagnosis(user)) {
    return { error: "No tienes permiso para esta operación.", resultados: [] };
  }
  const parsed = completarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "La lista de informes no es válida, o falta confirmar la operación.",
      resultados: [],
    };
  }

  const ip = await getClientIp();
  const resultados: CompletarCapasActionState["resultados"] = [];

  for (const reportId of parsed.data.reportIds) {
    const r = await completarCapasCongeladas({
      reportId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    if (r.ok) {
      resultados.push({
        reportId,
        estado: "hecha",
        detalle: `se escribieron: ${r.value.escritas.join(", ")}`,
      });
      continue;
    }
    // "SALTADA" ES LA QUE YA ESTABA COMPLETA, y es lo que hace la tanda repetible sin ruido.
    const yaEstaba = r.error.message.includes("no hay nada que completar");
    resultados.push({
      reportId,
      estado: yaEstaba ? "saltada" : "fallo",
      detalle: r.error.message,
    });
  }

  revalidatePath("/admin/recalibracion");
  return { error: null, resultados };
}
