import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ NINGUN PACIENTE VIENE ELEGIDO, SE BUSCA POR NOMBRE, Y EL MINIBLOQUE ES UNO (Santiago, 2026-10-10) ═══
//
// ── EL BUG QUE ESTE CANDADO PERSIGUE, Y LAS TRES VUELTAS QUE COSTO ─────────────────────────────────
//
// Textual suyo, repetido tres dias: *"Selecciono un paciente, le doy cambiar y selecciono otro paciente. Y
// aparecen 2 minibloques de consulta."* Los dos primeros arreglos atacaron SINTOMAS y los dos eran ciertos:
//
//   1. los formularios arrancaban con `patients[0]` elegido, asi que los bloques se montaban antes de que
//      nadie eligiera a nadie;
//   2. y /pagos tenia DOS tarjetas visibles a la vez, cada una con SU buscador y SU bloque.
//
// Ninguno lo cerro. LA TERCERA VUELTA NO BUSCA LA CAUSA: quita el sitio donde puede aparecer, que es lo que
// el propuso. Hoy el minibloque es UNO, vive en la tarjeta, se monta SIEMPRE y no se re-monta nunca; los
// formularios no lo montan y solo reciben su respuesta.
//
// ── Y POR ESO ESTE CANDADO MIRA LO CONTRARIO QUE ANTES ────────────────────────────────────────────
//
// Dos de sus casos exigian `{patientId ? <BloqueTratamiento` DENTRO de cada formulario. Eso era correcto
// mientras el bloque viviera ahi, y hoy seria el defecto: el hecho se MUDO. Lo que se verifica ahora es que
// los formularios NO lo monten (si volvieran, volveria el apilado) y que la tarjeta lo monte una sola vez.
//
// ── LO QUE SE PERDIO AL QUITAR LA `key`, Y DONDE ESTA AHORA ───────────────────────────────────────
//
// La `key={patientId}` re-montaba el bloque al cambiar de paciente, y eso no era cosmetico: sin ello la
// consulta elegida para uno queda seleccionada para el siguiente, y asi se le cuelga una compra a la consulta
// de otra persona. Al quitarla, esa garantia pasa a `elegirPaciente`, que vacia la respuesta en el mismo
// gesto. ES LA PIEZA MAS FRAGIL DE TODO EL ARREGLO (un `setPatientId` suelto la rompe sin que nada falle),
// asi que tiene su propio caso aqui.
//
// ── POR QUE UN CANDADO ESTATICO Y NO UN TEST DE RENDER ───────────────────────────────────────────
//
// Lo que se protege son DECISIONES de estructura y de arranque (donde vive el estado, que nace vacio, que el
// boton no deje pasar), no un comportamiento interactivo. Un render en jsdom probaria lo mismo con mucha mas
// maquinaria, y este defecto ya reaparecio por COPIA entre los dos formularios: el segundo hereda lo del
// primero.
const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");
const leerSinComentarios = (rel: string) => sinComentarios(leer(rel));

const EFECTIVO = "src/modules/payments/components/register-cash-sale-form.tsx";
const CHECKOUT = "src/modules/payments/components/create-checkout-form.tsx";
const SELECTOR = "src/modules/payments/components/selector-de-paciente.tsx";
const LECTOR = "src/modules/payments/data/payments-repository.ts";
const TARJETA = "src/modules/payments/components/tarjeta-de-cobro.tsx";
const BLOQUE = "src/modules/payments/components/bloque-tratamiento.tsx";

describe("el cobro de /pagos arranca sin paciente, y el paciente se elige UNA vez", () => {
  it("la tarjeta nace con el selector vacio", () => {
    const src = leerSinComentarios(TARJETA);
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
    const src = leerSinComentarios(ruta);
    // ESTO ES EL CANDADO DEL APILADO. Un segundo sitio con su propio estado de paciente devuelve el
    // segundo bloque de "de que consulta sale esta compra", que es exactamente lo que Santiago vio.
    expect(
      src,
      ruta + " volvio a tener su propio buscador: con dos, se ven dos bloques de consulta a la vez",
    ).not.toContain("<SelectorDePaciente");
    expect(src).not.toMatch(/const \[patientId, setPatientId\] = useState/);
    // Lo recibe como prop, declarada en su firma.
    expect(leer(ruta)).toMatch(/patientId: string;/);
  });

  it("y la pagina monta UNA sola tarjeta de cobro", () => {
    const pagina = leerSinComentarios("src/app/(app)/pagos/page.tsx");
    expect(pagina).toContain("<TarjetaDeCobro");
    // Las dos tarjetas de antes ya no se montan desde la pagina: si volvieran, volveria el apilado.
    expect(pagina).not.toContain("<CreateCheckoutForm");
    expect(pagina).not.toContain("<RegisterCashSaleForm");
  });

  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) no deja enviar sin paciente, y lo dice", (ruta) => {
    const src = leerSinComentarios(ruta);
    // EL GATE ES EL BOTON, y dice en su rotulo que falta. Si alguien lo quita, el envio llega al servidor con
    // patientId vacio y el rechazo aparece como un error tecnico en vez de como la pantalla diciendo que
    // falta elegir.
    expect(src).toMatch(/const falta = !patientId/);
    expect(src).toMatch(/disabled=\{pending \|\| falta != null/);
    expect(src).toContain("Elige un paciente");
  });
});

