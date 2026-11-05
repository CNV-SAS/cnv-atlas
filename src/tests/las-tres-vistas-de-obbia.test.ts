import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ROTULO_DE_LA_VISTA,
  VISTAS_DEL_PANEL,
  vistaPedida,
} from "@/modules/obbia/services/vistas-del-panel";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES VISTAS DEL PANEL DE INVESTIGACION  ·  2026-11-04
//
// ═══ DE DONDE SALE ═══
//
// Cotejo de /obbia contra el modulo CNVResearch de su HTML, con las dos capturas delante (2026-11-03).
// Su modulo abre en **Resumen · Datos · Exportar**, con las dos ultimas bajo candado; /obbia era una sola
// pagina que habia que recorrer entera. Santiago: *"sigue sin parecerse a la pantalla que habia hecho
// Gildardo"*.
//
// Y LA DIFERENCIA NO ES ESTETICA: sus tres pestanas son tres permisos, o sea que el panel dice QUE SE
// PUEDE HACER antes de ensenar nada. En /obbia el permiso estaba escrito pero disuelto en el recorrido.
//
// ═══ LO QUE ESTE CANDADO PROTEGE, Y NO ES "QUE HAYA PESTANAS" ═══
//
// Que la pestana CERRADA siga existiendo y siga diciendo POR QUE. Es lo unico de los tres que es facil de
// perder en un barrido ("esta vacia, se quita"), y es justo lo que la hace valer: una ausencia no explica
// nada, una puerta cerrada con su razon si.
//
// Y que la vista de Exportar siga llevando su ETIQUETA DE NIVEL. El principio ya regia el bloque antes de
// partirlo en tres: *"ofrecer la descarga antes de decir que nivel tiene seria ofrecerla sin su
// etiqueta"*. Al partir la pagina, esa etiqueta se podia quedar en la otra pestana sin que nada fallara.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PAGINA = readFileSync("src/app/(app)/obbia/page.tsx", "utf8");

describe("vistaPedida: conservadora con lo que venga en la URL", () => {
  it("las tres vistas se reconocen", () => {
    for (const v of VISTAS_DEL_PANEL) expect(vistaPedida(v)).toBe(v);
  });

  it("cualquier otra cosa cae en el resumen, que es la que no promete nada", () => {
    for (const raro of [undefined, "", "datos2", "DATOS", "../datos", "exportar;drop"]) {
      expect(vistaPedida(raro)).toBe("resumen");
    }
    // Un array (dos `?vista=` en la URL) toma el primero, no revienta.
    expect(vistaPedida(["datos", "exportar"])).toBe("datos");
    expect(vistaPedida(["nada", "datos"])).toBe("resumen");
  });

  it("las tres tienen rotulo, y en el orden en que se leen", () => {
    expect(VISTAS_DEL_PANEL).toEqual(["resumen", "datos", "exportar"]);
    expect(Object.keys(ROTULO_DE_LA_VISTA).sort()).toEqual([...VISTAS_DEL_PANEL].sort());
  });
});

describe("la pantalla monta las tres vistas de su CNVResearch", () => {
  it("las tres se pintan por separado, no todo de corrido", () => {
    for (const v of VISTAS_DEL_PANEL) {
      expect(PAGINA, `falta la vista ${v}`).toContain(`vista === "${v}"`);
    }
    // Y se navegan con ENLACES: si esto se vuelve un boton con estado, el panel deja de ser un Server
    // Component y la pestana deja de poder compartirse por enlace.
    expect(PAGINA).toContain("/obbia?vista=");
    expect(PAGINA).not.toContain('"use client"');
  });

  it("la vista de Datos esta CERRADA y dice por que, en vez de no estar", () => {
    expect(PAGINA).toContain("Esta vista no se puede abrir todavía");
    // Las dos razones concretas, que son las condiciones antes de la primera venta. Sin ellas el aviso
    // seria "no se puede" sin decir que falta, que es lo que hace que nadie sepa cuando se va a poder.
    expect(PAGINA).toContain("fila a fila");
    expect(PAGINA).toContain("custodia de la llave");
    expect(PAGINA).toContain("(cerrada)"); // y se ve en la pestana, antes de pulsarla
  });

  it("la vista de Exportar lleva su etiqueta de nivel, derivada y no escrita a mano", () => {
    const exportar = PAGINA.slice(PAGINA.indexOf('vista === "exportar"'));
    expect(exportar).toContain("ROTULO_DEL_NIVEL[nivelDelExport.nivel]");
    // LA DESCARGA LLEVA EL FILTRO PUESTO: la URL se arma con los parametros de la pantalla, asi que
    // el archivo describe la MISMA cohorte que se esta mirando. Un `href` literal aqui seria la cohorte
    // entera saliendo de una pantalla filtrada, sin que nada falle.
    expect(exportar).toContain("href={urlDelCsv}");
    expect(PAGINA).toContain("/obbia/cohorte/csv?");
  });

  it("los cuatro consolidados van a ancho completo, uno debajo de otro", () => {
    // A dos columnas, cada tabla tiene seis columnas apretadas. Las suyas van a ancho completo.
    const consolidados = PAGINA.slice(PAGINA.indexOf("Cómo se reparte la cohorte"));
    expect(consolidados).not.toContain("lg:grid-cols-2");
  });
});

