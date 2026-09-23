import { ENGINE_REQUIRED } from "@/clinical-engine";

import type { ArchivoDeExportacion } from "../validations/archivo";
import { difierenEnUno, normalizarDocumento, normalizarNombre } from "./normalizar";
import { valorParaAtlas } from "./mapeo-de-la-consulta";

// ═══ LA REVISION DEL LOTE, SIN ESCRIBIR NADA (plan de la importacion, sesion 3, 2026-09-22) ═══
//
// Lee el archivo que exporto el profesional y dice, por paciente, lo que el admin necesita saber ANTES de
// importar: si ya existe en Atlas (o se parece a alguien), cuantas consultas trae, quien hizo cada una, si
// tiene la firma del consentimiento, que respuestas no calzan con la encuesta, si la medicion tiene lo que el
// motor y la regla de negocio exigen, y si era menor de edad (o su fecha de nacimiento es imposible).
//
// PURA: recibe el archivo ya validado y lo que Atlas sabe (sus pacientes y su encuesta), y devuelve el
// informe. No toca la base; el candado `importacion-html-revision.test.ts` lo exige.
//
// LA DECISION DE UNIR NO ES DE AQUI (regla dura 18): una coincidencia exacta de documento se informa como
// "ya existe" y el profesional confirma el orden al importar; un parecido NO se une ni se crea: se muestra.
//
// AJUSTADA CON LOS DOS ARCHIVOS REALES DE SANTIAGO (2026-09-22): la cintura y la cadera que el HTML guarda
// aparte, el informe enviado al paciente que viaja en el mismo arreglo de consultas, las opciones de versiones
// viejas de la encuesta, las fechas de nacimiento imposibles y las consultas de otro profesional.

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
  /** Los textos que la pregunta tuvo en versiones anteriores de la encuesta y ya no tiene. */
  opcionesAnteriores?: string[];
};

export type ContextoDeRevision = {
  pacientesAtlas: PacienteDeAtlas[];
  preguntas: PreguntaDeAtlas[];
};

export type Cruce =
  | { tipo: "nuevo" }
  | { tipo: "existe"; pacienteId: string; nombre: string }
  | { tipo: "parecido"; candidatos: { pacienteId: string; documento: string; nombre: string }[] };

export type FuenteDeCircunferencia = "consulta" | "excel_guardado" | "guardado_a_mano";

export type RevisionDeConsulta = {
  fecha: string | null;
  /** Quien la hizo, segun el HTML. */
  profesional: string | null;
  /** Si no la hizo quien exporto el archivo. */
  deOtroProfesional: boolean;
  consentimiento: {
    firmado: boolean;
    nombre: string | null;
    fecha: string | null;
    /** El nombre tecleado no se parece al del paciente ("dsadsads" por "Santiago"): la firma es mas debil. */
    nombreDistinto: boolean;
  };
  respuestasQueNoCalzan: { clave: string; valor: string }[];
  /** Respuestas con el texto de una version anterior de la encuesta: calzan, se reconocen al importar. */
  respuestasDeVersionAnterior: number;
  preguntasSinResponder: number;
  medicion: {
    tiene: boolean;
    faltan: string[];
    /** De donde salio cada circunferencia, cuando no fue de la consulta misma. */
    respaldo: { campo: "cintura" | "cadera"; fuente: FuenteDeCircunferencia }[];
  };
};

export type RevisionDePaciente = {
  documento: string;
  nombre: string;
  fechaNacimiento: string | null;
  menorDeEdad: boolean;
  /** La fecha de nacimiento es posterior a su primera consulta: no es un menor, es un dato imposible. */
  fechaNacimientoImposible: boolean;
  cruce: Cruce;
  consultas: RevisionDeConsulta[];
  /** Los informes que el HTML le envio al paciente. Viajan en el arreglo de consultas y no son consultas. */
  informesEnviados: { fechaConsulta: string | null; fechaEnvio: string | null }[];
  problemas: string[];
};

