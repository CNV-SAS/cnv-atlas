import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  leyendaDeProfesionalDePrueba,
  SQL_SIN_PROFESIONAL_DE_PRUEBA,
} from "@/modules/professionals/de-prueba";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ EL BARRIDO DE "PROFESIONAL DE PRUEBA", CON SU CANDADO (0199, 2026-09-30) ═══
//
// EL PROBLEMA NO ES LA COLUMNA. Con los pacientes, `is_test` existia desde antes y se respetaba en UN SOLO
// sitio (la facturacion); en todo lo demas contaban igual que uno real. MARCAR SOLO EXCLUYE DONDE ALGUIEN
// ESCRIBIO QUE EXCLUYA, asi que el trabajo es el barrido, y un barrido sin candado se desarma en la
// siguiente pantalla que sume dinero.
//
// Y LA LECCION QUE LO HACE OBLIGATORIO es de esta misma semana, tres veces: la RLS que llego a tres tablas
// de seis, el `z.uuid()` que llego a dos archivos de seis, y el candado del submitter que cubria el helper
// y no el formulario. Aqui el sintoma seria un bruto sin Demo al lado de unas comisiones con Demo, y la
// diferencia leyendose como un defecto de una de las dos pantallas.

const raiz = process.cwd();
const leer = (rel: string) => sinComentarios(readFileSync(join(raiz, rel), "utf8"));

describe("las cifras de la organizacion no cuentan al profesional de demostracion", () => {
  it("el bruto, el ingreso de CNV y las comisiones de Direccion lo excluyen", () => {
    const src = leer("src/modules/direccion/data/dashboard-reader.ts");
    // LAS CUATRO A LA VEZ, y por eso se comprueban las cuatro: un bruto filtrado sobre comisiones sin
    // filtrar hace que la resta entre ellas deje de significar nada.
    expect(src).toContain('.eq("is_test", true)');
    for (const cifra of ["pagadas", "cnvRows", "commissionRows", "devueltasRows"]) {
      expect(src, `la cifra ${cifra} no aplica el filtro`).toContain(`${cifra}`);
    }
    expect(src).toContain("noEsDePrueba");
  });

  it("los insights lo excluyen por los DOS ejes: sus ventas y sus consultas", () => {
    const src = leer("src/modules/direccion/data/insights-de-la-compra.ts");
    // SI SALIERAN SUS VENTAS Y NO SUS CONSULTAS, sus prescripciones quedarian en el denominador sin ninguna
    // compra que pudiera cumplirlas, y la conversion de todos los productos bajaria por una cuenta de
    // demostracion. Es el defecto del "0 de 18" otra vez.
    expect(src).toContain("sinDemoEnLaVenta");
    expect(src).toContain("sinDemoEnLaConsulta");
  });

  it("lo que se deshizo lo excluye", () => {
    const src = leer("src/modules/direccion/data/lo-deshecho.ts");
    expect(src).toContain("SQL_SIN_PROFESIONAL_DE_PRUEBA");
  });
});

describe("las dos cosas que la marca NO hace, y son decisiones", () => {
  // EL CONTEO FISICO NO SE PIERDE: el desglose del integrante SI muestra sus unidades, marcadas. Lo que se
  // acota es la cifra de la organizacion, que es la que lee quien decide.
  it("el inventario SI se filtra por profesional, y esto cambio de decision", () => {
    const src = leer("src/modules/direccion/data/dashboard-reader.ts");
    // SE MIRA LA SENTENCIA COMPLETA, no una linea: el filtro ocupa varias, y buscar en una sola dejaba el
    // caso afirmando sobre un texto cortado. Fallo contra el arreglo correcto, que es como se descubrio.
    const i = src.indexOf("const inventoryRows");
    const linea = i < 0 ? null : src.slice(i, src.indexOf(";", i));
    expect(linea, "cambio el nombre de las filas de inventario y este caso dejo de mirar nada").toBeTruthy();
    // CAMBIO DE DECISION (Santiago, 2026-10-01): yo habia decidido que la marca no tocara el inventario,
    // porque las unidades son fisicas. Santiago lo decidio al reves y su razon pesa mas AQUI: quien entra a
    // /direccion no sabe que esas unidades son de una cuenta de demostracion, y una cifra que confunde a
    // quien decide es peor que una cifra incompleta. Lo que la hace honesta es que la tarjeta lo diga.
    expect(linea).toContain("noEsDePrueba");
  });

  // LA FACTURA LA DECIDE EL PACIENTE, y tiene que seguir siendo asi: un profesional de prueba que le venda
  // a un paciente REAL tiene que emitir su factura igual, porque la venta ocurrio. El caso malo no es una
  // factura de mas, es una venta real sin factura.
  it("la facturacion NO mira al profesional", () => {
    const src = leer("src/modules/payments/facturacion.ts");
    expect(src).toContain("motivoSiPacienteYAmbienteNoCuadran");
    expect(src).not.toContain("profesionalEsDePrueba");
  });
});

describe("la lista SI lo muestra, marcado", () => {
  it("admin trae la marca y la enseña", () => {
    const src = leer("src/app/(app)/admin/page.tsx");
    expect(src).toContain("is_test");
    expect(src).toContain("leyendaDeProfesionalDePrueba");
  });

  it("y la leyenda dice lo que no cambia, no solo lo que cambia", () => {
    const leyenda = leyendaDeProfesionalDePrueba(true) ?? "";
    expect(leyenda).toContain("no cuenta en las cifras");
    // Sin esta mitad, alguien supone que sus facturas o su inventario son de mentira.
    expect(leyenda).toContain("inventario");
    expect(leyenda).toContain("facturas");
    expect(leyendaDeProfesionalDePrueba(false)).toBeNull();
  });
});

describe("el filtro compartido no se reescribe al lado", () => {
  // UNA SOLA REDACCION DEL FILTRO. Dos lectores que escriban su propia version del mismo `not exists`
  // terminan discrepando el dia que uno de los dos se corrija, y entonces dos pantallas dicen cifras
  // distintas del mismo hecho. Ya paso con el bruto de Inicio y el de Direccion.
  it("es una sola cadena, y nombra la columna que gobierna", () => {
    expect(SQL_SIN_PROFESIONAL_DE_PRUEBA).toContain("professional_profiles");
    expect(SQL_SIN_PROFESIONAL_DE_PRUEBA).toContain("is_test");
    expect(SQL_SIN_PROFESIONAL_DE_PRUEBA).toContain("t.professional_id");
  });
});