describe("el aviso de familias del motor tiene dos voces", () => {
  it("en voz baja cuando la minoria es marginal, en ambar cuando pesa", () => {
    // El hecho es el mismo y las dos familias se nombran igual: lo que cambia es el color. Un aviso que
    // dice "no son comparables" sobre una consulta de 258 se aprende a ignorar, y entonces no avisa de
    // nada el dia que importa.
    expect(PAGINA).toContain("cohorte.mezclaMarginal");
    expect(PAGINA).toContain("text-muted-foreground");
    expect(PAGINA).toContain("text-clinical-warning");
    // Y la cifra se dice en las dos: el umbral no esconde el hecho.
    expect(PAGINA).toContain("familias mayores del motor");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA SUPRESION SE DICE EN LA PANTALLA, Y EL UMBRAL DE COHORTE TIENE SU FRENO  ·  2026-11-05
//
// Santiago: *"el archivo ya se puede descargar con celdas de una persona (Maracaibo, 51 años)... toda
// celda con menos de 5 pacientes se suprime, en la pantalla y en el CSV"*.
//
// El dato ya no sale del lector (eso lo prueba `el-filtro-entra-en-todas-las-consultas-db`). Lo que se
// comprueba aqui es lo otro: que la pantalla DIGA la regla y el freno, porque un hueco sin explicacion se
// lee como un defecto, y un eje que desaparece deja tres tablas donde habia cuatro sin que nadie sepa si
// falta un dato o un control.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la pantalla dice la supresion y el umbral de la cohorte", () => {
  it("explica por que una categoria pequena no se ve por separado", () => {
    expect(PAGINA).toContain("menos de <strong>cinco pacientes</strong>");
    // Y cuantas se reunieron, por eje: sin el numero, la fila reunida no dice si junto dos o veinte.
    expect(PAGINA).toContain("e.suprimidas");
  });

  it("avisa cuando el filtro deja la cohorte bajo el umbral, y dice la salida", () => {
    expect(PAGINA).toContain("cohorte.cohorteBajoElUmbral");
    expect(PAGINA).toContain("El filtro deja menos de cinco pacientes");
    // LA SALIDA: un freno sin salida no es un guard. Aqui la salida es ensanchar el filtro.
    expect(PAGINA).toContain("Ensancha el filtro");
  });

  it("un eje que no se puede publicar lo DICE, en vez de desaparecer", () => {
    expect(PAGINA).toContain("e.noPublicable");
    expect(PAGINA).toContain("Esta tabla no se puede mostrar");
  });

  it("y el CSV lo frena en la RUTA, no en la pantalla", () => {
    // La URL del CSV se puede escribir a mano con los parametros del filtro, asi que un aviso en la
    // pantalla no es un control. Y el 422 importa: un 200 con un archivo vacio quedaria registrado como
    // entrega.
    const ruta = readFileSync("src/app/(app)/obbia/cohorte/csv/route.ts", "utf8");
    expect(ruta).toContain("cohorte.cohorteBajoElUmbral");
    expect(ruta).toContain("422");
    // Y el freno va ANTES de registrar la entrega: al reves, quedaria el asiento de un archivo que no sale.
    expect(ruta.indexOf("cohorte.cohorteBajoElUmbral")).toBeLessThan(
      ruta.indexOf("registrarLaEntregaDelResumen("),
    );
  });
});
