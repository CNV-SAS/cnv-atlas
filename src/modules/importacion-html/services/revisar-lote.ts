import { ENGINE_REQUIRED } from "@/clinical-engine";

import type { ArchivoDeExportacion } from "../validations/archivo";
import { difierenEnUno, normalizarDocumento, normalizarNombre } from "./normalizar";

// ═══ LA REVISION DEL LOTE, SIN ESCRIBIR NADA (plan de la importacion, sesion 3, 2026-09-22) ═══
//
// Lee el archivo que exporto el profesional y dice, por paciente, lo que el admin necesita saber ANTES de
// importar: si ya existe en Atlas (o se parece a alguien), cuantas consultas trae, si cada una tiene la firma
// del consentimiento, que respuestas no calzan con la encuesta de hoy, si la medicion tiene lo que el motor y
// la regla de negocio exigen, y si era menor de edad.
//
// PURA: recibe el archivo ya validado y lo que Atlas sabe (sus pacientes y su encuesta), y devuelve el
// informe. No toca la base; el candado `importacion-html-revision.test.ts` lo exige.
//
// LA DECISION DE UNIR NO ES DE AQUI (regla dura 18): una coincidencia exacta de documento se informa como
// "ya existe" y el profesional confirma el orden al importar; un parecido NO se une ni se crea: se muestra.

export type PacienteDeAtlas = {
  id: string;
  documento: string;
  nombre: string;
  fechaNacimiento: string | null;
};

export type PreguntaDeAtlas = {
  clave: string;
  tipo: string; // texto | numero | opcion | opcion_multiple
  opciones: string[];
};

export type ContextoDeRevision = {
  pacientesAtlas: PacienteDeAtlas[];
  preguntas: PreguntaDeAtlas[];
};

export type Cruce =
  | { tipo: "nuevo" }
  | { tipo: "existe"; pacienteId: string; nombre: string }
  | { tipo: "parecido"; candidatos: { pacienteId: string; documento: string; nombre: string }[] };

export type RevisionDeConsulta = {
  fecha: string | null;
  consentimiento: { firmado: boolean; nombre: string | null; fecha: string | null };
  respuestasQueNoCalzan: { clave: string; valor: string }[];
  preguntasSinResponder: number;
  medicion: { tiene: boolean; faltan: string[] };
};

export type RevisionDePaciente = {
  documento: string;
  nombre: string;
  fechaNacimiento: string | null;
  menorDeEdad: boolean;
  cruce: Cruce;
  consultas: RevisionDeConsulta[];
  problemas: string[];
};

export type RevisionDelLote = {
  exportadoEn: string;
  declaracion: { version: string; aceptadaEn: string };
  pacientes: RevisionDePaciente[];
  documentosRepetidosEnElArchivo: string[];
};

type Consulta = Record<string, unknown>;

const esOtra = (opcion: string) => /^otr[oa]s?$/i.test(opcion.trim());

/** ¿Una respuesta calza con las opciones de la pregunta de hoy? "Otra: texto" calza si la pregunta tiene "Otra". */
function calza(valor: string, opciones: string[]): boolean {
  if (opciones.includes(valor)) return true;
  const i = valor.indexOf(":");
  return i > 0 && opciones.some((o) => esOtra(o) && o.trim().toLowerCase() === valor.slice(0, i).trim().toLowerCase());
}

function vacia(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function revisarEncuesta(c: Consulta, preguntas: PreguntaDeAtlas[]) {
  const noCalzan: { clave: string; valor: string }[] = [];
  let sinResponder = 0;
  for (const p of preguntas) {
    const v = c[p.clave];
    if (vacia(v)) {
      sinResponder++;
      continue;
    }
    if (p.tipo === "opcion" && typeof v === "string" && p.opciones.length && !calza(v, p.opciones)) {
      noCalzan.push({ clave: p.clave, valor: v });
    }
    if (p.tipo === "opcion_multiple" && Array.isArray(v) && p.opciones.length) {
      for (const el of v) {
        if (typeof el === "string" && !calza(el, p.opciones)) noCalzan.push({ clave: p.clave, valor: el });
      }
    }
  }
  return { noCalzan, sinResponder };
}

// Lo que la medicion tiene que traer: los datos del motor y las circunferencias (regla de negocio, las mismas
// que exige el import del XLSX). En el HTML la talla puede venir como `tallaCm`.
function revisarMedicion(c: Consulta): { tiene: boolean; faltan: string[] } {
  const num = (k: string) => typeof c[k] === "number" && Number.isFinite(c[k]) && (c[k] as number) !== 0;
  const tiene = ["Re", "Ri", "Rinf", "C", "FM"].some(num);
  if (!tiene) return { tiene: false, faltan: [] };
  const faltan: string[] = [];
  for (const k of ENGINE_REQUIRED) {
    if (k === "talla" ? !(num("talla") || num("tallaCm")) : !num(k)) faltan.push(k);
  }
  if (!num("cintura")) faltan.push("cintura");
  if (!num("cadera")) faltan.push("cadera");
  return { tiene, faltan };
}

function edadEn(fechaNacimiento: string, fecha: string): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!n || !f) return null;
  let edad = Number(f[1]) - Number(n[1]);
  if (Number(f[2]) < Number(n[2]) || (f[2] === n[2] && Number(f[3]) < Number(n[3]))) edad--;
  return edad;
}

