import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  avisoDeEdadDiscordante,
  discordanciaDeEdad,
  DIFERENCIA_DE_EDAD_TOLERADA,
} from "@/clinical-engine/edad-discordante";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DEL ERROR 5: LA EDAD DE LA FICHA CONTRA LA DEL EQUIPO
//
// Tabla 1 de su entrega del 2026-10-26, error 5: *"La edad de ATLAS no coincide con la del equipo · 6
// casos (diferencias de 3 a 20 años) · si hay discrepancia mayor de 1 año, ALERTAR ANTES DE CALCULAR."*
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("el umbral es el suyo, y el corte es ESTRICTO", () => {
  it("un año de diferencia NO avisa: eso lo explica el redondeo del equipo", () => {
    // El equipo reporta la edad con decimales y la sube (su error 6: 30,95 pasa a 31); Atlas trunca a
    // años cumplidos. Un año de diferencia es lo NORMAL entre esas dos lecturas, y avisar de lo normal
    // convierte el aviso en ruido que se deja de leer.
    expect(DIFERENCIA_DE_EDAD_TOLERADA).toBe(1);
    expect(discordanciaDeEdad(30, 31)).toBeNull();
    expect(discordanciaDeEdad(31, 30)).toBeNull();
    expect(discordanciaDeEdad(43, 43)).toBeNull();
  });

  it("mas de un año SI avisa, en los dos sentidos", () => {
    expect(discordanciaDeEdad(30, 32)?.diferencia).toBe(2);
    expect(discordanciaDeEdad(32, 30)?.diferencia).toBe(2);
  });

  it("sus SEIS casos del anexo A avisan, uno por uno", () => {
    // Si alguien relaja el umbral, estos seis dejan de avisar y el defecto que motivo la regla vuelve.
    const suyos: [number, number, number][] = [
      [23, 14, 9],
      [34, 43, 9],
      [39, 42, 3],
      [52, 72, 20],
      [54, 35, 19],
      [58, 67, 9],
    ];
    for (const [ficha, equipo, diferencia] of suyos) {
      const d = discordanciaDeEdad(ficha, equipo);
      expect(d, `el caso ${ficha}/${equipo} dejo de avisar`).not.toBeNull();
      expect(d?.diferencia).toBe(diferencia);
    }
  });

  it("la del equipo se TRUNCA antes de comparar, no se redondea", () => {
    // Comparar 30,95 contra 30 daria 0,95 (que no significa nada) y comparar su redondeo 31 daria 1 (que
    // el umbral estricto ya deja pasar). Truncando, los dos lados miden lo mismo: años cumplidos.
    expect(discordanciaDeEdad(30, 30.95)).toBeNull();
    expect(discordanciaDeEdad(30, 32.95)?.edadDelEquipo).toBe(32);
  });
});

describe("no se afirma una discordancia sobre un dato que falta", () => {
  it("sin una de las dos edades, no hay aviso", () => {
    // "No coinciden" no se puede decir si una no se tiene. Lo que falta ya lo dice quien corresponde: la
    // ficha sin fecha de nacimiento deja la EB-BIS en "pendiente", con su motivo.
    for (const par of [
      [null, 43],
      [43, null],
      [null, null],
      [undefined, 43],
      [43, Number.NaN],
    ] as const) {
      expect(discordanciaDeEdad(par[0], par[1]), `${par[0]}/${par[1]} no debia avisar`).toBeNull();
    }
  });
});

describe("el aviso dice las dos cifras, no elige, y dice donde mirar", () => {
  it("lleva las dos edades y la diferencia", () => {
    const texto = avisoDeEdadDiscordante(discordanciaDeEdad(52, 72)!);
    expect(texto).toContain("52 años");
    expect(texto).toContain("72 años");
    expect(texto).toContain("20 años");
  });

  it("y manda a verificar la fecha de nacimiento, que es la fuente que su correccion unifica", () => {
    // Un aviso que solo dice "no coinciden" deja a quien lo lee sin saber donde mirar. Y no elige una de
    // las dos como buena, porque el sistema no lo sabe.
    const texto = avisoDeEdadDiscordante(discordanciaDeEdad(23, 14)!);
    expect(texto).toContain("fecha de nacimiento");
    expect(texto.toLowerCase(), "el aviso elige una de las dos edades por su cuenta").not.toMatch(
      /la correcta es|la buena es|usa la del/,
    );
  });
});

describe("avisa y NO frena", () => {
  it("ni el modulo ni el componente lanzan ni bloquean", () => {
    // Dice "alertar", no "rechazar". Frenar dejaria al paciente sin diagnostico mientras la unica persona
    // que puede resolverlo se queda sin ver el problema. Y un freno que LANZA desde una accion es un 500
    // con la pantalla caida, que ya paso.
    for (const f of [
      "src/clinical-engine/edad-discordante.ts",
      "src/modules/bis/components/aviso-de-edad-discordante.tsx",
    ]) {
      const fuente = sinComentarios(readFileSync(f, "utf8"));
      expect(fuente, `${f} lanza`).not.toMatch(/\bthrow\b/);
      expect(fuente, `${f} bloquea`).not.toMatch(/disabled|ClinicalInputError/);
    }
  });

  it("se lee en la pagina con catch, y se pinta en Antrop. & BIS", () => {
    // Un aviso que tumba la pantalla donde se trabaja es peor que un aviso que falta: mismo patron que la
    // huella repetida.
    const pagina = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
    expect(pagina).toContain("edadDiscordanteDeLaConsulta(id).catch");
    expect(pagina).toContain("avisoDeEdadDelEquipo: <AvisoDeEdadDiscordante");
    const entrada = sinComentarios(
      readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8"),
    );
    const i = entrada.indexOf("{composition ? avisoDeEdadDelEquipo : null}");
    const j = entrada.indexOf("Medición BIS");
    expect(i, "el aviso desaparecio del panel").toBeGreaterThan(0);
    expect(i, "el aviso quedo debajo de la medicion").toBeLessThan(j);
  });

  it("y la edad de la ficha sale de la MISMA funcion que usa el motor", () => {
    // Si el lector escribiera su propia lectura de la fecha, compararia una edad que el motor no usa: el
    // aviso podria avisar de una discordancia que el calculo no tiene, o callarse sobre una que si. Dos
    // definiciones de "edad" en la casa acaban diciendo que el mismo paciente tiene dos edades, que es
    // literalmente el defecto que esto vigila.
    const lector = sinComentarios(
      readFileSync("src/modules/bis/data/edad-del-equipo-reader.ts", "utf8"),
    );
    expect(lector).toContain("edadSiSePuede(");
    expect(lector, "el lector escribe su propia aritmetica de fechas").not.toMatch(
      /getUTCFullYear|getFullYear/,
    );
    // Y a la fecha de la MEDICION, como el motor, no a la de hoy.
    expect(lector).toContain("measurement_date");
    expect(lector, "mide la edad a la fecha de hoy").not.toContain("new Date()");
  });
});
