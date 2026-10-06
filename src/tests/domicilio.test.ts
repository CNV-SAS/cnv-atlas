import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DIAS_DE_RETRACTO,
  TEXTO_AVISO_DOMICILIO,
  TEXTO_DE_RETRACTO,
  estadoDelRetracto,
  procedeElRetracto,
  reintegroPorRetracto,
} from "@/modules/payments/domicilio";

// Los helpers del barrido van locales, como en el resto de los candados que recorren el arbol
// (`fecha-de-arranque`, `ids-con-guid`): no hay un modulo compartido y crearlo aqui seria el octavo sitio.
function archivosDeCodigo(dir = "src"): string[] {
  const out: string[] = [];
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) recorrer(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  recorrer(dir);
  return out;
}

function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ═══ CANDADO DEL DOMICILIO Y EL RETRACTO ═══
//
// Dos mitades, y la segunda es nueva:
//
//   1. EL RETRACTO, que lo fija la Ley 1480 de 2011 (articulo 47) y no cambio. Cada caso cita su regla.
//   2. QUE EL FLETE NO HAYA VUELTO, por ningun sitio. Es un BARRIDO del arbol, no una prueba de una
//      funcion.
//
// ── POR QUE LA SEGUNDA MITAD ES UN BARRIDO Y NO UN CASO ─────────────────────────────────────────────
//
// La decision contable del 2026-10-05 saco el flete de CNV, y su regla es innegociable y textual: "el dinero
// del flete nunca entra a cuentas de CNV ni de un Integrante. Sin excepciones, ni por hacerle el favor a un
// paciente. Si entra una vez, aparece un ingreso sin factura y un gasto sin soporte, y se rompe la
// consistencia de todo el modelo."
//
// Una regla asi no se guarda probando que UNA funcion ya no existe: se guarda comprobando que NINGUN sitio
// la volvio a escribir. El flete vivia repartido en siete archivos (el modulo puro, el lector, el bloque de
// pantalla, el servicio, el escritor, la cuenta de distribucion y el consolidado de despachos), y lo que
// este candado tiene que atrapar es a cualquiera de los siete volviendo a cobrarlo, o a un octavo nuevo.
// Es la misma leccion de los rotulos clinicos: una regla tambien vive en varios sitios.

describe("el derecho de retracto", () => {
  it("son cinco dias habiles", () => {
    expect(DIAS_DE_RETRACTO).toBe(5);
  });

  // §5.7: el envio a domicilio es lo que convierte la operacion en venta a distancia. Una venta entregada en
  // consulta no activa el retracto.
  it("no aplica a una venta entregada en consulta", () => {
    const e = estadoDelRetracto({
      deliveryMode: "en_consulta",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(false);
  });

  // §5.7: bajo Distribucion el expendedor frente al paciente es el INTEGRANTE. Decir que CNV lo honra seria
  // prometer por otro.
  it("bajo Distribucion lo atiende el Integrante, no CNV", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "distribucion",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(false);
    expect(e.motivo).toMatch(/Integrante/);
  });

  // EL PLAZO CORRE DESDE LA ENTREGA, no desde el pago (articulo 47: "siguientes a la entrega").
  it("una venta pagada y no entregada aplica, pero sin reloj corriendo", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: null,
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(true);
    expect(e.limite).toBeNull();
  });

  it("cuenta cinco dias HABILES desde la entrega", () => {
    // Entregada el jueves 10 de septiembre de 2026: cinco habiles caen el jueves 17.
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.limite).toBe("2026-09-17");
    expect(e.vencido).toBe(false);
  });

  it("vencido despues del limite", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-18",
    });
    expect(e.vencido).toBe(true);
    expect(e.diasHabilesRestantes).toBe(0);
  });
});