function cruzar(doc: string, nombre: string, nacimiento: string | null, atlas: PacienteDeAtlas[]): Cruce {
  const d = normalizarDocumento(doc);
  const exacto = atlas.find((p) => normalizarDocumento(p.documento) === d);
  if (exacto) return { tipo: "existe", pacienteId: exacto.id, nombre: exacto.nombre };
  const n = normalizarNombre(nombre);
  const candidatos = atlas
    .filter(
      (p) =>
        difierenEnUno(normalizarDocumento(p.documento), d) ||
        (n !== "" && normalizarNombre(p.nombre) === n && nacimiento != null && p.fechaNacimiento === nacimiento),
    )
    .map((p) => ({ pacienteId: p.id, documento: p.documento, nombre: p.nombre }));
  return candidatos.length ? { tipo: "parecido", candidatos } : { tipo: "nuevo" };
}

export function revisarLote(archivo: ArchivoDeExportacion, contexto: ContextoDeRevision): RevisionDelLote {
  const vistos = new Map<string, number>();
  const pacientes = archivo.pacientes.map((p): RevisionDePaciente => {
    const problemas: string[] = [];
    const clave = normalizarDocumento(p.documento);
    vistos.set(clave, (vistos.get(clave) ?? 0) + 1);

    let consultas: Consulta[] = [];
    if (p.historia == null) {
      problemas.push("El archivo no trae la historia de este paciente.");
    } else {
      try {
        const h: unknown = JSON.parse(p.historia);
        if (Array.isArray(h)) consultas = h.filter((c): c is Consulta => c != null && typeof c === "object");
        else problemas.push("La historia de este paciente no tiene el formato esperado.");
      } catch {
        problemas.push("La historia de este paciente no se pudo leer.");
      }
    }

    const ordenadas = [...consultas].sort((a, b) =>
      String(a.fechaConsulta ?? "").localeCompare(String(b.fechaConsulta ?? "")),
    );
    const ultima = ordenadas[ordenadas.length - 1] ?? {};
    const nombre = typeof ultima.nombre === "string" ? ultima.nombre : "";
    const fechaNacimiento = typeof ultima.fechaNac === "string" && ultima.fechaNac ? ultima.fechaNac : null;
    // Menor si lo era en su PRIMERA consulta, que es cuando firmo el consentimiento.
    const primera = typeof ordenadas[0]?.fechaConsulta === "string" ? (ordenadas[0].fechaConsulta as string) : null;
    const edadAlFirmar = fechaNacimiento && primera ? edadEn(fechaNacimiento, primera) : null;

    return {
      documento: p.documento,
      nombre,
      fechaNacimiento,
      menorDeEdad: edadAlFirmar != null && edadAlFirmar < 18,
      cruce: cruzar(p.documento, nombre, fechaNacimiento, contexto.pacientesAtlas),
      consultas: ordenadas.map((c) => {
        const encuesta = revisarEncuesta(c, contexto.preguntas);
        const firma = typeof c.firmaNombre === "string" ? c.firmaNombre.trim() : "";
        return {
          fecha: typeof c.fechaConsulta === "string" ? c.fechaConsulta : null,
          consentimiento: {
            firmado: c.consentimientoAceptado === true && firma !== "",
            nombre: firma || null,
            fecha: typeof c.fechaConsentimiento === "string" ? c.fechaConsentimiento : null,
          },
          respuestasQueNoCalzan: encuesta.noCalzan,
          preguntasSinResponder: encuesta.sinResponder,
          medicion: revisarMedicion(c),
        };
      }),
      problemas,
    };
  });

  return {
    exportadoEn: archivo.exportadoEn,
    declaracion: { version: archivo.declaracion.version, aceptadaEn: archivo.declaracion.aceptadaEn },
    pacientes,
    documentosRepetidosEnElArchivo: archivo.pacientes
      .map((p) => p.documento)
      .filter((d) => (vistos.get(normalizarDocumento(d)) ?? 0) > 1),
  };
}
