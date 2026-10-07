import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { claseDeEvaluacion } from "@/modules/patients/clasificar-evaluaciones";
import { accionDeEvaluacion, pendienteDelPaciente } from "@/modules/patients/pendientes";

// ═══ EL BARRIDO DE "ESTA CONSULTA NO OCURRIO" (0212, Santiago 2026-10-07) ═══
//
// ── EL DEFECTO QUE LO MOTIVA, DICHO POR SANTIAGO ───────────────────────────────────────────────────
//
// *"Ya vi el boton, la marque pero lo unico que se hace es ocultarla. Ademas, en el listado de pacientes,
// cuando selecciono un paciente y aparecen las 3 evaluaciones mas recientes, aun aparece las que estan
// ocultas."*
//
// Y TENIA RAZON: el retiro se escribio en la BD, la FICHA del paciente lo respetaba, y ninguna otra pantalla
// se habia enterado. Dos pantallas diciendo cosas distintas de la misma consulta, que es el defecto que mas
// nos ha costado este mes, y de la misma familia que el paciente de prueba y la venta de prueba: **marcar
// solo excluye donde alguien escribio que excluya**.
//
// ── POR QUE ESTE CANDADO MIRA EL CODIGO FUENTE ────────────────────────────────────────────────────
//
// Porque lo que hay que vigilar es una AUSENCIA en una lectura que todavia no existe. Un test de
// comportamiento solo cubre las pantallas de hoy; este truena cuando alguien escriba una lectura NUEVA de
// `evaluations` y se le olvide el filtro, que es exactamente como se perdio la primera vez.
//
// Y LA LISTA DE EXENCIONES ES EL DOCUMENTO: cada lectura que NO filtra dice por que. Una exencion sin razon
// es un olvido con permiso.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Todos los `**\/data/*.ts` bajo una raiz, con rutas relativas y separador `/` (tambien en Windows). */
function archivosDeDatos(desde: string): string[] {
  const salida: string[] = [];
  const recorrer = (rel: string) => {
    for (const entrada of readdirSync(join(raiz, rel), { withFileTypes: true })) {
      const hijo = `${rel}/${entrada.name}`;
      if (entrada.isDirectory()) recorrer(hijo);
      else if (rel.endsWith("/data") && entrada.name.endsWith(".ts")) salida.push(hijo);
    }
  };
  recorrer(desde);
  return salida;
}

// ── LAS QUE TIENEN QUE FILTRAR: miran VARIAS evaluaciones (colas de trabajo, conteos, trayectoria) ──
const DEBEN_FILTRAR = [
  "src/modules/patients/data/patients-list-reader.ts",
  "src/modules/patients/data/patient-detail-reader.ts",
  "src/modules/patients/data/buscar-por-documento.ts",
  "src/modules/dashboard/data/tablero-reader.ts",
  "src/modules/clinical-pipeline/data/pipeline-evaluations-reader.ts",
  "src/modules/bis/data/bis-evaluations-reader.ts",
  "src/modules/evaluations/data/evaluations-repository.ts",
  "src/modules/evaluations/data/pending-resume-reader.ts",
  // LO ENCONTRO ESTE BARRIDO, no yo: `intake-writer` REUSA el cascaron pendiente mas reciente, asi que sin
  // el filtro un paciente que volviera a entrar habria resucitado la consulta retirada con sus respuestas
  // nuevas dentro. Era el unico sitio donde el retiro se podia deshacer SIN QUE NADIE LO DECIDIERA.
  "src/modules/evaluations/data/intake-writer.ts",
  "src/modules/followups/data/comparison-reader.ts",
  "src/modules/followups/data/trajectory-notice-reader.ts",
  "src/modules/reports/data/serie-del-paciente.ts",
];

// ── LAS EXENTAS, CADA UNA CON SU RAZON ────────────────────────────────────────────────────────────
//
// DOS RAZONES VALIDAS, y solo dos:
//
//   · POR EVALUACION. La lectura recibe un `evaluationId` y devuelve lo de ESA consulta. Ahi el retiro no
//     tiene nada que filtrar: si el profesional abrio una consulta retirada, lo correcto es mostrarsela
//     (con su marca), no vaciarle la pantalla. Nada se borra.
//   · PASA POR `reports`. Un reporte exige diagnostico, y el trigger `evaluacion_no_se_retira_con_diagnostico`
//     impide retirar una evaluacion que ya tenga uno. Asi que una retirada NO PUEDE tener reporte, y la
//     lectura la excluye por construccion. Si algun dia el trigger se relaja, esta razon caduca.
const EXENTAS: Record<string, string> = {
  "src/modules/bis-intake/data/bis-conditions-reader.ts": "por evaluacion",
  "src/modules/diagnoses/data/celular-badges-reader.ts": "por evaluacion",
  "src/modules/diagnoses/data/criterion-input-reader.ts": "por evaluacion",
  "src/modules/diagnoses/data/results-reader.ts": "por evaluacion",
  "src/modules/evaluations/data/consent-status-reader.ts": "por evaluacion",
  "src/modules/followups/data/proximo-control-reader.ts": "por evaluacion",
  "src/modules/followups/data/serie-reader.ts": "pasa por reports",
  "src/modules/payments/data/payments-repository.ts": "por evaluacion (treatment -> diagnosis -> evaluation)",
  "src/modules/reports/data/hc-entregas-writer.ts": "por evaluacion",
  "src/modules/reports/data/hc-header-reader.ts": "por evaluacion",
  "src/modules/reports/data/plan-paciente-reader.ts": "por evaluacion",
  "src/modules/treatment/data/dieta-resumen-reader.ts": "por evaluacion",
  "src/modules/treatment/data/medico-ejercicio-treatment-reader.ts": "por evaluacion",
  "src/modules/treatment/data/treatment-reader.ts": "por evaluacion",
  // CONTABILIDAD DEL LOTE, no cifra clinica: la revision del import dice que CREO ese archivo, y una
  // evaluacion retirada despues se importo igual. Taparla aqui descuadraria el conteo del lote con lo que
  // de verdad entro, que es justo lo que esa pantalla existe para auditar.
  "src/modules/importacion-html/data/contexto-reader.ts": "contabilidad del lote importado",
};