// ═══ EL MINIBLOQUE DE LA CONSULTA: UNO, SIEMPRE, Y QUE NO SE RE-MONTA ═══
describe("de que consulta sale esta compra se pregunta UNA sola vez", () => {
  it.each([
    [EFECTIVO, "la venta en efectivo"],
    [CHECKOUT, "el link de pago"],
  ])("%s (%s) ya NO monta el bloque: solo manda su respuesta", (ruta) => {
    const src = leerSinComentarios(ruta);
    // LA RAIZ DEL BUG. Cada formulario que monte el bloque es un bloque mas en la pantalla, y /pagos ya
    // demostro dos veces que basta con que haya dos sitios para que se vean dos.
    expect(
      src,
      ruta + " volvio a montar el bloque de la consulta: con dos sitios, se ven dos bloques",
    ).not.toContain("<BloqueTratamiento");
    // Y LA RESPUESTA VIAJA EN CAMPOS OCULTOS, porque el bloque esta FUERA del formulario y un campo de
    // fuera no viaja en su envio. Sin estos dos, la venta se registraria sin consulta y sin motivo, en
    // silencio, que es peor que no registrarla.
    expect(src).toContain('<input type="hidden" name="treatmentId" value={treatmentId} />');
    expect(src).toContain('name="ventaSueltaMotivo"');
  });

  it("la tarjeta lo monta UNA vez, SIN condicion de paciente y SIN `key`", () => {
    const src = leerSinComentarios(TARJETA);
    const montajes = src.match(/<BloqueTratamiento/g) ?? [];
    expect(montajes, "la tarjeta tiene que montar el bloque exactamente una vez").toHaveLength(1);
    // SIN `{patientId ? ...}`: Santiago pidio que este SIEMPRE puesto, y aparecer y desaparecer es la mitad
    // de lo que se veia como "se duplica".
    const montaje = src.slice(src.indexOf("<BloqueTratamiento"), src.indexOf("hayPaciente={patientId"));
    expect(montaje, "el bloque volvio a colgar de una `key`, que es lo que lo re-montaba").not.toMatch(
      /key=/,
    );
    expect(src).not.toMatch(/\{patientId \?\s*\(?\s*<BloqueTratamiento/);
    // Y RECIBE SI HAY PACIENTE como DATO, que es lo que le deja decir "elige primero el paciente" en vez de
    // desaparecer.
    expect(src).toContain("hayPaciente={patientId !== \"\"}");
  });

  it("el bloque NO guarda la respuesta: la recibe y la emite", () => {
    const src = leerSinComentarios(BLOQUE);
    // CON ESTADO PROPIO VUELVE EL PROBLEMA: un estado dentro del bloque solo se puede limpiar
    // re-montandolo, o sea con la `key` que hubo que quitar.
    expect(src, "el bloque volvio a tener estado propio: entonces hay que re-montarlo para limpiarlo").not.toMatch(
      /useState/,
    );
    expect(src).toMatch(/valor: ConsultaDeLaCompra;/);
    expect(src).toMatch(/onCambiar: \(cambio: Partial<ConsultaDeLaCompra>\) => void;/);
  });

  it("Y CAMBIAR DE PACIENTE VACIA LA CONSULTA: lo que la `key` hacia", () => {
    const src = leerSinComentarios(TARJETA);
    // ── LA PIEZA MAS FRAGIL DEL ARREGLO ──
    //
    // Sin esto, la consulta elegida para un paciente se queda seleccionada para el siguiente y se le cuelga
    // una compra a la consulta de otra persona. No falla nada visible: la venta se registra, atada a la
    // consulta equivocada, y un dato malo se ve igual que uno bueno.
    expect(src).toMatch(/const elegirPaciente = \(id: string\) => \{/);
    const cuerpo = src.slice(src.indexOf("const elegirPaciente"), src.indexOf("const respondida"));
    expect(cuerpo).toContain("setPatientId(id)");
    expect(cuerpo).toMatch(/setConsulta\(\{ treatmentId: "", suelta: false, motivo: "" \}\)/);
    // Y NADIE MUEVE EL PACIENTE POR FUERA DE AHI. Dos llamadas a `setPatientId` son dos caminos, y uno de
    // los dos se olvidara de vaciar la consulta.
    const llamadas = src.match(/setPatientId\(/g) ?? [];
    expect(
      llamadas,
      "el paciente se mueve desde mas de un sitio: el que no pase por `elegirPaciente` dejara viva la consulta del anterior",
    ).toHaveLength(1);
    expect(src).toContain("onElegir={elegirPaciente}");
  });

  it("y el boton exige que la consulta este respondida, en los TRES formularios", () => {
    // LOS TRES, no los dos de /pagos: la venta retroactiva usa el mismo bloque, y una regla que vive en
    // varios sitios y se arregla en uno vuelve por el que se dejo.
    for (const ruta of [EFECTIVO, CHECKOUT, "src/modules/payments/components/venta-retroactiva-form.tsx"]) {
      const src = sinComentarios(leer(ruta));
      expect(src, ruta + " no exige que se diga de que consulta sale").toMatch(/consultaRespondida/);
    }
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
