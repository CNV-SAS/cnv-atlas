import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ NINGUN PACIENTE VIENE ELEGIDO DE ANTEMANO, Y SE BUSCA POR NOMBRE (Santiago, 2026-10-10) ═══
//
// ── LOS DOS DEFECTOS QUE ESTE CANDADO SOSTIENE ─────────────────────────────────────────────────────
//
// 1. LOS DOS FORMULARIOS DE COBRO ARRANCABAN CON `patients[0]` ELEGIDO. Textual suyo: *"siempre aparece uno
//    por default, cuando deberia aparecer vacio para que sea el profesional quien se encargue de seleccionar
//    al paciente."* No es preferencia: un formulario de COBRO que llega con una persona ya puesta invita a
//    registrarle la venta a quien encabeza la lista, y el que cobra no tiene por que notarlo.
//
//    Y ERA LA MITAD DEL BUG QUE EL REPORTO: con un paciente por defecto, los minibloques de "de que consulta
//    sale esta compra" se montaban antes de que nadie eligiera a nadie. Sin paciente no se monta ninguno.
//
//    LA OTRA MITAD SE CERRO EL MISMO DIA, Y CAMBIO DONDE VIVE ESTE CANDADO: el apilado seguia pasando porque
//    /pagos tenia DOS tarjetas visibles a la vez, cada una con SU buscador y SU bloque. Ahora hay UNA tarjeta
//    (`tarjeta-de-cobro.tsx`) que elige el paciente una sola vez y se lo pasa como prop al formulario del medio
//    que corresponda, asi que mas de un bloque no puede existir. Por eso lo que antes se verificaba DENTRO de
//    cada formulario (el estado vacio, el selector) se verifica ahora en la tarjeta: el hecho se mudo, no se
//    relajo. Lo que sigue verificandose en los dos formularios es lo que sigue siendo suyo: que no dejen
//    enviar sin paciente y que no monten los bloques sin el.
//
// 2. EL DESPLEGABLE SOLO MOSTRABA EL DOCUMENTO. Una lista de numeros sin nombres: *"hay una integrante con
//    +200 pacientes y es muy dificil para ella buscar pacientes."* La causa no era la cantidad, era que el dato
//    por el que uno busca a una persona (su nombre) no estaba en la pantalla. Por eso el lector lo trae.
//
// ── POR QUE UN CANDADO ESTATICO Y NO UN TEST DE RENDER ───────────────────────────────────────────
//
// Lo que se protege es una DECISION de arranque y un gate, no un comportamiento interactivo: que el estado nazca
// vacio y que no se pueda enviar sin paciente. Un render en jsdom probaria lo mismo con mucha mas maquinaria, y
// este defecto ya reaparecio una vez por COPIA entre los dos formularios (el segundo hereda lo del primero).
const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

const EFECTIVO = "src/modules/payments/components/register-cash-sale-form.tsx";
const CHECKOUT = "src/modules/payments/components/create-checkout-form.tsx";
const SELECTOR = "src/modules/payments/components/selector-de-paciente.tsx";
const LECTOR = "src/modules/payments/data/payments-repository.ts";
const TARJETA = "src/modules/payments/components/tarjeta-de-cobro.tsx";

describe("el cobro de /pagos arranca sin paciente, y el paciente se elige UNA vez", () => {
  it("la tarjeta nace con el selector vacio", () => {
    const src = leer(TARJETA);
    expect(src).toMatch(/const \[patientId, setPatientId\] = useState\(""\)/);
    // NADIE vuelve a sembrar el primero de la lista, ni por `patients[0]` ni por `?.id` sobre el arreglo.
    expect(src).not.toMatch(/useState\(\s*patients\[0\]/);
    expect(src).not.toMatch(/setPatientId\(\s*patients\[0\]/);
  });

  it("y usa el selector comun, no un <select> propio", () => {
    const src = leer(TARJETA);
    expect(src).toContain("<SelectorDePaciente");
    expect(src).toContain('from "./selector-de-paciente"');
  });

  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) ya NO elige paciente: lo recibe", (ruta) => {
    const src = leer(ruta);
    // ESTO ES EL CANDADO DEL APILADO. Un segundo sitio con su propio estado de paciente devuelve el
    // segundo bloque de "de que consulta sale esta compra", que es exactamente lo que Santiago vio.
    expect(
      src,
      ruta + " volvio a tener su propio buscador: con dos, se ven dos bloques de consulta a la vez",
    ).not.toContain("<SelectorDePaciente");
    expect(src).not.toMatch(/const \[patientId, setPatientId\] = useState/);
    // Lo recibe como prop, declarada en su firma.
    expect(src).toMatch(/patientId: string;/);
  });

  it("y la pagina monta UNA sola tarjeta de cobro", () => {
    const pagina = leer("src/app/(app)/pagos/page.tsx");
    expect(pagina).toContain("<TarjetaDeCobro");
    // Las dos tarjetas de antes ya no se montan desde la pagina: si volvieran, volveria el apilado.
    expect(pagina).not.toContain("<CreateCheckoutForm");
    expect(pagina).not.toContain("<RegisterCashSaleForm");
  });

  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) no deja enviar sin paciente", (ruta) => {
    const src = leer(ruta);
    // El boton de enviar lo exige. Si alguien quita el gate, el envio llega al servidor con patientId vacio y
    // el rechazo aparece como un error tecnico en vez de como la pantalla diciendo que falta elegir.
    expect(src).toMatch(/disabled=\{pending \|\| !patientId/);
    expect(src).toContain("Elige un paciente");
  });

  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) no monta los bloques del paciente sin paciente", (ruta) => {
    const src = leer(ruta);
    // LA RAIZ DEL BUG QUE EL REPORTO: el bloque de la consulta y el del domicilio hablan de UN paciente. Sin
    // paciente elegido no tienen de quien hablar, y montarlos igual es como se llegaron a ver varios a la vez.
    expect(src).toMatch(/\{patientId \? \(?\s*<BloqueTratamiento/);
    expect(src).toMatch(/\{patientId \? <BloqueDomicilio/);
  });
});

describe("se puede buscar al paciente por su nombre", () => {
  it("el lector trae el nombre, no solo el documento", () => {
    const src = leer(LECTOR);
    expect(src).toContain("patient_profiles(first_name, last_name)");
    // El tipo lo declara: duplicarlo en la pantalla es como se llega a un selector que pide un campo que la
    // consulta no trae.
    expect(src).toMatch(/nombre: string;/);
  });

  it("el selector busca por nombre Y por documento", () => {
    const src = leer(SELECTOR);
    expect(src).toContain("p.nombre.toLowerCase().includes(q)");
    expect(src).toContain("p.label.toLowerCase().includes(q)");
  });

  it("el campo de busqueda NO lleva name (su texto no debe viajar)", () => {
    const src = leer(SELECTOR);
    // HAZARD: con `name`, lo que alguien teclee viaja en el envio del formulario que contiene al selector. Lo
    // que viaja es el id, y va en el campo oculto de cada formulario.
    const campo = src.slice(src.indexOf("<Input"), src.indexOf("placeholder="));
    expect(campo).not.toMatch(/\bname=/);
    // EL CAMPO OCULTO SIGUE SIENDO DE CADA FORMULARIO aunque el buscador viva arriba: es el envio de ESE
    // formulario el que tiene que llevar el id, y un campo fuera de el no viajaria.
    expect(leer(EFECTIVO)).toMatch(/<input type="hidden" name="patientId" value=\{patientId\} \/>/);
    expect(leer(CHECKOUT)).toMatch(/<input type="hidden" name="patientId" value=\{patientId\} \/>/);
  });
});