export type RevisionDelLote = {
  exportadoEn: string;
  /** Quien exporto el archivo, segun la sesion del HTML. */
  exportadoPor: string | null;
  declaracion: { version: string; aceptadaEn: string };
  pacientes: RevisionDePaciente[];
  documentosRepetidosEnElArchivo: string[];
  /** Los profesionales que aparecen como autores de las consultas del archivo. */
  profesionalesDelArchivo: string[];
};

type Consulta = Record<string, unknown>;

const esOtra = (opcion: string) => /^otr[oa]s?$/i.test(opcion.trim());
const tieneOtra = (opciones: string[]) => opciones.some(esOtra);

/**
 * ¿Una respuesta calza con las opciones? "Otra: texto" y "Otras" (el plural que guarda el HTML en P43) calzan
 * si la pregunta tiene "Otra".
 */
function calza(valor: string, opciones: string[]): boolean {
  if (opciones.includes(valor)) return true;
  if (!tieneOtra(opciones)) return false;
  if (esOtra(valor)) return true;
  const i = valor.indexOf(":");
  return i > 0 && esOtra(valor.slice(0, i));
}

function vacia(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function revisarEncuesta(c: Consulta, preguntas: PreguntaDeAtlas[]) {
  const noCalzan: { clave: string; valor: string }[] = [];
  let deVersionAnterior = 0;
  let sinResponder = 0;
  const juzgar = (p: PreguntaDeAtlas, valor: string) => {
    if (calza(valor, p.opciones)) return;
    if ((p.opcionesAnteriores ?? []).includes(valor)) deVersionAnterior++;
    else noCalzan.push({ clave: p.clave, valor });
  };
  for (const p of preguntas) {
    const v = c[p.clave];
    if (vacia(v)) {
      sinResponder++;
      continue;
    }
    if (!p.opciones.length) continue;
    // SE JUZGA LO QUE SE VA A GUARDAR, NO LO QUE VENIA (2026-09-23). Antes esta linea exigia
    // `typeof v === "string"`, asi que una respuesta que llegara como NUMERO no la miraba nadie: pasaba la
    // revision sin aparecer, se guardaba tal cual y solo se supo por Sentry, en produccion, con el patron
    // alimentario. Ahora se normaliza primero con la misma funcion que usa el escritor y se juzga eso: si la
    // traduccion existe, calza; si no existe, sale en la lista de lo que no calza, que es donde debe salir.
    if (p.tipo === "opcion") {
      const valor = valorParaAtlas(p.clave, v);
      if (valor != null) juzgar(p, valor);
    }
    if (p.tipo === "opcion_multiple" && Array.isArray(v)) {
      for (const el of v) if (typeof el === "string") juzgar(p, el);
    }
  }
  return { noCalzan, deVersionAnterior, sinResponder };
}

// `atlasCirc` del HTML (v9 L731): una circunferencia de 20 cm o menos es un ratio colado en el campo, no una
// medida. Devuelve 0 si no sirve.
function circ(v: unknown): number {
  const n = Number(v) || 0;
  return n > 20 ? n : 0;
}

function leerObjeto(texto: string | undefined): Record<string, unknown> {
  if (!texto) return {};
  try {
    const o: unknown = JSON.parse(texto);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Lo que la medicion tiene que traer: los datos del motor y las circunferencias (regla de negocio, las mismas
// que exige el import del XLSX). En el HTML la talla puede venir como `tallaCm`.
//
// LAS CIRCUNFERENCIAS SIGUEN LA CADENA DE SU `_circAnt` (v9 L7513): lo de la consulta, el Excel del Biody
// guardado (`atlas_bis_<doc>`) y lo guardado a mano (`atlas:antro:<doc>`). PERO esas dos ultimas son UNA por
// paciente, no por consulta, y guardan el ultimo valor: solo sirven de respaldo para la consulta MAS RECIENTE.
// Aplicarlas a una consulta vieja le pondria una cintura de otro dia.
function revisarMedicion(
  c: Consulta,
  respaldos: { excel: Record<string, unknown>; aMano: Record<string, unknown> } | null,
): RevisionDeConsulta["medicion"] {
  const num = (k: string) => typeof c[k] === "number" && Number.isFinite(c[k]) && (c[k] as number) !== 0;
  const tiene = ["Re", "Ri", "Rinf", "C", "FM"].some(num);
  if (!tiene) return { tiene: false, faltan: [], respaldo: [] };
  const faltan: string[] = [];
  for (const k of ENGINE_REQUIRED) {
    if (k === "talla" ? !(num("talla") || num("tallaCm")) : !num(k)) faltan.push(k);
  }
  const respaldo: { campo: "cintura" | "cadera"; fuente: FuenteDeCircunferencia }[] = [];
  for (const campo of ["cintura", "cadera"] as const) {
    if (circ(c[campo])) continue;
    if (respaldos && circ(respaldos.excel[campo])) respaldo.push({ campo, fuente: "excel_guardado" });
    else if (respaldos && circ(respaldos.aMano[campo])) respaldo.push({ campo, fuente: "guardado_a_mano" });
    else faltan.push(campo);
  }
  return { tiene, faltan, respaldo };
}

function edadEn(fechaNacimiento: string, fecha: string): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!n || !f) return null;
  if (fechaNacimiento.slice(0, 10) > fecha.slice(0, 10)) return -1; // nacio despues: imposible
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

// ¿El nombre tecleado al firmar es el del paciente? Basta con que uno contenga al otro, normalizados: "NICO"
// firma por "Nico Smoke Completo" y es el mismo; "dsadsads" por "Santiago", no.
function seParecen(firma: string, nombre: string): boolean {
  const a = normalizarNombre(firma);
  const b = normalizarNombre(nombre);
  return a.includes(b) || b.includes(a);
}

/** El nombre de quien exporto, de la sesion del HTML ("atlas:sesion:profesional"). */
function nombreDeLaSesion(sesion: string | null): string | null {
  const o = leerObjeto(sesion ?? undefined);
  return typeof o.nombre === "string" && o.nombre.trim() ? o.nombre.trim() : null;
}

export function revisarLote(archivo: ArchivoDeExportacion, contexto: ContextoDeRevision): RevisionDelLote {
  const exportadoPor = nombreDeLaSesion(archivo.profesional);
  const vistos = new Map<string, number>();
  const profesionales = new Set<string>();

  const pacientes = archivo.pacientes.map((p): RevisionDePaciente => {
    const problemas: string[] = [];
    const clave = normalizarDocumento(p.documento);
    vistos.set(clave, (vistos.get(clave) ?? 0) + 1);

    let entradas: Consulta[] = [];
    if (p.historia == null) {
      problemas.push("El archivo no trae la historia de este paciente.");
    } else {
      try {
        const h: unknown = JSON.parse(p.historia);
        if (Array.isArray(h)) entradas = h.filter((c): c is Consulta => c != null && typeof c === "object");
        else problemas.push("La historia de este paciente no tiene el formato esperado.");
      } catch {
        problemas.push("La historia de este paciente no se pudo leer.");
      }
    }

    // EL INFORME ENVIADO AL PACIENTE NO ES UNA CONSULTA. El HTML lo guarda en el mismo arreglo, con
    // `informePaciente` y sin `fechaConsulta` (es el registro de lo que se le mando, con su resumen). Se
    // separa: contarlo como consulta daba "consulta sin fecha, sin firma, 64 sin responder".
    const informes = entradas.filter((c) => c.informePaciente != null && typeof c.fechaConsulta !== "string");
    const otrasSinFecha = entradas.filter((c) => c.informePaciente == null && typeof c.fechaConsulta !== "string");
    if (otrasSinFecha.length) {
      problemas.push(
        otrasSinFecha.length === 1
          ? "Trae un registro sin fecha de consulta que no es un informe: no se cuenta como consulta."
          : `Trae ${otrasSinFecha.length} registros sin fecha de consulta que no son informes: no se cuentan como consultas.`,
      );
    }
    const consultas = entradas
      .filter((c) => typeof c.fechaConsulta === "string")
      .sort((a, b) => String(a.fechaConsulta).localeCompare(String(b.fechaConsulta)));

    const ultima = consultas[consultas.length - 1] ?? entradas[entradas.length - 1] ?? {};
    const nombre = typeof ultima.nombre === "string" ? ultima.nombre : "";
    const fechaNacimiento = typeof ultima.fechaNac === "string" && ultima.fechaNac ? ultima.fechaNac : null;
    // Menor si lo era en su PRIMERA consulta, que es cuando firmo el consentimiento.
    const primera = typeof consultas[0]?.fechaConsulta === "string" ? (consultas[0].fechaConsulta as string) : null;
    const edadAlFirmar = fechaNacimiento && primera ? edadEn(fechaNacimiento, primera) : null;

    const respaldos = {
      excel: leerObjeto(p.relacionadas[`atlas_bis_${p.documento}`]),
      aMano: leerObjeto(p.relacionadas[`atlas:antro:${p.documento}`]),
    };

    return {
      documento: p.documento,
      nombre,
      fechaNacimiento,
      menorDeEdad: edadAlFirmar != null && edadAlFirmar >= 0 && edadAlFirmar < 18,
      fechaNacimientoImposible: edadAlFirmar != null && edadAlFirmar < 0,
      cruce: cruzar(p.documento, nombre, fechaNacimiento, contexto.pacientesAtlas),
      consultas: consultas.map((c, i) => {
        const encuesta = revisarEncuesta(c, contexto.preguntas);
        const firma = typeof c.firmaNombre === "string" ? c.firmaNombre.trim() : "";
        const autor = typeof c.profesional === "string" && c.profesional.trim() ? c.profesional.trim() : null;
        if (autor) profesionales.add(autor);
        return {
          fecha: c.fechaConsulta as string,
          profesional: autor,
          deOtroProfesional:
            autor != null && exportadoPor != null && normalizarNombre(autor) !== normalizarNombre(exportadoPor),
          consentimiento: {
            firmado: c.consentimientoAceptado === true && firma !== "",
            nombre: firma || null,
            fecha: typeof c.fechaConsentimiento === "string" ? c.fechaConsentimiento : null,
            nombreDistinto: firma !== "" && nombre !== "" && !seParecen(firma, nombre),
          },
          respuestasQueNoCalzan: encuesta.noCalzan,
          respuestasDeVersionAnterior: encuesta.deVersionAnterior,
          preguntasSinResponder: encuesta.sinResponder,
          medicion: revisarMedicion(c, i === consultas.length - 1 ? respaldos : null),
        };
      }),
      informesEnviados: informes.map((c) => {
        const inf = (c.informePaciente ?? {}) as Record<string, unknown>;
        return {
          fechaConsulta: typeof inf.fechaConsulta === "string" ? inf.fechaConsulta : null,
          fechaEnvio: typeof inf.fechaEnvio === "string" ? inf.fechaEnvio : null,
        };
      }),
      problemas,
    };
  });

  return {
    exportadoEn: archivo.exportadoEn,
    exportadoPor,
    declaracion: { version: archivo.declaracion.version, aceptadaEn: archivo.declaracion.aceptadaEn },
    pacientes,
    documentosRepetidosEnElArchivo: archivo.pacientes
      .map((p) => p.documento)
      .filter((d) => (vistos.get(normalizarDocumento(d)) ?? 0) > 1),
    profesionalesDelArchivo: [...profesionales].sort((a, b) => a.localeCompare(b, "es")),
  };
}