describe("la regla pura: una consulta que no ocurrio no pide trabajo ni cuenta", () => {
  it("no genera ningun pendiente, en CUALQUIER estado", () => {
    // EN CUALQUIER ESTADO, y por eso se prueba el peor: la del caso real estaba `in_progress` con 63
    // respuestas, o sea en el escalon que mas fuerte pide trabajo ("Montar BIS").
    const enCurso = {
      evaluationId: "e1",
      status: "in_progress",
      tieneBis: false,
      tieneDiagnostico: false,
      reporte: null,
    };
    expect(accionDeEvaluacion(enCurso)).not.toBeNull();
    expect(accionDeEvaluacion({ ...enCurso, noOcurrio: true })).toBeNull();

    // Y tampoco a traves del paciente: si su UNICA evaluacion esta retirada, no queda pendiente ninguno.
    const r = pendienteDelPaciente([{ ...enCurso, noOcurrio: true }], false);
    expect(r.principal).toBeNull();
  });

  it("se pliega en el historial, tambien estando abierta", () => {
    expect(claseDeEvaluacion({ status: "in_progress", superseded: false, noOcurrio: true })).toBe("retirada");
    // Sin la marca, la misma evaluacion es trabajo pendiente: el contraste es lo que prueba que la marca
    // es lo que decide, y no el estado.
    expect(claseDeEvaluacion({ status: "in_progress", superseded: false })).toBe("abierta");
  });
});

describe("ninguna lectura de evaluaciones se olvida del retiro", () => {
  it.each(DEBEN_FILTRAR)("%s mira la columna del retiro", (ruta) => {
    // LAS DOS GRAFIAS: PostgREST la nombra `retirada_at` y Drizzle `retiradaAt`. Exigir solo una dejaria
    // fuera justo la capa del writer, que es donde este barrido encontro el agujero que mas importaba.
    expect(
      /retirada_at|retiradaAt/.test(leer(ruta)),
      `${ruta} lee evaluaciones de varios pacientes o varias consultas y no menciona la columna del retiro: ` +
        `una consulta retirada va a reaparecer ahi. Si de verdad no aplica, muevela a EXENTAS con su razon.`,
    ).toBe(true);
  });

  // ── Y LOS DOS QUE FILTRAN EN MEMORIA, que el caso de arriba NO cubre ──────────────────────────────
  //
  // En el listado y en el tablero la columna viaja en el `select` y el descarte se hace en JS. Ahi
  // "menciona la columna" se cumple con solo PEDIRLA, asi que alguien podria borrar el descarte y el caso
  // anterior seguiria verde. Es la misma trampa del candado de la via 3 que paso trivialmente.
  it.each([
    "src/modules/patients/data/patients-list-reader.ts",
    "src/modules/dashboard/data/tablero-reader.ts",
  ])("%s no solo pide la columna: descarta con ella", (ruta) => {
    expect(
      leer(ruta),
      `${ruta} trae retirada_at pero no la usa para descartar: pedirla sin filtrar no excluye nada.`,
    ).toContain("retirada_at == null");
  });

  // ── Y EL BARRIDO AL REVES: que no quede una lectura NUEVA sin clasificar ──────────────────────────
  //
  // Es la mitad que de verdad protege. La lista de arriba envejece bien sola; lo que no se vigila es el
  // archivo que alguien escriba el mes que viene.
  it("y toda lectura de evaluaciones esta clasificada: o filtra, o tiene razon escrita", () => {
    const todas = archivosDeDatos("src/modules").filter((p) => {
      const src = leer(p);
      return src.includes('from("evaluations")') || /\bevaluations\s*\(/.test(src);
    });
    expect(todas.length, "el barrido no encontro ninguna lectura: cambio la forma del arbol").toBeGreaterThan(
      15,
    );
    const sinClasificar = todas.filter((p) => !DEBEN_FILTRAR.includes(p) && !(p in EXENTAS));
    expect(
      sinClasificar,
      "estas lecturas de evaluaciones son nuevas y nadie dijo si el retiro les aplica. Si miran varias " +
        "consultas, van en DEBEN_FILTRAR y les falta el filtro; si son de UNA, van en EXENTAS con su razon.",
    ).toEqual([]);
  });

  it("y las exenciones dan una de las dos razones validas, no una cualquiera", () => {
    const VALIDAS = ["por evaluacion", "pasa por reports", "contabilidad del lote importado"];
    for (const [ruta, razon] of Object.entries(EXENTAS)) {
      expect(VALIDAS.some((v) => razon.startsWith(v)), `${ruta}: "${razon}" no es una razon de las validas`)
        .toBe(true);
    }
  });
});
