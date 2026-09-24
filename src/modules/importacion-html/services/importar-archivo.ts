import "server-only";

import { createHash } from "node:crypto";

import { appError, err, ok, type Result } from "@/core/errors";

import { leerDestinoDeImportacion } from "../data/contexto-reader";
import {
  importarLote,
  type ImportarLoteResultado,
  type PacienteParaImportar,
} from "../data/importar-lote-writer";
import { archivoDeExportacionSchema, TAMANO_MAXIMO_ARCHIVO } from "../validations/archivo";
import type { ConsultaDelHtml } from "./mapeo-de-la-consulta";

// Orquesta la importacion de un archivo exportado del HTML (sesion 4): valida igual que la revision, arma las
// consultas de cada paciente y llama al escritor, que hace TODO en una transaccion.
//
// LO QUE SE DESCARTA AQUI, antes de escribir: las entradas del historial que NO son consultas (el informe que
// el HTML envio al paciente, que no se importa, y cualquier registro sin fecha de consulta).

function objeto(texto: string | undefined): Record<string, unknown> {
  if (!texto) return {};
  try {
    const o: unknown = JSON.parse(texto);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function importarArchivo(input: {
  archivo: File;
  professionalId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<Result<ImportarLoteResultado>> {
  if (input.archivo.size === 0) return err(appError("validation", "El archivo está vacío."));
  if (input.archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    return err(appError("validation", "El archivo supera el tamaño máximo permitido (25 MB)."));
  }
  const texto = await input.archivo.text();
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return err(appError("validation", "El archivo no es una exportación del HTML: no se pudo leer como JSON."));
  }
  const validado = archivoDeExportacionSchema.safeParse(crudo);
  if (!validado.success) {
    return err(appError("validation", "El archivo no tiene el formato del exportador del HTML (versión 1)."));
  }
  const destino = await leerDestinoDeImportacion(input.professionalId);
  if (!destino) {
    return err(appError("validation", "No se pudo resolver la cuenta del profesional o la encuesta vigente."));
  }

  const pacientes: PacienteParaImportar[] = [];
  for (const p of validado.data.pacientes) {
    let entradas: ConsultaDelHtml[] = [];
    try {
      const h: unknown = JSON.parse(p.historia ?? "[]");
      if (Array.isArray(h)) entradas = h.filter((c): c is ConsultaDelHtml => c != null && typeof c === "object");
    } catch {
      entradas = [];
    }
    const consultas = entradas
      .filter((c) => typeof c.fechaConsulta === "string" && c.fechaConsulta)
      .sort((a, b) => String(a.fechaConsulta).localeCompare(String(b.fechaConsulta)));
    if (consultas.length === 0) continue;
    const respaldos = {
      excel: objeto(p.relacionadas[`atlas_bis_${p.documento}`]),
      aMano: objeto(p.relacionadas[`atlas:antro:${p.documento}`]),
    };
    const ultima = consultas[consultas.length - 1];
    pacientes.push({
      documento: p.documento,
      nombre: typeof ultima.nombre === "string" ? ultima.nombre : "",
      consultas: consultas.map((c) => ({
        fecha: String(c.fechaConsulta).slice(0, 10),
        consulta: c,
        // El Excel guardado y lo guardado a mano son UNO por paciente: solo respaldan su consulta mas
        // reciente (la cadena de su `_circAnt`).
        respaldos: c === ultima ? respaldos : undefined,
      })),
    });
  }
  if (pacientes.length === 0) {
    return err(appError("validation", "El archivo no trae ninguna consulta con fecha: no hay nada que importar."));
  }

  const resultado = await importarLote({
    organizationId: destino.organizationId,
    professionalId: input.professionalId,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    ip: input.ip,
    archivo: { nombre: input.archivo.name, hash: createHash("sha256").update(texto, "utf8").digest("hex") },
    declaracion: {
      version: validado.data.declaracion.version,
      aceptadaEn: validado.data.declaracion.aceptadaEn,
    },
    surveyVersionId: destino.surveyVersionId,
    bisConditionVersionId: destino.bisConditionVersionId,
    preguntasPorClave: destino.preguntasPorClave,
    pacientes,
  });
  return ok(resultado);
}
