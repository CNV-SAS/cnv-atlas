import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leyendaDePrueba, ROTULO_DE_PRUEBA } from "@/modules/patients/de-prueba";

// ═══ EL BARRIDO DE "PACIENTE DE PRUEBA", CON SU CANDADO (2026-09-25) ═══
//
// EL PROBLEMA NO ERA LA CASILLA. `patients.is_test` existia desde antes y se respetaba en UN SOLO SITIO (la
// facturacion). En todo lo demas un paciente de prueba contaba igual que uno real. MARCAR SOLO EXCLUYE DONDE
// ALGUIEN ESCRIBIO QUE EXCLUYA, asi que el trabajo era el barrido, y un barrido sin candado se desarma en la
// siguiente pantalla que cuente pacientes.
//
// ── POR QUE ESTE CANDADO MIRA EL CODIGO FUENTE ──
//
// Porque lo que hay que vigilar es una AUSENCIA en un sitio que todavia no existe. Un test de comportamiento
// solo puede probar las cifras que hoy tenemos; este falla cuando alguien escriba una CIFRA NUEVA y se le
// olvide el filtro, que es exactamente como se perdio la primera vez.
//
// Y LA LISTA DE EXCEPCIONES ES EL DOCUMENTO: cada lectura que NO filtra tiene que decir por que. Una excepcion
// sin razon es un olvido con permiso.

const raiz = process.cwd();

const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

describe("la regla de que significa 'de prueba'", () => {
  it("distingue PROPUESTO de MARCADO, porque mientras no se confirme sigue contando", () => {
    // Si la pantalla dijera "de prueba" desde que el profesional lo propone, la pantalla y la cifra se
    // contradirian sobre el mismo paciente. Esa clase de contradiccion (dos partes que leen fuentes
    // distintas) ya nos costo un diagnostico mal leido.
    const propuesto = leyendaDePrueba({ esDePrueba: false, propuesto: true, motivoPropuesto: "es mi cuenta" });
    expect(propuesto).toContain("esperando");
    expect(propuesto).toContain("sigue contando");
    expect(propuesto).not.toBe(ROTULO_DE_PRUEBA);

    const marcado = leyendaDePrueba({ esDePrueba: true, propuesto: false, motivoPropuesto: null });
    expect(marcado).toContain("No cuenta en las cifras");

    expect(leyendaDePrueba({ esDePrueba: false, propuesto: false, motivoPropuesto: null })).toBeNull();
  });
});

