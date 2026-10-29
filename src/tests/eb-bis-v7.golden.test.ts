import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ebBisV7, EB_BIS_V7 } from "@/clinical-engine/frozen/eb-bis-v7.js";

import casos from "../../docs/entregas/Gildardo responses/EB_BIS_v7_param_7.1.0_Santiago/casos.json";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// GOLDEN DE LA EB-BIS v7 (parametros 7.1.0)
//
// ═══ DE DONDE SALE ═══
//
// Entrega de Gildardo del 2026-10-26: `EB_BIS_v7_Especificacion_ATLAS_CNV_param_7.1.0`, su §7 "Pruebas de
// aceptacion": *"El motor implementado debe reproducir estos resultados con una tolerancia de ±0,1 años en
// EB-BIS e IAE y la misma alerta. Los datos provienen de evaluaciones reales de ATLAS (archivo
// casos.json)."*
//
// ═══ POR QUE ESTE GOLDEN NO ES CIRCULAR, Y ES LA PARTE QUE IMPORTA ═══
//
// Los valores esperados NO los calculamos nosotros: los calculo EL, con su propia implementacion, sobre
// siete evaluaciones reales, y los escribio en su tabla 4. El candado corre NUESTRA copia de su funcion
// contra SUS cifras. Si alguien toca un parametro, un signo o un redondeo, siete casos fallan a la vez.
//
// Y SE LEE SU `casos.json` DIRECTO, sin copiarlo a un fixture: una copia es una segunda fuente que se
// desincroniza en silencio el dia que el mande otros casos. Regla 6 (ARCHITECTURE.md): ninguna version del
// motor sin golden tests que prueben paridad con la referencia.
//
// ═══ LOS TRES CASOS QUE EL ELIGIO A PROPOSITO (su tabla 4) ═══
//
// *"El caso de 25 años verifica el tope de +15; el de 37 años, la alerta de discordancia; el de 72 años, el
// esperado curvo."* Van nombrados abajo, uno por uno, porque un golden que solo cuenta siete casos verdes
// no dice que se perdio cuando falla.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

type CasoDeGildardo = {
  evaluacion: string;
  sexo: "F" | "M";
  edad: number;
  Re: number;
  Ri: number;
  C: number;
  peso: number;
  MLG: number;
  ACT: number;
  FMI: number;
  ICEC: number | null;
  esperado: { EB_BIS: number; IAE: number; zPares: number; alerta: boolean };
};

const CASOS = casos as CasoDeGildardo[];

/**
 * Su tolerancia, literal: ±0,1 años en EB-BIS e IAE.
 *
 * SE COMPARA A MANO Y NO CON `toBeCloseTo`, que recibe DIGITOS y no una tolerancia: `toBeCloseTo(76.4,
 * 0.1)` admite ±0,5, cinco veces lo que el autorizo, y pasaria verde con una EB equivocada en medio año.
 */
const TOLERANCIA_ANIOS = 0.1;

const dentroDeTolerancia = (obtenido: number, esperado: number, tol = TOLERANCIA_ANIOS) =>
  Math.abs(obtenido - esperado) <= tol + 1e-9;

const correr = (c: CasoDeGildardo) =>
  ebBisV7({
    sexo: c.sexo,
    edad: c.edad,
    Re: c.Re,
    Ri: c.Ri,
    C: c.C,
    peso: c.peso,
    MLG: c.MLG,
    ACT: c.ACT,
    FMI: c.FMI,
    ICEC: c.ICEC,
  });

