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
//    Y ADEMAS ERA LA MITAD DEL BUG QUE EL REPORTO: con un paciente por defecto, los minibloques de "de que
//    consulta sale esta compra" se montaban antes de que nadie eligiera a nadie, y el resultado era que *"solo
//    le puedo registrar una venta al paciente que viene por default en el selector."* Sin paciente no se monta
//    ningun bloque, asi que la acumulacion no tiene de donde salir.
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

describe("los dos formularios de cobro arrancan sin paciente", () => {
  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) nace con el selector vacio", (ruta) => {
    const src = leer(ruta);
    expect(src).toMatch(/const \[patientId, setPatientId\] = useState\(""\)/);
    // NADIE vuelve a sembrar el primero de la lista, ni por `patients[0]` ni por `?.id` sobre el arreglo.
    expect(src).not.toMatch(/useState\(\s*patients\[0\]/);
    expect(src).not.toMatch(/setPatientId\(\s*patients\[0\]/);
  });

  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) usa el selector comun, no un <select> propio", (ruta) => {
    const src = leer(ruta);
    expect(src).toContain("<SelectorDePaciente");
    expect(src).toContain('from "./selector-de-paciente"');
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
    expect(leer(EFECTIVO)).toMatch(/<input type="hidden" name="patientId" value=\{patientId\} \/>/);
    expect(leer(CHECKOUT)).toMatch(/<input type="hidden" name="patientId" value=\{patientId\} \/>/);
  });
});
