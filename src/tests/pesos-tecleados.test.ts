import { describe, expect, it } from "vitest";

import { enteroDeTexto, pesosDeTexto } from "@/core/pesos";

// ═══ LO QUE LA GENTE TECLEA DE VERDAD (Santiago, 2026-09-25) ═══
//
// La venta retroactiva pide el precio que tenía el producto ese día, y el primer intento real lo rechazó con
// "Revisa los productos, las cantidades y los precios". La causa no era el precio: era `Number()`.
//
// Y el caso GRAVE no es el rechazo, es el que PASABA: `Number("11.900")` da 11,9, así que una venta de once
// mil novecientos se habría registrado como doce pesos, y de ahí a la comisión, a la liquidación y a las
// cifras de Dirección, sin que nada avisara. Un rechazo se ve; un 11,9 que pasa, no.

describe("una cifra en pesos tecleada por una persona", () => {
  it("LOS DOS SEPARADORES DE MILES, que es lo que la gente escribe", () => {
    expect(pesosDeTexto("11900")).toBe(11900);
    expect(pesosDeTexto("11.900")).toBe(11900);
    expect(pesosDeTexto("11,900")).toBe(11900);
    expect(pesosDeTexto("1.234.567")).toBe(1234567);
    expect(pesosDeTexto("1,234,567")).toBe(1234567);
  });

  it("y los decimales, que se distinguen por el TAMAÑO del último grupo", () => {
    // Nadie escribe "11,500" queriendo decir once con quinientas milésimas: tres dígitos son miles.
    expect(pesosDeTexto("11,5")).toBe(11.5);
    expect(pesosDeTexto("11,50")).toBe(11.5);
    expect(pesosDeTexto("11.5")).toBe(11.5);
    expect(pesosDeTexto("11.900,50")).toBe(11900.5);
    expect(pesosDeTexto("1.234.567,89")).toBe(1234567.89);
  });

  it("con lo que la acompaña sin ser parte de ella", () => {
    expect(pesosDeTexto("$11.900")).toBe(11900);
    expect(pesosDeTexto(" 11900 ")).toBe(11900);
    expect(pesosDeTexto("11900 COP")).toBe(11900);
  });

  it("lo que NO se puede leer con certeza queda en null, no se adivina", () => {
    // Adivinar aquí es escribir una cifra de dinero que nadie tecleó.
    expect(pesosDeTexto("")).toBeNull();
    expect(pesosDeTexto("mil")).toBeNull();
    expect(pesosDeTexto("11.900.")).toBeNull();
    expect(pesosDeTexto("-500")).toBeNull();
  });

  it("y la cantidad exige un entero", () => {
    expect(enteroDeTexto("2")).toBe(2);
    expect(enteroDeTexto("1.000")).toBe(1000);
    expect(enteroDeTexto("2,5")).toBeNull();
  });

  it("EL CASO QUE SE COLABA: 11.900 ya no vale once pesos con nueve", () => {
    expect(Number("11.900"), "control: así lo leía JavaScript").toBe(11.9);
    expect(pesosDeTexto("11.900"), "y así lo lee una persona").toBe(11900);
  });
});