describe("los siete casos de aceptacion de su §7", () => {
  it("CONTROL: son SIETE casos y se cargaron de su archivo", () => {
    // Sin esto, todo lo de abajo pasaria verde con un arreglo vacio: `for` sobre nada no falla nunca. Y la
    // cifra es la suya, no una nuestra: si su proxima entrega trae ocho casos, este candado lo dice en vez
    // de ignorar el octavo.
    expect(CASOS, "no se cargo casos.json").toHaveLength(7);
    for (const c of CASOS) {
      expect(c.esperado, `el caso ${c.evaluacion.slice(0, 8)} no trae su esperado`).toBeTruthy();
    }
  });

  it.each(CASOS.map((c) => [c.evaluacion.slice(0, 8), c] as const))(
    "%s reproduce su EB-BIS, su IAE y su alerta",
    (_codigo, c) => {
      const r = correr(c);
      expect(r.estado, `${_codigo}: el motor no calculo`).toBe("ok");
      if (r.estado !== "ok") return;
      expect(
        dentroDeTolerancia(r.EB_BIS, c.esperado.EB_BIS),
        `${_codigo}: EB-BIS ${r.EB_BIS} contra su ${c.esperado.EB_BIS}`,
      ).toBe(true);
      expect(
        dentroDeTolerancia(r.IAE, c.esperado.IAE),
        `${_codigo}: IAE ${r.IAE} contra su ${c.esperado.IAE}`,
      ).toBe(true);
      expect(r.alertaDiscordancia, `${_codigo}: alerta de discordancia`).toBe(c.esperado.alerta);
      // La z de pares va con dos decimales (su §5) y tambien esta en su archivo: si coincide la z pero no
      // la EB, el defecto esta en la escala o el tope; si no coincide la z, esta en el nucleo o el
      // esperado. Comprobar las dos dice CUAL de los dos se rompio.
      expect(
        dentroDeTolerancia(r.zPares, c.esperado.zPares, 0.01),
        `${_codigo}: z de pares ${r.zPares} contra su ${c.esperado.zPares}`,
      ).toBe(true);
    },
  );

  it("el caso de 25 años verifica el TOPE de +15, y lo marca", () => {
    const c = CASOS.find((x) => x.edad === 25);
    expect(c, "desaparecio el caso del tope").toBeTruthy();
    const r = correr(c!);
    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.IAE, "el tope dejo de aplicarse").toBe(15);
    expect(r.topado, "el tope se aplico pero no se marca, y su §5 pide decirlo").toBe(true);
    expect(EB_BIS_V7.topeAnios).toBe(15);
  });

  it("el caso de 37 años verifica la ALERTA de discordancia", () => {
    // Su regla: z de pares >= 1 con ICEC >= 80. Es el unico de los siete que la activa.
    const c = CASOS.find((x) => x.edad === 37);
    const r = correr(c!);
    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.alertaDiscordancia).toBe(true);
    expect(r.zPares).toBeGreaterThanOrEqual(1);
    expect(c!.ICEC).toBeGreaterThanOrEqual(80);
    expect(CASOS.filter((x) => x.esperado.alerta)).toHaveLength(1);
  });

  it("el caso de 72 años verifica el ESPERADO CURVO, que es el cambio de 7.1.0", () => {
    // Lo que el esperado curvo corrige (su tabla 0): *"el exceso de acelerados en mayores de 70 años,
    // porque el deterioro se acelera despues de los 60"*. Con la RECTA de 7.0.0 este caso saldria
    // acelerado; con el termino de edad² sale en -1,4. Si alguien quita el edad², este es el que lo dice.
    const c = CASOS.find((x) => x.edad === 72);
    const r = correr(c!);
    expect(r.estado).toBe("ok");
    if (r.estado !== "ok") return;
    expect(r.IAE).toBeLessThan(0);
    // Y el termino existe en los dos sexos, con el signo que el dio (positivo: la curva se dobla arriba).
    expect(EB_BIS_V7.F.esperado.edad2).toBeGreaterThan(0);
    expect(EB_BIS_V7.M.esperado.edad2).toBeGreaterThan(0);
  });
});