describe("si procede el retracto", () => {
  const dentro = estadoDelRetracto({
    deliveryMode: "domicilio",
    modalidad: "comision",
    entregadaEl: "2026-09-10",
    hoy: "2026-09-11",
  });

  // La tabla del modelo: sellado y sin abrir, PROCEDE.
  it("con el sello intacto y dentro del plazo, procede", () => {
    expect(procedeElRetracto({ estado: dentro, selloIntacto: true }).procede).toBe(true);
  });

  // Con el sello roto NO procede, por bien de uso personal (numeral 7). El sello es la evidencia que lo
  // acredita, y la doctrina exige acreditarlo, no afirmarlo.
  it("con el sello roto no procede, y se dice por que", () => {
    const r = procedeElRetracto({ estado: dentro, selloIntacto: false });
    expect(r.procede).toBe(false);
    expect(r.motivo).toMatch(/uso personal/i);
  });

  it("fuera del plazo no procede aunque este sellado", () => {
    const tarde = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-30",
    });
    expect(procedeElRetracto({ estado: tarde, selloIntacto: true }).procede).toBe(false);
  });

  // EL MOTIVO YA NO PROMETE EL ENVIO (2026-10-05): lo que el paciente le pago a CNV es el producto, y el
  // envio se lo pago al mensajero. Prometer aqui el reintegro del envio seria ofrecer plata que CNV no
  // recibio, en la pantalla de quien tendria que entregarla.
  it("y el motivo del si NO ofrece devolver el envio", () => {
    const r = procedeElRetracto({ estado: dentro, selloIntacto: true });
    expect(r.motivo).not.toMatch(/env[ií]o/i);
    expect(r.motivo).toMatch(/le pag[oó] a CNV/i);
  });
});

describe("el reintegro", () => {
  // ES LO QUE EL PACIENTE LE PAGO A CNV, que es el producto. El envio se lo pago al mensajero, asi que CNV no
  // lo recibio y no lo devuelve: el asesor legal lo ratifico el 2026-10-06 y la posicion es defendible porque
  // el servicio lo presta y lo cobra un tercero.
  //
  // EL 2026-10-05 ESTA FUNCION LLEVABA UN PARAMETRO `flete` que yo conserve "para las ventas viejas". No
  // habia ninguna: la consulta a la nube dio CERO ventas con flete. El parametro se fue en la 0207.
  it("devuelve lo que el paciente le pago a CNV", () => {
    expect(reintegroPorRetracto({ montoDelProducto: 107_100 })).toBe(107_100);
  });

  // NI DESCUENTOS NI RETENCIONES: el articulo 47 lo dice con esas palabras, asi que el reintegro es el monto
  // completo y no una fraccion. Un caso trivial a proposito, porque la tentacion de restarle algo (una
  // comision de pasarela, un costo administrativo) es justo lo que el articulo prohibe.
  it("sin descontarle nada", () => {
    for (const monto of [50_000, 107_100, 1_234_567]) {
      expect(reintegroPorRetracto({ montoDelProducto: monto })).toBe(monto);
    }
  });
});

describe("el texto publicado", () => {
  // VA COMO CONSTANTE porque es texto legal: dos copias se separan, y una version suavizada del derecho es
  // una infraccion, no un matiz de redaccion.
  it("dice las tres cosas que no puede dejar de decir", () => {
    expect(TEXTO_DE_RETRACTO).toMatch(/cinco \(5\) días hábiles/);
    expect(TEXTO_DE_RETRACTO).toMatch(/sello original intacto/);
    // ESTA LINEA ES UN RECORDATORIO A PROPOSITO, no una afirmacion de que este bien (2026-10-05). El texto
    // promete reintegrar "incluido el valor del envío", y desde que el flete salio de CNV ese dinero no
    // llega a CNV. NO SE TOCO porque es texto legal publicado al paciente y recortarle un derecho sin que
    // lo ratifique quien lo redacto es justo lo que la constante existe para impedir.
    //
    // ASI QUE SI ESTE CASO SE PONE ROJO, la pregunta no es "como lo arreglo": es si ya respondieron la
    // consulta que esta planteada en BACKLOG.md. Si la respondieron, se cambian el texto Y este caso, con la
    // respuesta citada al lado.
    expect(TEXTO_DE_RETRACTO).toMatch(/incluido el valor del envío/);
  });

  it("nombra la norma", () => {
    expect(TEXTO_DE_RETRACTO).toMatch(/artículo 47 de la Ley 1480 de 2011/);
  });
});

