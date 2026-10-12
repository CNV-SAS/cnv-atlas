import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));

import { cuentaDelPago, type MapaDeAlegra } from "@/modules/payments/facturacion";
import { medioDianDelPago } from "@/modules/payments/medio-de-pago";

// ═══ LA TRANSFERENCIA ES UN MEDIO, NO UN EFECTIVO CON OTRO NOMBRE (Santiago, 2026-09-25) ═══
//
// Atlas nació con dos canales (pasarela y efectivo), pero antes de Atlas se cobraba por transferencia, y hoy
// también se puede. Anotarla como efectivo no es un matiz de etiqueta:
//
//   · el medio viaja a la FACTURA ELECTRÓNICA y la DIAN separa efectivo de transferencia débito;
//   · y decide la CUENTA del pago: la del efectivo se llama "Efectivo en poder de Integrantes", o sea que la
//     plata sigue por recoger. Una transferencia ya llegó a una cuenta.

const MAPA: MapaDeAlegra = {
  env: "sandbox",
  ivaTaxId: "4",
  invoiceTemplateId: "16",
  creditNoteTemplateId: "17",
  costCenterPropioId: "1",
  costCenterTerceroId: "2",
  bankAccountEfectivoId: "5",
  bankAccountPasarelaId: "6",
  bankAccountTransferenciaId: null,
};

