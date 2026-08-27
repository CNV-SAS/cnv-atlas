import { describe, expect, it } from "vitest";

import { cruzarAlergenos, cruzarPatron, resumenHallazgos, terminosDeAlergeno, type MenuEstructurado } from "@/modules/treatment/services/alergenos";

const menu = (alimentos: string[], tiempo = "Almuerzo"): MenuEstructurado => ({
  comidas: [{ tiempo, alimentos: alimentos.map((n) => ({ nombre: n })) }],
});

describe("cruce de alergenos: detecta lo que tiene que detectar", () => {
  it("el caso que lo origino: marisco declarado, camarones en el menu", () => {
    const h = cruzarAlergenos(menu(["Arroz blanco", "Camarones al ajillo"]), ["Mariscos"]);
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual({ alergeno: "Mariscos", tiempo: "Almuerzo", alimento: "Camarones al ajillo" });
  });

  it("el alergeno RARO, que es el que el profesional no adivina: texto libre de 'Otra'", () => {
    // La lista cerrada cubre los comunes. Este es el que se perdia cuando la glue tiraba el texto libre.
    const h = cruzarAlergenos(menu(["Ensalada de mango", "Pollo a la plancha"]), ["mango"]);
    expect(h).toHaveLength(1);
    expect(h[0].alimento).toBe("Ensalada de mango");
  });

  it("cruza por sinonimo: 'Leche' declarada, queso en el menu", () => {
    expect(cruzarAlergenos(menu(["Arepa con queso"]), ["Leche"])).toHaveLength(1);
  });

  it("dice en QUE comida, no solo que hay uno", () => {
    const dos: MenuEstructurado = {
      comidas: [
        { tiempo: "Desayuno", alimentos: [{ nombre: "Huevos revueltos" }] },
        { tiempo: "Cena", alimentos: [{ nombre: "Sopa de verduras" }] },
      ],
    };
    const h = cruzarAlergenos(dos, ["Huevo"]);
    expect(h).toHaveLength(1);
    expect(h[0].tiempo).toBe("Desayuno");
  });

  it("ignora tildes y mayusculas a los dos lados", () => {
    expect(cruzarAlergenos(menu(["Camarón apanado"]), ["MARISCOS"])).toHaveLength(1);
  });
});

describe("cruce de alergenos: NO se dispara donde no debe", () => {
  // Un detector que se dispara de mas es uno que el profesional aprende a ignorar, y entonces deja de
  // proteger el dia que acierta. Estos casos son tan importantes como los de arriba.
  it("'pan' no cruza con 'panela'", () => {
    expect(cruzarAlergenos(menu(["Agua de panela"]), ["Trigo"])).toHaveLength(0);
  });

  it("'sal' no cruza con 'salmon' (subcadena que no es palabra)", () => {
    // OJO: el termino llega YA pelado del centinela "Otra:" (lo hace la glue en build-engine-input).
    // Pasarlo aqui como "Otra: sal" haria pasar el test por la razon equivocada: seria una forma
    // COMPUESTA de dos palabras que no cruza nada, y no probaria la regla de palabra completa.
    expect(cruzarAlergenos(menu(["Salmón al horno"]), ["sal"])).toHaveLength(0);
    // Y el control: la misma palabra SI cruza cuando es palabra completa.
    expect(cruzarAlergenos(menu(["Sal marina en ensalada"]), ["sal"])).toHaveLength(1);
  });

  it("'Ninguna' es una respuesta, no un alergeno", () => {
    expect(terminosDeAlergeno(["Ninguna"])).toEqual([]);
    expect(cruzarAlergenos(menu(["Ninguna cosa rara"]), ["Ninguna"])).toHaveLength(0);
  });

  it("sin alergias declaradas no hay hallazgos", () => {
    expect(cruzarAlergenos(menu(["Camarones"]), [])).toHaveLength(0);
  });

  it("una forma COMPUESTA sigue siendo especifica: 'crema de leche' no cruza un menu sin lacteos", () => {
    expect(cruzarAlergenos(menu(["Crema de espinacas"]), ["Leche"])).toHaveLength(0);
  });
});

describe("cruce de alergenos: el aviso", () => {
  it("nombra alergeno, comida y alimento", () => {
    const h = cruzarAlergenos(menu(["Camarones al ajillo"]), ["Mariscos"]);
    expect(resumenHallazgos(h)).toBe("Mariscos en Almuerzo (Camarones al ajillo)");
  });

  it("sin hallazgos, el resumen es vacio", () => {
    expect(resumenHallazgos([])).toBe("");
  });
});

describe("cruce de alergenos: menus mal formados no tumban nada", () => {
  it("tolera comidas y alimentos ausentes", () => {
    expect(cruzarAlergenos({ comidas: [] }, ["Leche"])).toEqual([]);
    expect(cruzarAlergenos({} as MenuEstructurado, ["Leche"])).toEqual([]);
    expect(cruzarAlergenos({ comidas: [{ tiempo: "Cena" }] } as MenuEstructurado, ["Leche"])).toEqual([]);
  });
});

describe("cruce de patron alimentario", () => {
  it("el caso que Gildardo puso por delante: un vegano con pollo en el menu", () => {
    const c = cruzarPatron(menu(["Pechuga de pollo a la plancha", "Ensalada"]), ["Vegano"]);
    expect(c).toHaveLength(1);
    expect(c[0]).toEqual({ patron: "Vegano", tiempo: "Almuerzo", alimento: "Pechuga de pollo a la plancha" });
  });

  it("vegetariano tolera lacteos y huevo; vegano no", () => {
    expect(cruzarPatron(menu(["Huevos revueltos con queso"]), ["Vegetariano"])).toHaveLength(0);
    expect(cruzarPatron(menu(["Huevos revueltos con queso"]), ["Vegano"]).length).toBeGreaterThan(0);
  });

  it("'Ninguno' no es un patron", () => {
    expect(cruzarPatron(menu(["Pollo"]), ["Ninguno"])).toHaveLength(0);
  });

  it("un patron que no sabemos traducir a alimentos NO inventa hallazgos", () => {
    // Preferimos no decir nada a decir algo mal: un aviso inventado entrena a ignorar el mecanismo.
    expect(cruzarPatron(menu(["Pollo"]), ["Otra: dieta de mi abuela"])).toHaveLength(0);
  });

  it("no se dispara con un menu que si respeta el patron", () => {
    expect(cruzarPatron(menu(["Lentejas guisadas", "Arroz integral"]), ["Vegano"])).toHaveLength(0);
  });
});
