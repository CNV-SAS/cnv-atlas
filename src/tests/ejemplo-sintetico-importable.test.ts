import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PATRON_FIELD_KEYS, resolvePatron } from "@/clinical-engine";
import { respuestasDeLaConsulta } from "@/modules/importacion-html/services/mapeo-de-la-consulta";
import { revisarLote } from "@/modules/importacion-html/services/revisar-lote";
import { archivoDeExportacionSchema } from "@/modules/importacion-html/validations/archivo";

// ═══ EL ARCHIVO QUE SE DISTRIBUYE TIENE QUE SER IMPORTABLE (2026-09-23) ═══
//
// El smoke de Santiago fallo en el paso 3 y la mitad de la culpa fue de ESTE archivo: no traia FFM, asi que
// no probaba el camino feliz, probaba otro. Y no lo probaba ningun test, porque los tests de la importacion
// usan sus propios fixtures, no el archivo que se manda.
//
// Asi que el candado corre sobre el archivo REAL, el que se distribuye: si alguien lo regenera y sale
// incompleto, se entera aqui y no en el smoke.

const RUTA = "docs/distribucion/exportador-html/ejemplo-sintetico.json";

const CONTEXTO = {
  pacientesAtlas: [],
  // Sin catalogo de preguntas: lo que se prueba aqui es la MEDICION y el patron, no el calce de opciones
  // (eso ya lo prueba `importacion-html-revision`).
  preguntas: [],
};

describe("el ejemplo sintético que se distribuye", () => {
  const crudo: unknown = JSON.parse(readFileSync(RUTA, "utf8"));

  it("es un archivo de exportación válido", () => {
    expect(archivoDeExportacionSchema.safeParse(crudo).success).toBe(true);
  });

  it("sus mediciones traen TODO lo que el motor exige (era lo que faltaba: FFM)", () => {
    const revision = revisarLote(archivoDeExportacionSchema.parse(crudo), CONTEXTO);
    const conMedicion = revision.pacientes
      .flatMap((p) => p.consultas)
      .filter((c) => c.medicion.tiene);
    expect(conMedicion.length, "el ejemplo no trae ninguna medición").toBeGreaterThan(0);
    for (const c of conMedicion) {
      // La cintura puede faltar a proposito (es el caso que el smoke ejercita); los insumos del motor, no.
      const delMotor = c.medicion.faltan.filter((f) => f !== "cintura" && f !== "cadera");
      expect(delMotor, `a la consulta del ${c.fecha} le faltan insumos del motor`).toEqual([]);
    }
  });

  it("y su patrón alimentario se puede leer después de importarlo", () => {
    const archivo = archivoDeExportacionSchema.parse(crudo);
    let ejercitadas = 0;
    for (const paciente of archivo.pacientes) {
      const consultas: unknown = JSON.parse(paciente.historia ?? "[]");
      if (!Array.isArray(consultas)) continue;
      for (const consulta of consultas) {
        const filas = respuestasDeLaConsulta(consulta as Record<string, unknown>, PATRON_FIELD_KEYS);
        if (filas.length === 0) continue;
        ejercitadas++;
        const resolucion = resolvePatron(
          [...PATRON_FIELD_KEYS],
          filas.map((f) => ({ fieldKey: f.clave, answerValue: f.valor })),
        );
        expect(resolucion.status).not.toBe("ilegible");
      }
    }
    // SIN ESTA LINEA EL CASO PASABA EN VACIO, y asi estaba: el ejemplo no traia ninguna respuesta del patron,
    // de modo que el smoke jamas habria tocado el defecto que salio en produccion. Un caso que no ejercita
    // nada pasa siempre.
    expect(ejercitadas, "el ejemplo no trae ninguna respuesta del patrón: el caso no probaría nada").toBeGreaterThan(0);
  });
});