describe("el medio de pago de una transferencia", () => {
  it("es transferencia débito ante la DIAN, no efectivo", () => {
    expect(medioDianDelPago({ canal: "transferencia", tipo: null, tipoTarjeta: null })).toBe(
      "transferencia_debito",
    );
    // Control: el efectivo sigue siendo efectivo.
    expect(medioDianDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("efectivo");
  });

  it("SIN SU CUENTA CONFIGURADA no hereda la del efectivo: devuelve null", () => {
    // Apuntarla a la del efectivo diría que un dinero que ya está en el banco sigue en el bolsillo de
    // alguien. El pago espera y el panel dice por qué; la factura sale igual.
    expect(cuentaDelPago("transferencia", MAPA)).toBeNull();
    expect(cuentaDelPago("efectivo", MAPA)).toBe(5);
    expect(cuentaDelPago("wompi", MAPA)).toBe(6);
  });

  it("y con su cuenta configurada, usa la suya", () => {
    expect(cuentaDelPago("transferencia", { ...MAPA, bankAccountTransferenciaId: "9" })).toBe(9);
  });
});

// ═══ Y LA OFRECEN LAS DOS PANTALLAS QUE COBRAN, NO SOLO UNA (Santiago, 2026-10-10) ═══
//
// Textual suyo: *"en el flujo de venta de tratamiento no tenemos la opción de transferencia."* El medio existía
// desde el 2026-09-25, el servidor lo entendía, y /pagos lo preguntaba. La venta EN CONSULTA no: mandaba
// siempre efectivo. O sea que la pantalla que de verdad usa el integrante con el paciente delante era justo la
// que guardaba el dato mal, y lo guardaba en silencio.
//
// ES EL PATRÓN DE "una regla también vive en varios sitios": arreglar solo donde se reportó deja el peor sin
// tocar. Este candado mira las DOS, para que la próxima no vuelva a quedarse en una.
describe("las dos pantallas que cobran ofrecen transferencia", () => {
  const leer = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
  const PAGOS = "src/modules/payments/components/register-cash-sale-form.tsx";
  // LA PREGUNTA SUBIO A LA TARJETA (Santiago, 2026-10-10). Era un desplegable dentro del formulario de la
  // venta ya cobrada, con dos opciones, mientras el link de pago (el TERCER medio) vivia en otra tarjeta:
  // una sola pregunta partida en dos sitios que no se miraban. Hoy los tres medios son un solo selector y
  // el formulario recibe el canal como prop. El hecho se mudo, no se relajo: se verifica que la tarjeta
  // ofrezca la transferencia Y que el formulario la MANDE.
  const TARJETA = "src/modules/payments/components/tarjeta-de-cobro.tsx";
  const CONSULTA = "src/modules/treatment/components/venta-en-consulta-form.tsx";

  it("/pagos la ofrece como uno de los tres medios", () => {
    const src = leer(TARJETA);
    expect(src).toMatch(/id: "transferencia"/);
    expect(src).toMatch(/id: "efectivo"/);
    expect(src).toMatch(/id: "link"/);
  });

  // ═══ Y DICE A DONDE TRANSFIERE EL PACIENTE, QUE ES LO QUE FALTABA (Santiago, 2026-10-10) ═══
  //
  // ── LO QUE SE RETIRO, Y POR QUE NO ES UNA RELAJACION ──
  //
  // El boton decia "Factura al banco principal, y queda sin cobrar hasta que se verifique". El lo rechazo:
  // *"Esto no se dice a los integrantes, es algo interno de CNV."* El HECHO contable es verdad y sigue
  // vigilado donde manda, en los tres primeros casos de este archivo (`cuentaDelPago` y `medioDianDelPago`);
  // lo que se retiro es decirselo a quien no le sirve.
  //
  // ── Y LO QUE SI LE SIRVE, QUE NO ESTABA EN NINGUNA PARTE ──
  //
  // La CUENTA. El medio existia desde el 2026-09-25 y la pantalla nunca dijo a donde transferir: el integrante
  // tenia que sabersela de memoria o pedirla por interno, con el paciente delante. Un medio sin su destino es
  // una etiqueta, no un medio.
  //
  // SE VIGILA QUE SALGAN DE LA CONSTANTE COMPARTIDA, no escritas a mano: el mismo dato hace falta en la venta
  // en consulta (paso 2 de la unificacion), y una cuenta bancaria copiada en dos pantallas es una que el dia
  // que cambie quedara bien en una y mal en la otra. El dinero iria a una cuenta que ya no es.
  describe("y dice A DONDE transfiere el paciente", () => {
    const CUENTA = "src/modules/payments/cuenta-de-cnv.ts";

    it("la constante tiene la llave Breb, la cuenta y el titular", () => {
      const src = leer(CUENTA);
      expect(src).toContain("llaveBreb");
      expect(src).toContain("numeroDeCuenta");
      expect(src).toContain("Connected Nutrition Ventures");
    });

    it("la tarjeta los muestra DESDE la constante, no a mano", () => {
      const src = leer(TARJETA);
      expect(src).toContain("CUENTA_DE_CNV.llaveBreb");
      expect(src).toContain("CUENTA_DE_CNV.numeroDeCuenta");
      // Y NADIE LOS TECLEA EN LA PANTALLA: un numero de cuenta literal aqui es la copia que se desincroniza.
      const numeros = leer(CUENTA).match(/"\d{8,}"/g) ?? [];
      expect(numeros.length, "la constante dejo de tener los numeros").toBeGreaterThan(0);
      for (const n of numeros) {
        expect(src, "la tarjeta tiene un numero de cuenta escrito a mano: " + n).not.toContain(
          n.replace(/"/g, ""),
        );
      }
    });

    it("y dice que hay que mandarle el comprobante a admin", () => {
      // LA MITAD QUE SE OLVIDA: sin la captura, admin no puede cotejar la transferencia contra el extracto y
      // la venta queda registrada sin forma de confirmar que el dinero llego. Un paso manual que no esta en
      // la pantalla es un paso que no se hace.
      expect(leer(CUENTA)).toMatch(/captura de la transferencia/i);
      expect(leer(TARJETA)).toContain("QUE_HACER_CON_EL_COMPROBANTE");
    });

    it("y el bloque de la cuenta solo sale cuando se eligio transferencia", () => {
      // Ensenarla siempre seria decirle al paciente que transfiera cuando va a pagar en efectivo.
      expect(leer(TARJETA)).toContain('{medio === "transferencia" ? (');
    });
  });

  it("y el formulario de /pagos MANDA el canal que la tarjeta eligio", () => {
    const src = leer(PAGOS);
    expect(src).toContain('name="canal"');
    // Sin el `value={canal}` el campo viajaria vacio y el servidor caeria en efectivo: una transferencia
    // registrada como efectivo apunta el dinero a "Efectivo en poder de Integrantes", que dice que sigue
    // por recoger cuando ya esta en un banco.
    expect(src).toContain('<input type="hidden" name="canal" value={canal} />');
  });

  it("la venta en consulta la ofrece y MANDA el canal", () => {
    const src = leer(CONSULTA);
    // Sin este `set`, el servidor cae en su valor por defecto (efectivo) y la transferencia se guarda mal.
    expect(src).toContain('fd.set("canal", canal);');
    expect(src).toContain("Cobrar por transferencia");
    expect(src).toContain('setConfirmando("transferencia")');
  });

  it("y los reintentos no la degradan a efectivo", () => {
    const src = leer(CONSULTA);
    // Los avisos de link pendiente y de duplicado VUELVEN A COBRAR. Si llamaran sin el medio, el segundo
    // intento (el camino que nadie mira) registraría como efectivo lo que se cobró por transferencia.
    expect(src).toContain("cobrarYaPagada(canalUsado.current, { anularLinks: true })");
    expect(src).toContain("cobrarYaPagada(canalUsado.current, { confirmDuplicate: true })");
    expect(src, "no debe quedar ningún cobro que no diga el medio").not.toMatch(/cobrarYaPagada\(\s*\{/);
  });

  it("pero NO bajo Distribución, donde el servidor deriva el canal", () => {
    const src = leer(CONSULTA);
    // Preguntar allá sería ofrecer una respuesta que se descarta: el paciente le paga al integrante.
    const bloque = src.slice(src.indexOf("LA TRANSFERENCIA, QUE AQUÍ NO EXISTÍA"), src.indexOf("Cobrar por transferencia"));
    expect(bloque).toContain("esDeDistribucion ? null : (");
  });

  // ═══ Y LA CONSULTA TAMBIÉN DICE A DÓNDE, CON LOS MISMOS NÚMEROS (Santiago, 2026-10-12) ═══
  //
  // *"Que quede igual que /pagos."* El medio existía en las dos pantallas desde el 2026-10-10, pero solo
  // /pagos decía la cuenta. Y la consulta es DONDE MÁS HACE FALTA: el paciente está delante y alguien le
  // lee la llave en voz alta.
  //
  // SE BARREN LAS DOS PANTALLAS EN EL MISMO CANDADO a propósito: es una REGLA, y una regla vive en todos
  // los sitios donde se cobra. Arreglar una y dejar la otra es como volvió este defecto la primera vez.
  describe("la cuenta de CNV, en las DOS pantallas donde se cobra", () => {
    const DONDE_SE_COBRA = [
      ["la tarjeta de /pagos", TARJETA],
      ["la venta en consulta", CONSULTA],
    ] as const;

    for (const [nombre, archivo] of DONDE_SE_COBRA) {
      it(nombre + " muestra la cuenta DESDE la constante", () => {
        const src = leer(archivo);
        expect(src, "sin la llave, el integrante tiene que sabérsela de memoria con el paciente delante").toContain(
          "CUENTA_DE_CNV.llaveBreb",
        );
        expect(src).toContain("CUENTA_DE_CNV.numeroDeCuenta");
        expect(src, "el paso manual que no está en la pantalla es el que no se hace").toContain(
          "QUE_HACER_CON_EL_COMPROBANTE",
        );
        // NADIE LOS TECLEA: una cuenta copiada es una cuenta que el día que cambie queda bien en una
        // pantalla y mal en la otra, y el dinero va a una cuenta que ya no es.
        const numeros = leer("src/modules/payments/cuenta-de-cnv.ts").match(/"\d{8,}"/g) ?? [];
        expect(numeros.length, "la constante dejó de tener los números").toBeGreaterThan(0);
        for (const n of numeros) {
          expect(src, nombre + " tiene un número de cuenta escrito a mano: " + n).not.toContain(
            n.replace(/"/g, ""),
          );
        }
      });

      it(nombre + " no le cuenta al integrante la contabilidad interna de CNV", () => {
        // LA FRASE QUE SANTIAGO RETIRÓ: *"administración confirma el pago contra el extracto antes de
        // facturar"*. *"Esto no se dice a los integrantes, es algo interno de CNV."* El hecho sigue vivo
        // donde manda (`transferencia-la-confirma-una-persona`); lo que se retiró es decírselo a quien no
        // le sirve. Se lee SIN comentarios: el de arriba cita la frase para explicar por qué no está.
        const src = sinComentarios(leer(archivo));
        expect(src, nombre + " volvió a anunciar lo que hace admin después").not.toMatch(/extracto/i);
        expect(src, nombre + " volvió a decir que queda sin cobrar").not.toMatch(/sin cobrar/i);
      });
    }
  });

  it("y el medio en línea nombra a Wompi en las dos, cada una con su presentación", () => {
    // EL MISMO MEDIO, DOS PRESENTACIONES: en /pagos se manda un link (el cobro puede no ser presencial) y
    // en la consulta se muestra un QR (el paciente está delante). Lo que no puede pasar es que una de las
    // dos no diga que es Wompi, porque entonces el integrante no sabe qué le va a aparecer al paciente.
    expect(leer(TARJETA)).toContain("Link de pago por Wompi");
    expect(leer(CONSULTA)).toContain("Cobrar con QR de Wompi");
    // Y LA DESCRIPCIÓN DEL MEDIO SALE DEL MÓDULO COMPARTIDO, no escrita dos veces: así no se corrige en la
    // pantalla donde se vio el problema dejando la otra diciendo lo de antes.
    expect(leer(TARJETA)).toContain("MEDIOS_DE_PAGO.");
    expect(leer(CONSULTA)).toContain("MEDIOS_DE_PAGO.");
  });
});
