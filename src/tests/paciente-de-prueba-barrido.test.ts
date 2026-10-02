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

  // ═══ Y AQUI LA REGLA CAMBIO DE SIGNO, CON SU RAZON (Santiago, 2026-10-01) ═══
  //
  // Este caso exigia que la pantalla del integrante EXCLUYERA sus pacientes de prueba, y la razon original
  // era buena: "un integrante que creo tres pacientes para probar figuraba con tres pacientes de mas justo
  // en la pantalla que existe para verificar". Valia para un integrante REAL con tres pruebas.
  //
  // SE ROMPIO CON UNA CUENTA DE DEMOSTRACION: la pantalla decia "Pacientes asignados: 0" al lado de "Lo que
  // ha vendido: 3.542.000 en 22 ventas". Si no tiene pacientes, ¿a quien le vendio? La pantalla se
  // contradecia a si misma, que es el defecto que mas nos ha costado este mes.
  //
  // LO QUE DECIDE ES EL ROTULO, igual que en el tablero de admin: esta pantalla es el HISTORIAL DE UNA
  // PERSONA y dice "pacientes asignados", no "pacientes que cuentan". Asi que cuenta a todos los suyos y el
  // pie dice cuantos no cuentan en las cifras. La capa 1 (las cifras de la ORGANIZACION no cuentan lo de
  // prueba) sigue protegida por los casos de arriba, que son los que miran /direccion y los insights.
  it("la pantalla del integrante cuenta TODOS los suyos, y dice cuantos no cuentan", () => {
    const src = leer("src/modules/payments/data/integrante-reader.ts");
    expect(src).toContain("join patients p on p.id = r.patient_id");
    // El filtro ya NO esta en el conteo, a proposito.
    expect(src).not.toContain("coalesce(p.cuenta_como_de_prueba, false) = false");
    // Y la lista si trae la marca, que es de donde sale el pie de la tarjeta y el rotulo de cada fila.
    expect(src).toContain("cuenta_como_de_prueba");
    const pantalla = leer("src/app/(app)/admin/integrantes/[id]/page.tsx");
    expect(pantalla, "la tarjeta dejo de decir cuantos no cuentan").toContain("pacientesDePrueba");
    // Y EL AVISO QUE EXPLICA LAS CIFRAS: sin el, ver 3.542.000 aqui y 0 en /direccion se lee como defecto.
    expect(pantalla).toContain("Es una cuenta de demostración");
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
  // ═══ Y CON LA 0203 ESTE CASO CAMBIO DE FORMA, que es la lección de las seis ═══
  //
  // Antes exigía que CADA pantalla aplicara el filtro del paciente. Eso no atrapó ninguno de los seis
  // defectos, y la sexta explicó por qué: las dos pantallas CUMPLÍAN la regla y daban distinto, porque cada
  // una armaba su propio universo (una pedía los pacientes marcados bajo la RLS del profesional).
  //
  // Ahora la pregunta tiene UNA respuesta guardada, mantenida por trigger con las tres marcas, y lo que se
  // vigila es que los lectores LA LEAN en vez de reconstruirla. El comportamiento lo prueba el candado
  // contra la base de esa columna.
  it("los lectores del dinero leen la columna, en vez de reconstruir la regla", () => {
    for (const f of [
      "src/modules/direccion/data/dashboard-reader.ts",
      "src/modules/dashboard/data/tablero-reader.ts",
    ]) {
      expect(leer(f), `${f} no lee la columna de la venta`).toContain("COLUMNA_VENTA_DE_PRUEBA");
    }
    // Los dos lectores en SQL, con la misma columna.
    for (const f of [
      "src/modules/direccion/data/lo-deshecho.ts",
      "src/modules/direccion/data/insights-de-la-compra.ts",
    ]) {
      expect(leer(f), `${f} no lee la columna de la venta`).toContain("not t.cuenta_como_de_prueba");
    }
    // Y EL HISTÓRICO PREGUNTA OTRA COSA, a propósito: mira paciente y producto, NO la marca del profesional,
    // porque es SU pantalla. Hay una sola copia de cada pregunta; lo que no puede haber es la misma dos veces.
    expect(leer("src/modules/payments/data/historico-del-profesional.ts")).toContain(
      "cuenta_como_de_prueba",
    );
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
