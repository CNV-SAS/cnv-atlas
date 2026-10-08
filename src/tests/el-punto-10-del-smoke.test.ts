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

  // ── ESTE CASO CAMBIO DE SITIO, Y POR ESO CAMBIA EL CANDADO (2026-10-08) ──────────────────────────
  //
  // Primero arregle solo la LEYENDA y defendi el rotulo ("En consultorio" es la disponibilidad comercial, no el
  // inventario). Santiago insistio y tenia razon: el rotulo nombra un SITIO y el producto no esta en ese sitio.
  // Dos lineas mas abajo, la misma pantalla dice "No tienes unidades en tu vitrina".
  //
  // Asi que ahora el rotulo dice el CANAL, y los nombres viven en UN modulo (estaban en cuatro copias). El
  // candado sigue al mecanismo nuevo en vez de quedarse mirando el archivo viejo: si se quedara ahi, pasaria
  // verde sobre una pantalla que volviera a decir "En consultorio".
  // ── Y ESTE CASO CAMBIO OTRA VEZ, PORQUE LA REGLA SE ENDURECIO (Santiago insistio, 2026-10-08) ────
  //
  // Primero el rotulo decia "En consultorio" (un sitio donde el producto no esta). Lo cambie al CANAL ("Se
  // entrega en consulta") y Santiago insistio con algo mejor: *"en ese caso cambiaria el chip a disponible, ¿no
  // es mejor?"*. Y la prueba de que tenia razon es que SARCO-PROTECT ("No disponible") SI se leia bien: ese
  // rotulo hablaba de existencias y los otros no.
  //
  // ASI QUE EL CHIP YA NO NOMBRA EL CANAL: contesta "¿puedo darselo hoy?". El candado sigue a la regla nueva, y
  // vigila las DOS mitades: que el chip hable del saldo, y que el catalogo siga mandando primero (un producto de
  // "solo tienda" con saldo no se puede entregar, y decir "tienes 5" ahi seria una mentira nueva).
  it("el chip de la prescripcion dice si se puede entregar hoy, no el canal", async () => {
    const { estadoParaPrescribir } = await import("@/modules/nutraceuticals/disponibilidad");

    expect(estadoParaPrescribir("en_consultorio", { propias: 5, enCentral: 10 }).texto).toBe("Tienes 5");
    expect(estadoParaPrescribir("en_consultorio", { propias: 0, enCentral: 384 }).texto).toBe(
      "Hay que pedirlo a la bodega",
    );
    expect(estadoParaPrescribir("en_consultorio", { propias: 0, enCentral: 0 }).texto).toBe("Sin existencias");

    // EL CATALOGO MANDA PRIMERO, y el orden es la mitad que puede romperse sin que se note: al reves, un
    // producto de "solo tienda" con saldo diria "Tienes 5" y seria entregable sin serlo.
    expect(estadoParaPrescribir("solo_tienda", { propias: 5, enCentral: 0 }).texto).toBe("Solo en la tienda");
    expect(estadoParaPrescribir("no_disponible", { propias: 5, enCentral: 0 }).texto).toBe("No disponible");

    // Y SIN EL DATO DEL INVENTARIO NO SE INVENTA UNO: se dice el canal, que es lo que si se sabe.
    expect(estadoParaPrescribir("en_consultorio", undefined).texto).toBe("Se entrega en consulta");
  });

  it("y el chip sale de la MISMA fuente que el bloque de venta, no de una segunda consulta", () => {
    // ERA MI OBJECION A ESTO, y era buena: dos sitios diciendo el stock es como se llega a que uno quede viejo.
    // Se resuelve calculandolo UNA vez en la pagina y pasandolo a los dos, no ignorandola.
    const pagina = leer("src/app/(app)/ani-bis-e/[id]/page.tsx");
    expect(pagina).toContain("dondeEstaCadaProducto");
    expect(pagina).toContain("disponibleParaVender");
    expect(pagina).toContain("disponibleEnCentral");
  });

  it("y los nombres estan en UN sitio, no copiados en cada pantalla", () => {
    // ESTABAN EN CUATRO (`/nutraceuticos`, `/mi-inventario`, el formulario de edicion y la seccion de
    // tratamiento). Cuatro copias es como se llega a corregir una pantalla y dejar tres diciendo lo viejo.
    for (const ruta of [
      "src/app/(app)/nutraceuticos/page.tsx",
      "src/app/(app)/mi-inventario/page.tsx",
      "src/modules/treatment/components/nutraceuticals-section.tsx",
      "src/modules/nutraceuticals/components/edit-nutraceutical-form.tsx",
    ]) {
      expect(leer(ruta), `${ruta} volvio a tener su propia copia del mapa de disponibilidad`).not.toContain(
        "const AVAILABILITY_LABEL",
      );
    }
    expect(src).toContain("LEYENDA_DISPONIBILIDAD");
  });

  it("y la salida de 'no los adquiere' se nombra como la alternativa que es", () => {
    const alt = leer("src/modules/treatment/components/no-los-adquiere-form.tsx");
    expect(alt).toContain("esta es la otra forma de cerrar la prescripción");
    // Y NO SE VUELVE PRIMARIO: competir con "Guardar" invitaria a pulsarlo por salir del paso, y esto registra
    // una decision clinica del paciente.
    expect(alt).toContain('variant="outline"');
  });
});