describe("las cifras no cuentan a los pacientes de prueba", () => {
  it("el conteo del tablero del profesional los excluye", () => {
    const src = leer("src/modules/dashboard/data/tablero-reader.ts");
    expect(src).toContain('.eq("cuenta_como_de_prueba", false)');
  });

  it("los pacientes asignados de un integrante, en la pantalla de admin, los excluyen", () => {
    const src = leer("src/modules/payments/data/integrante-reader.ts");
    // El join hace falta: la tabla de relacion no sabe si el paciente es de prueba.
    expect(src).toContain("join patients p on p.id = r.patient_id");
    expect(src).toContain("coalesce(p.cuenta_como_de_prueba, false) = false");
  });

  // ═══ Y SUS VENTAS TAMPOCO CUENTAN (Santiago, 2026-10-01) ═══
  //
  // EL FILTRO ESTABA A MEDIAS Y NADIE LO VIO, porque este candado solo miraba los CONTEOS de pacientes.
  // La marca sacaba su diagnostico de las cifras y dejaba su DINERO dentro: el bruto, el ingreso de
  // CNV, las comisiones, lo que se deshizo y los insights contaban sus ventas igual que las de un paciente
  // real. Es el mismo defecto del inventario y de la RLS: marcar solo excluye donde alguien escribio que
  // excluya, y un barrido que no cubre una capa deja esa capa sin nadie.
  //
  // Lo descubrio la pregunta de Santiago sobre una venta de prueba de Maria Camila a un paciente suyo.
  it("las cifras de dinero excluyen las ventas de un paciente marcado", () => {
    const direccion = leer("src/modules/direccion/data/dashboard-reader.ts");
    // Las CUATRO a la vez: un bruto filtrado sobre comisiones sin filtrar hace que la resta entre ellas deje
    // de significar nada.
    expect(direccion).toContain("noEsPacienteDePrueba");
    expect(direccion).toContain("esOperacion");
    for (const cifra of ["pagadas", "cnvRows", "commissionRows", "devueltasRows"]) {
      expect(direccion, `la cifra ${cifra} no aplica el filtro del paciente`).toContain(cifra);
    }
    // ── SE EXIGE QUE EL FRAGMENTO SE USE, no que exista ──
    //
    // La primera version buscaba el nombre y NO atrapo el defecto: quitar su uso del corte deja la
    // declaracion en el archivo, asi que el nombre seguia apareciendo y el caso pasaba en verde. Es el mismo
    // error que ya cometi con el candado de la fecha de arranque. Aqui se mira la composicion del corte.
    const deshecho = leer("src/modules/direccion/data/lo-deshecho.ts");
    const i = deshecho.indexOf("const corte = sql");
    expect(i, "cambio como se arma el corte y este caso dejo de mirar nada").toBeGreaterThan(-1);
    expect(deshecho.slice(i, deshecho.indexOf(";", i))).toContain("sinPacienteDePrueba");
    expect(leer("src/modules/direccion/data/insights-de-la-compra.ts")).toContain("pa.cuenta_como_de_prueba");
    // Y el mes del propio profesional: quien se registra a si mismo para probar veia su mes inflado con sus
    // pruebas, en la pantalla que usa para saber como le fue.
    expect(leer("src/modules/dashboard/data/tablero-reader.ts")).toContain("noEsPacienteDePrueba");
  });

  it("la facturacion ya lo respetaba, y sigue", () => {
    const src = leer("src/modules/payments/data/facturacion-repository.ts");
    expect(src).toContain("cuentaComoDePrueba");
  });
});

describe("la lista del profesional SI los muestra, marcados", () => {
  it("el lector trae la marca y la propuesta", () => {
    const src = leer("src/modules/patients/data/patients-list-reader.ts");
    expect(src).toContain("cuenta_como_de_prueba, test_proposed_at");
    expect(src).toContain("esDePrueba:");
    expect(src).toContain("propuestoDePrueba:");
  });

  it("y NO los filtra, que es lo que la haria inutil para probar", () => {
    const src = leer("src/modules/patients/data/patients-list-reader.ts");
    expect(src).not.toContain('.eq("cuenta_como_de_prueba", false)');
  });
});

describe("solo admin confirma la marca", () => {
  it("el profesional propone y no marca", () => {
    const src = leer("src/modules/patients/data/de-prueba-writer.ts");
    // La propuesta NO toca is_test: si lo tocara, el profesional podria sacar de las cifras a un paciente
    // real sin que nadie lo revise, que es lo que la asimetria existe para impedir.
    const propuesta = src.slice(src.indexOf("export async function proponerPacienteDePrueba"), src.indexOf("export async function resolverPropuestaDePrueba"));
    expect(propuesta).not.toContain("is_test = true");
  });

  it("y las dos acciones de admin exigen canAccessAdmin", () => {
    const src = leer("src/modules/patients/actions.ts");
    const resolver = src.slice(src.indexOf("export async function resolverPropuestaDePruebaAction"));
    expect(resolver).toContain("canAccessAdmin(user)");
    const desmarcar = src.slice(src.indexOf("export async function desmarcarPacienteDePruebaAction"));
    expect(desmarcar).toContain("canAccessAdmin(user)");
  });

  it("los tres actos quedan en el audit", () => {
    const src = leer("src/modules/patients/data/de-prueba-writer.ts");
    expect(src).toContain("paciente.propuesto_de_prueba");
    expect(src).toContain("paciente.marcado_de_prueba");
    expect(src).toContain("paciente.desmarcado_de_prueba");
  });
});
