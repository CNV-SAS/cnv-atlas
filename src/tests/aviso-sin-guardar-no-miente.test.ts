import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ROTULO_SECCION,
  SECCIONES,
  seccionesSucias,
  type Publicado,
  type SeccionId,
} from "@/modules/treatment/data/borrador-protocolo";
import {
  adjustmentSignature,
  intercambioSignature,
  menuSemanalSignature,
  objetivoSignature,
  restriccionesSignature,
  tiemposActivosSignature,
  tiemposSignature,
} from "@/modules/treatment/data/protocol-signature";

import { sinComentarios } from "./helpers/sin-comentarios";

// EL AVISO DE "SIN GUARDAR" NO PUEDE MENTIR (Santiago, 2026-09-10).
//
// EL DEFECTO, reportado en el smoke: entrar a Tratamiento -> Nutricionista SIN TOCAR NADA y salir
// *"Tienes 4 secciones con cambios sin guardar: la lista de intercambio, los tiempos de comida, la
// distribución por tiempos, el menú semanal"*. Recien entrado, sin escribir.
//
// LA CAUSA, y NO era comparacion por referencia (se comparan FIRMAS, que son cadenas): se comparaba lo de
// pantalla contra lo GUARDADO. Esas cuatro son justo las que pueden estar guardadas como `null` y DERIVAN
// un valor al montar. Las otras tres hacen ida y vuelta exacta y por eso no salian: la coincidencia entre
// "las cuatro que manejan colecciones" y "las cuatro que derivan un defecto" es lo que confundia el
// diagnostico.
//
// POR QUE DUELE TANTO: un aviso que sale siempre se aprende a ignorar, y entonces el dia que haya cambios
// de verdad nadie lo lee. Un aviso que miente es peor que no tenerlo.
//
// ESTE ARCHIVO REPRODUCE EL CASO con las firmas REALES, no con cadenas de mentira: es la unica forma de
// que el test se ponga rojo por la misma razon por la que fallo la pantalla. No hay entorno de DOM en el
// proyecto (ni testing-library ni jsdom), asi que el render no se puede montar; lo que si se puede probar,
// y es donde vivia el defecto, es la DECISION.

const T = "t-1";

/** Lo que publica una seccion: lo de pantalla y lo que presentaria sin tocarla. */
const pub = (firma: string, firmaBase: string): Publicado => ({ valor: null, firma, firmaBase });

/**
 * EL ESTADO REAL AL ENTRAR a un tratamiento cuyo plan alimentario nunca se guardo, que es el caso del
 * reporte. Cada seccion publica lo que DERIVA (porque es lo que se ve) y, como base, esa misma derivacion.
 */
function alEntrarSinTocarNada(): Partial<Record<SeccionId, Publicado>> {
  // La lista de intercambio: nada guardado, asi que calcula sus porciones desde el objetivo.
  const derivado = { objetivoBase: 2000, porciones: { Cereales: 3, Verduras: 2 } };
  const fInter = intercambioSignature({ treatmentId: T, intercambio: derivado });
  // Los tiempos: nada guardado, asi que caen al juego por defecto.
  const activos = { desayuno: true, almuerzo: true, cena: true };
  const fActivos = tiemposActivosSignature({ treatmentId: T, activos });
  // La distribucion: sin overrides, con el contexto vivo.
  const tiempos = { celdas: {}, base: { porciones: { Cereales: 3 }, activos } };
  const fTiempos = tiemposSignature({ treatmentId: T, tiempos });
  // El menu: dia de arranque DERIVADO del tratamiento, sin celdas escritas.
  const menu = { diaInicio: 4, celdas: {} };
  const fMenu = menuSemanalSignature({ treatmentId: T, menu });

  const sinAjustes = {
    treatmentId: T,
    adjGeb: null,
    adjPal: null,
    adjKcalObj: null,
    adjProtGkg: null,
    adjFatPct: null,
    adjDeficit: null,
    pesoMetaFijado: null,
  };
  const fAjustes = adjustmentSignature(sinAjustes);
  const fObjetivo = objetivoSignature({ treatmentId: T, objetivo: null });
  const fRestr = restriccionesSignature({ treatmentId: T, restricciones: [] });

  return {
    ajustes: pub(fAjustes, fAjustes),
    objetivo: pub(fObjetivo, fObjetivo),
    restricciones: pub(fRestr, fRestr),
    intercambio: pub(fInter, fInter),
    tiemposActivos: pub(fActivos, fActivos),
    tiempos: pub(fTiempos, fTiempos),
    menuSemanal: pub(fMenu, fMenu),
  };
}