describe("sus cuatro pruebas adicionales de validacion (§7)", () => {
  const base = CASOS[0];

  it("edad 17 o vacia: devuelve pendiente por edad no valida", () => {
    // Su error 7: *"La EB-BIS no aplica a menores de 18 años"*. Y 18 es de 7.1.0: en 7.0.0 eran 16.
    for (const edad of [17, 0, Number.NaN, 101]) {
      const r = ebBisV7({ ...base, edad });
      expect(r.estado, `edad ${edad} no quedo pendiente`).toBe("pendiente");
      if (r.estado === "ok") return;
      expect(r.motivo).toContain("edad no válida");
    }
    // Y 18 SI calcula: el corte es el suyo, no uno mas conservador nuestro.
    expect(ebBisV7({ ...base, edad: 18 }).estado).toBe("ok");
  });

  it("cualquier entrada faltante o en cero: pendiente CON EL NOMBRE del dato", () => {
    // El nombre es la mitad util del estado: "pendiente" a secas manda a buscar en siete campos.
    for (const campo of ["Re", "Ri", "C", "peso", "MLG", "ACT", "FMI"] as const) {
      const r = ebBisV7({ ...base, [campo]: 0 });
      expect(r.estado, `${campo} en cero no quedo pendiente`).toBe("pendiente");
      if (r.estado === "ok") return;
      expect(r.motivo, `el motivo no nombra ${campo}`).toContain(campo);
    }
  });

  it("PSSG/peso fuera de 0,05 a 0,40: devuelve REVISAR, que no es lo mismo que pendiente", () => {
    // "revisar" es una medicion que no cuadra (se mira), "pendiente" es un dato que falta (se captura).
    // Colapsarlos perderia lo que el profesional necesita para actuar.
    const seco = ebBisV7({ ...base, MLG: base.peso * 0.9, ACT: 1 }); // PSSGp ~ 0,88
    expect(seco.estado).toBe("revisar");
    const aguado = ebBisV7({ ...base, MLG: 10, ACT: 9.9 }); // PSSGp ~ 0,002
    expect(aguado.estado).toBe("revisar");
  });

  it("ICEC ausente: calcula la EB-BIS y NO activa la alerta", () => {
    // Es el cambio de fondo frente a la v5: *"El ICEC ya no entra al calculo. La EB-BIS se calcula aunque
    // la encuesta no este completa"* (su §2). Con la v5, sin ICEC no habia EB-BIS.
    const elDeLaAlerta = CASOS.find((x) => x.esperado.alerta)!;
    const conIcec = correr(elDeLaAlerta);
    const sinIcec = ebBisV7({ ...elDeLaAlerta, ICEC: null });
    expect(sinIcec.estado).toBe("ok");
    if (sinIcec.estado !== "ok" || conIcec.estado !== "ok") return;
    expect(sinIcec.EB_BIS, "el ICEC movio la EB-BIS, y en la v7 no entra al calculo").toBe(
      conIcec.EB_BIS,
    );
    expect(sinIcec.alertaDiscordancia, "la alerta se activo sin ICEC").toBe(false);
  });
});

describe("el archivo del frozen es el que el entrego, byte a byte", () => {
  it("no se le corrigio nada al integrarlo", () => {
    // Su §4.4: *"La funcion adjunta implementa exactamente la especificacion... Puede integrarse tal cual
    // al motor."* Asi que esta es la regla 12 de ARCHITECTURE.md en su forma mas literal: el archivo no se
    // edita. Un `prettier --write` o un "arreglo" de estilo rompe la trazabilidad con lo que el firmo, y
    // sin este candado nadie se enteraria.
    const enElMotor = readFileSync("src/clinical-engine/frozen/eb-bis-v7.js", "utf8");
    const comoLlego = readFileSync(
      "docs/entregas/Gildardo responses/EB_BIS_v7_param_7.1.0_Santiago/ebBisV7.js",
      "utf8",
    );
    expect(enElMotor, "el frozen de la v7 ya no es identico al archivo que entrego").toBe(comoLlego);
  });

  it("y los parametros son los de 7.1.0, no los de 7.0.0", () => {
    // Los 7.0.0 vivieron dos dias y tenian la DE residual y la recta viejas. Si alguien reinstala la
    // entrega del 24 por error, esto lo para: las cuatro cifras que cambiaron van nombradas.
    expect(EB_BIS_V7.version).toBe("7.1.0");
    expect(EB_BIS_V7.F.deResidual, "DE residual femenina de 7.0.0 (era 3,75)").toBe(2.793);
    expect(EB_BIS_V7.M.deResidual, "DE residual masculina de 7.0.0 (era 5,91)").toBe(5.165);
    expect(EB_BIS_V7.escalaAniosPorDE, "la escala de 5 años por DE, ya definitiva").toBe(5);
  });

  it("y NO hay rastro del metodo por marcador con logaritmos, que su §1 excluye", () => {
    // Literal: *"La EB-BIS v7 no usa referencias por marcador con logaritmos de IFC, IRC, PABU o C. Si
    // algun documento o mensaje describe ese metodo, no corresponde a la v7 y no debe implementarse."*
    // Esa contradiccion estuvo viva entre el 24 y el 26, asi que el candado la cierra.
    const fuente = readFileSync("src/clinical-engine/frozen/eb-bis-v7.js", "utf8");
    for (const rastro of ["Math.log", "PABU", "IFC"]) {
      expect(fuente, `aparecio ${rastro} en la v7`).not.toContain(rastro);
    }
  });
});
