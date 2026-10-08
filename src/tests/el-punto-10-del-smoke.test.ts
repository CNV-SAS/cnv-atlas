import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ LOS SEIS ARREGLOS DEL PUNTO 10 (Santiago, smoke del 2026-10-07) ═══
//
// Casi todos son de TEXTO, y por eso van juntos: lo que falló no fue el cálculo, fue lo que la pantalla decía
// del cálculo. En una sola sesión, dos rótulos incompletos produjeron dos conclusiones FALSAS sobre datos
// correctos ("el 386 es falso", "el inventario no se movió"), y un rótulo que no distinguía un caso del otro
// hizo creer que una venta despachada seguía pendiente.
//
// La lección que los agrupa: una cifra correcta con un rótulo incompleto cuesta lo mismo que una cifra mala, y
// se diagnostica peor, porque nadie sospecha del texto.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

const DIRECCION = "src/app/(app)/direccion/page.tsx";
const SECCION_VENTA = "src/modules/treatment/components/venta-en-consulta-section.tsx";
const FORM_VENTA = "src/modules/treatment/components/venta-en-consulta-form.tsx";
const PAGOS = "src/app/(app)/pagos/page.tsx";
const NUTRAS = "src/modules/treatment/components/nutraceuticals-section.tsx";

describe("el desglose de inventario dice de que universo habla", () => {
  it("'Por producto' declara que son las vitrinas", () => {
    // SIN ESA PALABRA: el desglose se leyo como el inventario COMPLETO, y de ahi salieron las dos conclusiones
    // falsas. La tarjeta de arriba decia "En las vitrinas" y el desglose no, asi que parecian dos cosas.
    expect(leer(DIRECCION)).toContain("Por producto, en las vitrinas");
  });

  it("y lo de fuera de las vitrinas se abre por producto, para poder cotejar la pantalla de venta", () => {
    // La pantalla de venta dice "disponibles: 386 en la bodega de CNV" y aqui la bodega era UN numero. Un
    // agregado que no se puede abrir obliga a creerselo, y creerselo fue justo lo que fallo.
    expect(leer(DIRECCION)).toContain("Por producto, fuera de las vitrinas");
    expect(leer("src/modules/direccion/data/dashboard-reader.ts")).toContain("inventoryFueraPorProducto");
  });

  it("y la nota distingue la REMESA de la VENTA, que es lo que confundio", () => {
    const src = leer(DIRECCION);
    // La nota decia "el saldo de la bodega central no baja", a secas: verdad de una remesa, FALSO de una venta
    // desde la bodega (el saldo es un cache del trigger de movimientos, 0040). Leida como regla general, llevo a
    // concluir que una venta despachada no habia movido nada.
    expect(src).toContain("remesa");
    expect(src).toContain("venta desde la bodega");
    expect(
      src,
      "la nota volvio a afirmar en general que la bodega no baja: eso es falso para una venta",
    ).not.toContain("el saldo de la bodega central no baja cuando se despacha una remesa: sube");
  });
});

describe("una venta desde la bodega se cuenta bien de punta a punta", () => {
  it("ya despachada deja de decir que falta despacharla", () => {
    const src = leer(SECCION_VENTA);
    // Decia "falta despacharla" SIEMPRE, asi que la tarjeta mostraba eso justo encima de "Entregado el ...".
    expect(src).toContain("Salió de la bodega de CNV: ya la despacharon");
    expect(src).toContain('v.fulfillment_state === "entregado"');
  });

  it("y avisa del domicilio ANTES de cobrar, con el texto de legal y no con una copia", () => {
    const src = leer(FORM_VENTA);
    // Toda venta desde la bodega es un envio, asi que el aviso de legal (el envio se le paga a un tercero) tiene
    // que salir aqui tambien. DEL MODULO: una segunda copia de un texto legal se queda vieja cuando legal cambie.
    expect(src).toContain("TEXTO_AVISO_DOMICILIO");
    expect(src).toContain("el envío se lo paga a un tercero");
    expect(
      src,
      "el texto legal se copio a mano en vez de importarse: el dia que legal lo cambie, esta copia miente",
    ).not.toContain("servicio de mensajería independiente");
  });
});

describe("el historial de /pagos dice de quien es y que paso con cada venta", () => {
  const src = leer(PAGOS);

  it("marca las que se deshicieron, porque el pie sabia cuantas y las filas no cuales", () => {
    // "8 ventas en total · 3 se devolvieron" con las ocho filas diciendo "Pagado": el Integrante ve menos dinero
    // y no tiene con que explicarselo. Una devolucion no cambia el `status`, asi que sale de `sale_reversals`.
    expect(src).toContain("reversiones.get(tx.id)");
    expect(src).toContain("su dinero no cuenta en lo vendido");
  });

  it("y dice que profesional vendio, para quien ve las de todos", () => {
    expect(src).toContain("Vendió ");
  });
});

describe("la hora, donde era el unico sitio que no la tenia", () => {
  it("'Pendientes sin salida' da fecha y hora como el resto de /pagos", () => {
    const src = leer("src/modules/avisos/components/pendientes-sin-salida.tsx");
    expect(src).toContain("Del {formatDateTime(p.desde)}");
  });
});

describe("la prescripcion no se puede cerrar en blanco sin decirlo", () => {
  const src = leer(NUTRAS);

  it("guardar sin nada prescrito y sin decidir AVISA, y no apaga el boton", () => {
    // LA FORMA LA ELIGIO SANTIAGO contra mi primer impulso de apagarlo: un boton apagado no dice por que lo
    // esta, y el profesional se queda buscando el motivo. Uno que se pulsa y responde si lo dice.
    expect(src).toContain("setFaltaCerrar(true)");
    expect(src).toContain("No hay nada que guardar todavía");
    expect(
      src,
      "el boton de guardar volvio a apagarse por la prescripcion vacia: se eligio avisar, no bloquear",
    ).not.toMatch(/disabled=\{pending \|\| nutras\.length === 0\}/);
  });

  it("y no avisa si la decision del paciente ya esta registrada", () => {
    // Con "no los adquiere" registrado, una prescripcion vacia es coherente: avisar ahi seria frenar lo correcto.
    expect(src).toContain('protocol.nutraceuticalDecision?.decision === "no"');
  });

  it("el rotulo de disponibilidad dice que es el canal, no las unidades del profesional", () => {
    // Decia "se lo puedes entregar en la consulta", que es FALSO con la vitrina en cero: prometia algo sobre su
    // inventario y solo sabia algo del catalogo.
    expect(src).toContain("no cuántas unidades tienes");
    // SE MIRA LA FORMA JSX, no la frase a secas: el comentario de al lado CITA el texto viejo para explicar por
    // que se cambio, y un `not.toContain` de la frase tropieza con su propia documentacion. Es la tercera vez
    // hoy que me pasa, asi que queda escrito: lo que se prohibe es lo que se RINDE.
    expect(
      src,
      "volvio el texto que promete entregar en consulta: es falso con la vitrina en cero",
    ).not.toContain("&rdquo;: se lo puedes entregar en la consulta.");
  });

  it("y la salida de 'no los adquiere' se nombra como la alternativa que es", () => {
    const alt = leer("src/modules/treatment/components/no-los-adquiere-form.tsx");
    expect(alt).toContain("esta es la otra forma de cerrar la prescripción");
    // Y NO SE VUELVE PRIMARIO: competir con "Guardar" invitaria a pulsarlo por salir del paso, y esto registra
    // una decision clinica del paciente.
    expect(alt).toContain('variant="outline"');
  });
});