describe("recién entrado y sin tocar nada, no hay cambios sin guardar", () => {
  it("EL CASO DEL REPORTE: ninguna de las siete sale como sucia", () => {
    // Con la comparacion vieja (lo de pantalla contra lo GUARDADO, que aqui es null en cuatro de ellas),
    // este caso devolvia las cuatro que Santiago vio nombradas.
    expect(seccionesSucias(alEntrarSinTocarNada())).toEqual([]);
  });

  it("y las CUATRO del reporte tampoco, una por una", () => {
    // Se nombran para que un rojo futuro diga exactamente cual volvio a mentir.
    const estado = alEntrarSinTocarNada();
    for (const k of ["intercambio", "tiemposActivos", "tiempos", "menuSemanal"] as const) {
      expect(seccionesSucias({ [k]: estado[k] }), `${ROTULO_SECCION[k]} volvió a salir sin tocarla`)
        .toEqual([]);
    }
  });

  it("EL DEFECTO, REPRODUCIDO: con la base VIEJA (lo guardado) salían exactamente esas cuatro", () => {
    // ESTE CASO ES LA PRUEBA EN ROJO, conservada. Se arma el mismo estado pero con la base que usaba el
    // código anterior: la firma de lo GUARDADO, que en estas cuatro es `null` porque el plan alimentario
    // nunca se había guardado. Salen las cuatro que Santiago vio nombradas, en el mismo orden.
    //
    // Se conserva porque explica POR QUÉ la regla es la que es. Sin él, alguien puede leer `firmaBase` como
    // una duplicación de `firmasGuardadas` y "simplificarlo" de vuelta al defecto.
    const estado = alEntrarSinTocarNada();
    const guardadoVacio = {
      intercambio: intercambioSignature({ treatmentId: T, intercambio: null }),
      tiemposActivos: tiemposActivosSignature({ treatmentId: T, activos: null }),
      tiempos: tiemposSignature({ treatmentId: T, tiempos: null }),
      menuSemanal: menuSemanalSignature({ treatmentId: T, menu: null }),
    } as const;
    for (const [k, base] of Object.entries(guardadoVacio)) {
      const p = estado[k as SeccionId]!;
      estado[k as SeccionId] = pub(p.firma, base);
    }
    expect(seccionesSucias(estado)).toEqual([
      "intercambio",
      "tiemposActivos",
      "tiempos",
      "menuSemanal",
    ]);
    // Y las otras tres siguen limpias, que es la otra mitad de lo que Santiago observó: avisó de CUATRO,
    // no de siete. La coincidencia con "las que manejan colecciones" era eso, una coincidencia.
    expect(seccionesSucias(estado)).not.toContain("ajustes");
  });

  it("una sección que todavía NO publicó tampoco cuenta", () => {
    // La otra mitad del mismo defecto: al montar, el aviso saldria antes de que nadie tocara nada.
    expect(seccionesSucias({})).toEqual([]);
  });
});

describe("pero un cambio de verdad SÍ sale, que es el control", () => {
  it("si lo de pantalla difiere de lo que presentaría sin tocar, la sección es sucia", () => {
    // SIN ESTE CASO, "no sale nunca" tambien pasaria verde, y ese es el otro modo de romper el aviso: uno
    // que no sale nunca pierde el trabajo en silencio, que es peor que uno que sale siempre.
    const estado = alEntrarSinTocarNada();
    const otras = { desayuno: true, almuerzo: true, cena: true, merienda: true };
    estado.tiemposActivos = pub(
      tiemposActivosSignature({ treatmentId: T, activos: otras }),
      estado.tiemposActivos!.firmaBase,
    );
    expect(seccionesSucias(estado)).toEqual(["tiemposActivos"]);
  });

  it("y salen en el ORDEN de la pantalla, no en el de llegada", () => {
    // El aviso las lista; leerlas en un orden distinto del de la pantalla obliga a buscarlas.
    const estado = alEntrarSinTocarNada();
    estado.menuSemanal = pub("cambiado", estado.menuSemanal!.firmaBase);
    estado.objetivo = pub("cambiado", estado.objetivo!.firmaBase);
    expect(seccionesSucias(estado)).toEqual(["objetivo", "menuSemanal"]);
  });
});