describe("el aviso del envio al paciente", () => {
  // LITERAL DE CONTABILIDAD (2026-10-05). Su redaccion hace trabajo juridico: deja claro que el servicio lo
  // presta UN TERCERO y que CNV solo coordina, y es eso lo que protege en un reclamo por una entrega. Las
  // tres piezas que no puede perder:
  it("dice que el envio lo presta un tercero y se le paga a el", () => {
    expect(TEXTO_AVISO_DOMICILIO).toMatch(/servicio de mensajería independiente/);
    expect(TEXTO_AVISO_DOMICILIO).toMatch(/se paga directamente a esa persona/);
  });

  it("dice que el costo es aparte del producto y aproximado", () => {
    expect(TEXTO_AVISO_DOMICILIO).toMatch(/aparte del valor del producto/);
    expect(TEXTO_AVISO_DOMICILIO).toMatch(/generalmente entre 10\.000 y 20\.000/);
  });

  it("y promete coordinar, que es lo unico que CNV hace en el envio", () => {
    expect(TEXTO_AVISO_DOMICILIO).toMatch(/coordinar la entrega/);
  });

  // UNA COPIA EN LA PANTALLA SE SEPARA DEL ORIGINAL, que es la razon de que sea constante. El bloque tiene
  // que IMPORTARLA, no reescribirla.
  it("la pantalla lo importa en vez de reescribirlo", () => {
    const bloque = readFileSync("src/modules/payments/components/bloque-domicilio.tsx", "utf8");
    expect(bloque).toContain("TEXTO_AVISO_DOMICILIO");
    expect(sinComentarios(bloque)).not.toMatch(/mensajería independiente/);
  });
});

// ═══ EL BARRIDO: QUE EL FLETE NO HAYA VUELTO POR NINGUN SITIO ═══
describe("ningun sitio de la aplicacion cobra un flete", () => {
  // SE EXCLUYEN EL ESQUEMA Y LOS TIPOS GENERADOS, y no es una grieta en el barrido: esos dos archivos
  // DESCRIBEN la base, no la usan. Las columnas del flete siguen existiendo (la 0206 las deja rotuladas como
  // historicas, porque una venta anterior al cambio si cobro flete y puede retractarse), asi que tienen que
  // seguir declaradas o Drizzle no podria leerlas. Lo que el barrido persigue es que alguien las USE.
  const FUENTES = archivosDeCodigo("src").filter(
    (f) => !f.includes("src/tests") && !f.startsWith("src/db/schema/") && !f.includes("database.generated"),
  );

  // LAS FUNCIONES QUE LO CALCULABAN NO EXISTEN, y no deben volver a existir en ninguna parte. Se buscan por
  // NOMBRE en todo el arbol: una copia en otro archivo calcularia lo mismo sin que este candado la viera si
  // solo se comprobara el modulo original.
  it.each(["fleteDelEnvio", "fleteFacturado", "MARGEN_DE_FLETE_POR_DEFECTO", "ofertaDeDomicilio"])(
    "no existe %s en ninguna parte",
    (nombre) => {
      const culpables = FUENTES.filter((f) => sinComentarios(readFileSync(f, "utf8")).includes(nombre));
      expect(culpables, `${nombre} volvio: el flete salio de CNV el 2026-10-05`).toEqual([]);
    },
  );

  // LA CONFIGURACION DEL FLETE NO SE LEE. Las columnas siguen en la base (rotuladas como historicas en la
  // 0206) justo para que una consulta nueva no las resucite sin que nadie lo note.
  it.each(["flete_tarifa", "flete_margen", "costo_sugerido"])("ninguna consulta lee %s", (columna) => {
    const culpables = FUENTES.filter((f) => sinComentarios(readFileSync(f, "utf8")).includes(columna));
    expect(culpables, `${columna} es historica desde la 0206: nada la lee`).toEqual([]);
  });

  // LAS COLUMNAS DEL FLETE NO EXISTEN (0207), asi que ya no hay que distinguir leerlas de escribirlas: NADIE
  // las puede nombrar. Es un candado mas fuerte que el del 2026-10-05, y lo es porque el hecho cambio: ese
  // dia las columnas se conservaron por si una venta vieja tenia flete, y al dia siguiente la consulta a la
  // nube dio cero. Una consulta que las nombre falla contra la base, pero falla EN RUNTIME; esto lo atrapa
  // antes.
  it.each(["shipping_fee", "shipping_cost", "shippingFee", "shippingCost"])(
    "nadie nombra %s, que ya no existe en la base",
    (nombre) => {
      const culpables = FUENTES.filter((f) => sinComentarios(readFileSync(f, "utf8")).includes(nombre));
      expect(culpables, `${nombre} se borro en la 0207: una consulta que lo nombre revienta`).toEqual([]);
    },
  );

  // Y EL MONTO DE LA VENTA NO LO INCLUYE. Era la linea del servicio que sumaba el flete al cobro; si vuelve,
  // el paciente le paga a CNV un envio que CNV no presta.
  it("el monto que se le cobra al paciente no suma ningun envio", () => {
    const servicio = sinComentarios(
      readFileSync("src/modules/payments/services/payments-service.ts", "utf8"),
    );
    expect(servicio).not.toMatch(/amount\s*\+\s*flete/);
    expect(servicio).not.toMatch(/flete\.total/);
  });
});
