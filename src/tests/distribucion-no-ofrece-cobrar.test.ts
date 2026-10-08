import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ BAJO DISTRIBUCIÓN NO SE OFRECE COBRAR, EN VEZ DE OFRECERLO Y RECHAZARLO (Santiago, 2026-10-07) ═══
//
// ── LO QUE PASABA, dicho por él ──
//
// *"Intento hacer una compra en /pagos por checkout y el profesional está marcado como distribución, aparece
// este toast error... No me parece que el toast sea el apropiado de cara al integrante. Entonces pienso que es
// mejor simplemente esconder el checkout."*
//
// Tiene razón: un formulario que SIEMPRE va a rechazar no es una validación, es trabajo perdido. Y el gate del
// servidor (`exigirRecaudoDeCnv`) no se toca, porque es el que de verdad impide el cobro: lo que se quita es la
// puerta que lleva a él.
//
// ── Y LA MITAD QUE ÉL NO VIO, QUE ES LA QUE MÁS IMPORTA ──
//
// Él lo encontró en /pagos, pero la superficie que el integrante usa de verdad es la VENTA EN CONSULTA, donde
// cobra con el paciente delante. Ahí el mismo "Cobrar con QR" estaba igual de disponible, y el rechazo llegaría
// en mitad de una consulta. Es el patrón de "una regla también vive en varios sitios": arreglar solo el sitio
// donde se reportó deja el peor sin tocar.
//
// ── Y LA TERCERA COSA: HABÍA TEXTO QUE AFIRMABA LO CONTRARIO ──
//
// "Ese dinero es de CNV y lo custodias hasta consignar" es FALSO bajo Distribución (el dinero es del
// integrante), y estaba a dos centímetros del aviso que dice "el paciente te paga a ti". Dos partes de la misma
// pantalla afirmando cosas opuestas sobre la misma venta.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

const PAGOS = "src/app/(app)/pagos/page.tsx";
const SECCION = "src/modules/treatment/components/venta-en-consulta-section.tsx";
const FORMULARIO = "src/modules/treatment/components/venta-en-consulta-form.tsx";

describe("las DOS superficies de cobro conocen la modalidad", () => {
  it.each([
    [PAGOS, "el checkout de /pagos"],
    [SECCION, "la venta en consulta"],
  ])("%s pregunta por la modalidad antes de ofrecer un cobro de CNV", (ruta) => {
    const src = leer(ruta);
    expect(src, `${ruta} no pregunta por la modalidad: va a ofrecer un cobro que el servidor rechaza`).toContain(
      "esDeDistribucion",
    );
  });

  it("y el QR de la consulta NO se rinde bajo Distribución", () => {
    const src = leer(FORMULARIO);
    // SE MIRA LA GUARDA JUNTO AL BOTÓN, no solo que la bandera exista en el archivo: una bandera que llega y no
    // se usa es el defecto de "una bandera ignorada deja creer que se aplicó".
    const bloque = src.slice(src.indexOf('key="qr"') - 700, src.indexOf('key="qr"'));
    expect(bloque, "el botón del QR dejó de colgar de la modalidad").toContain("esDeDistribucion ? null :");
  });

  it("y el botón que queda no dice 'cobrar', porque no entra dinero de CNV", () => {
    const src = leer(FORMULARIO);
    expect(src).toContain("Registrar la entrega");
  });
});

describe("ninguna pantalla le dice al integrante de Distribución que el dinero es de CNV", () => {
  const FRASE = "ese dinero es de CNV";

  it.each([PAGOS, FORMULARIO])("%s solo lo afirma en la rama que NO es Distribución", (ruta) => {
    const src = leer(ruta);
    // La frase puede seguir existiendo (es verdad en Comisión), pero NO puede ser la única: tiene que venir con
    // su alternativa. Si aparece sin un condicional de modalidad cerca, es que volvió a ser incondicional.
    const i = src.toLowerCase().indexOf(FRASE);
    if (i === -1) return;
    const alrededor = src.slice(Math.max(0, i - 900), i + 300);
    expect(
      alrededor,
      `${ruta} afirma "${FRASE}" sin distinguir la modalidad: bajo Distribución el dinero es del integrante, y ` +
        `la pantalla se contradice con su propio aviso.`,
    ).toContain("esDeDistribucion");
  });
});

describe("la tarjeta de ingreso bruto permite rehacer su propia resta", () => {
  it("dice cuántas se devolvieron, no solo cuántos pagos hubo", () => {
    // EL CASO: decía "$428.400 · 7 pagos", y 428.400 son exactamente CUATRO ventas de 107.100. Las dos cifras
    // estaban bien (7 pagadas menos el dinero de 3 devueltas), pero juntas se leían como un descuadre y
    // Santiago paró el smoke a preguntar si cuadraban. El dato estaba en la pantalla, varios paneles más abajo.
    const src = leer("src/app/(app)/direccion/page.tsx");
    expect(src, "la tarjeta volvio a dar un conteo que no cuadra con su importe").toContain("devueltasCount");
    expect(src).toContain("su dinero no suma aquí");
  });

  it("y el lector lo cuenta de las MISMAS filas con que descuenta el dinero", () => {
    // Si el conteo saliera de otra consulta que la resta, la linea podria decir "3 devueltos" mientras el
    // importe descuenta 2. Es la leccion de las dos pantallas que armaban su propio universo.
    const src = leer("src/modules/direccion/data/dashboard-reader.ts");
    expect(src).toContain("devueltasCount: devueltasRows.length");
    expect(src).toContain("devoluciones: devueltasRows.map");
  });
});