describe("la decisión vive en UN sitio, y la pantalla no se la reescribe", () => {
  const PANEL = sinComentarios(
    readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"),
  );

  it("el panel usa `seccionesSucias`, no una comparación propia", () => {
    // Si alguien vuelve a compararlo a mano contra las firmas guardadas, vuelve el aviso falso. Se prohíbe
    // la forma exacta que lo causó.
    expect(PANEL).toContain("const sucias = seccionesSucias(publicado)");
    expect(PANEL, "volvió la comparación contra lo guardado").not.toMatch(
      /firma !== firmasGuardadas\[/,
    );
  });

  it("las SIETE publican su firma base", () => {
    // Una que se quede sin ella no da error: publica `null` como base y deja de contarse, o peor, alguien
    // le pasa la firma guardada y vuelve el defecto para esa sección sola.
    for (const k of SECCIONES) {
      const i = PANEL.indexOf(`"${k}",`);
      expect(i, `la sección ${k} dejó de publicarse`).toBeGreaterThan(-1);
    }
    // El contrato: cuatro argumentos, no tres.
    expect(PANEL).toContain("firmaBase: string | null,");
  });

  it("y los rótulos son UNA lista, compartida con el servidor", () => {
    // Estaban escritos dos veces (pantalla y writer) y son texto que lee un profesional. Dos copias de una
    // lista visible es como acaban diciendo cosas distintas.
    const WRITER = readFileSync("src/modules/treatment/data/protocolo-writer.ts", "utf8");
    expect(PANEL).toContain("ROTULO_SECCION");
    expect(WRITER).toContain("ROTULO_SECCION");
    expect(sinComentarios(WRITER), "el writer volvió a escribir su propia lista de rótulos").not.toContain(
      'ajustes: "la cadena calórica"',
    );
  });
});

describe("lo que no se tocó, no se guarda", () => {
  const PANEL = sinComentarios(
    readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"),
  );

  it("el payload manda lo GUARDADO para las secciones intactas", () => {
    // NO ES UNA OPTIMIZACION. Guardar la lista de intercambio DERIVADA porque el profesional editó el
    // objetivo sellaría un `objetivoBase` que nadie decidió, y a partir de ahí el aviso de desfase
    // empezaría a dispararse sobre una lista que nunca se tocó.
    expect(PANEL).toContain("sucia(k) ? (publicado[k]!.valor as T) : guardado");
  });

  it("pero lo que GOBIERNA a otra sección sí es siempre lo de pantalla", () => {
    // La distribución tiene que repartir sobre las porciones que se VEN, aunque sean las calculadas por
    // defecto y nadie las haya movido. Son dos preguntas distintas: qué se guarda y qué se muestra.
    expect(PANEL).toContain("const activosEnVivo = enPantalla<");
    expect(PANEL).toContain("const intercambioEnVivo = enPantalla<");
  });
});

describe("y tampoco miente DESPUES de guardar", () => {
  const PANEL = sinComentarios(
    readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"),
  );

  it("la lista de intercambio re-deriva sus porciones cuando el objetivo se mueve", () => {
    // EL DEFECTO, un paso más adelante (Santiago, 2026-09-10): guardar la cadena calórica y que el aviso
    // volviera a salir por la lista de intercambio.
    //
    // LA CAUSA: la `key` de esa sección depende del intercambio GUARDADO. Al cambiar solo la cadena, ese
    // no cambia, la sección NO se remonta, y su estado se queda con las porciones derivadas del objetivo
    // ANTERIOR mientras los defaults ya se recalcularon con el nuevo. Y no era solo un aviso falso: la
    // tabla mostraba porciones calculadas para un objetivo que ya no era.
    expect(PANEL, "la lista de intercambio dejó de seguir al objetivo").toContain(
      "if (objetivoSembrado !== objetivoEfectivo) {",
    );
    expect(PANEL).toContain("setObjetivoSembrado(objetivoEfectivo);");
  });

  it("pero NO si el profesional las tocó, ni si ya hay una lista guardada", () => {
    // Las dos mitades del límite, y las dos protegen algo distinto:
    //  · TOCADAS: re-derivar borraría el ajuste manual, que es justo lo que el aviso de desfase (DIV-11)
    //    existe para no hacer.
    //  · GUARDADA: seguir al objetivo volvería MENTIROSO ese aviso ("estas porciones se calcularon para X
    //    kcal, pero el objetivo ahora es Y"), que es el mecanismo diseñado para ese caso.
    expect(PANEL).toContain("if (saved == null && sinTocar) {");
    expect(PANEL).toContain("anteriores.every((a) => (porciones[a.sub] ?? 0) === a.porciones)");
    // Y el aviso de desfase sigue existiendo: es la otra mitad del par.
    expect(PANEL).toContain("saved.objetivoBase !== objetivoEfectivo");
  });

  it("y se ajusta en el RENDER, no en un efecto", () => {
    // Es el patrón que React documenta para un estado derivado de una prop: re-rinde antes de pintar. En
    // un efecto correría después de pintar y encadenaría renders, que es lo que la regla
    // `set-state-in-effect` señala. Y el valor previo va en ESTADO, no en un ref: leer un ref durante el
    // render está prohibido por `react-hooks/refs`.
    expect(PANEL).toContain("const [objetivoSembrado, setObjetivoSembrado] = useState(objetivoEfectivo);");
  });
});

describe("las entregas se distinguen entre sí", () => {
  const PANEL = sinComentarios(
    readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8"),
  );
  const HC = sinComentarios(
    readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8"),
  );
  const PDF = sinComentarios(readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8"));

  it("con HORA, no solo la fecha", () => {
    // Dos impresiones el mismo día salían como dos líneas idénticas, y el registro existe para saber QUÉ
    // recibió el paciente: dos entradas iguales no contestan eso.
    expect(PANEL).toContain("formatDateTime(e.fecha)");
    expect(
      sinComentarios(readFileSync("src/modules/reports/data/hc-documento-reader.ts", "utf8")),
    ).toContain("formatDateTime(e.emittedAt)");
  });

  it("con las CIFRAS selladas en esa salida", () => {
    // Es lo que de verdad diferencia una entrega de otra, y ya se guardaba: la copia completa vive en
    // `prescription_emissions.prescripcion` y su cadena efectiva en columnas.
    for (const [nombre, src] of [
      ["el panel", PANEL],
      ["la historia en pantalla", HC],
      ["el PDF", PDF],
    ] as const) {
      expect(src, `${nombre} no muestra las cifras de cada entrega`).toMatch(/kcal/);
      expect(src, `${nombre} no muestra la proteína de cada entrega`).toMatch(/g de proteína/);
    }
  });

  it("y marcando cuál es la que el paciente tiene ahora", () => {
    // Sin marcarla, la lista es un historial sin presente. Se marca por POSICIÓN (el lector ordena
    // `emitted_at desc`): dos del mismo minuto no se podrían desempatar comparando cadenas.
    expect(PANEL).toContain("la que tiene ahora");
    expect(HC).toContain("(la última entregada)");
    expect(PDF).toContain("(la última entregada)");
  });

  it("y NO se afirma que dos entregas sean iguales", () => {
    // Las dos cifras que se muestran no sostienen esa conclusión: el menú, las restricciones o el reparto
    // pudieron cambiar sin mover el objetivo calórico. Se muestran los datos; la conclusión la saca quien
    // lee.
    for (const src of [PANEL, HC, PDF]) {
      expect(src).not.toMatch(/sin cambios/i);
      expect(src).not.toMatch(/idéntic/i);
    }
  });
});
