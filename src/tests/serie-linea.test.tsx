import { describe, expect, it } from "vitest";

import { SerieLinea } from "@/modules/followups/components/serie-linea";

// CANDADO DEL GRAFICO DE SERIE, escrito sobre lo que salió del smoke del 2026-09-02.
//
// LAS DOS COSAS QUE SE COMPRUEBAN son de naturaleza distinta y por eso van juntas: la que decide sobre un
// paciente (el color del tramo) y la que se ve mal (las etiquetas de los extremos). La segunda solo se ve
// en un navegador; la primera no se puede dejar a la vista.

// Render mínimo a cadena: no hay jsdom en el proyecto `unit`, y para lo que se comprueba (qué atributos
// emite el componente) basta con recorrer el árbol de React que devuelve.
type Nodo = { type?: unknown; props?: { children?: unknown; [k: string]: unknown } };
function planos(n: unknown, out: Nodo[] = []): Nodo[] {
  if (Array.isArray(n)) {
    for (const x of n) planos(x, out);
    return out;
  }
  if (!n || typeof n !== "object") return out;
  const nodo = n as Nodo;
  out.push(nodo);
  planos(nodo.props?.children, out);
  return out;
}

const render = (props: Parameters<typeof SerieLinea>[0]) => planos(SerieLinea(props));

describe("el color del tramo cuando hay referencia: mejorar es ACERCARSE", () => {
  // La regla de Gildardo (2026-08-27 §9), y es la que no se puede relajar: la capacitancia sube con el
  // IMC, así que pintar de verde "el que sube" afirmaría lo contrario de lo que él sostiene.
  const REF = 1.27; // mediana de Mujeres 60-69, la del caso del smoke

  const lineas = (a: number, b: number) =>
    render({
      puntos: [
        { fecha: "2026-05-01", valor: a },
        { fecha: "2026-08-20", valor: b },
      ],
      referencia: REF,
      referenciaLabel: "Mediana Mujeres 60-69",
      subirEsMejor: null,
      ariaLabel: "test",
    })
      .filter((n) => n.type === "line" && String(n.props?.className ?? "").includes("stroke-clinical"))
      .map((n) => String(n.props?.className));

  it("BAJANDO hacia la mediana: verde (es el caso del smoke, 2,000 -> 1,600 con mediana 1,27)", () => {
    expect(lineas(2.0, 1.6)[0]).toContain("stroke-clinical-optimal");
  });

  it("y BAJANDO de más, pasándose por debajo: rojo, aunque siga bajando", () => {
    // El caso que distingue "acercarse" de "bajar". Sin él, el test de arriba pasaría verde también con
    // una regla que solo mirara el signo.
    expect(lineas(1.3, 0.5)[0]).toContain("stroke-clinical-critical");
  });

  it("SUBIENDO hacia la mediana: verde, aunque suba", () => {
    expect(lineas(0.8, 1.2)[0]).toContain("stroke-clinical-optimal");
  });

  it("SUBIENDO alejándose: rojo", () => {
    expect(lineas(1.6, 2.0)[0]).toContain("stroke-clinical-critical");
  });

  it("y SIN referencia ni dirección conocida, ningún tramo se colorea", () => {
    const l = render({
      puntos: [
        { fecha: "2026-05-01", valor: 2.0 },
        { fecha: "2026-08-20", valor: 1.6 },
      ],
      subirEsMejor: null,
      ariaLabel: "test",
    }).filter((n) => n.type === "line" && String(n.props?.className ?? "").includes("stroke-clinical"));
    expect(l).toEqual([]);
  });
});

describe("las etiquetas de los extremos no se salen del gráfico", () => {
  // Lo que se vio en el smoke: el valor del primer punto encima de la columna de números del eje, y las
  // dos fechas cortadas contra el marco. Pasa porque `textAnchor="middle"` centra el texto sobre el borde
  // del área de dibujo, así que la mitad queda fuera.
  const textos = render({
    puntos: [
      { fecha: "2026-05-01", valor: 2.0 },
      { fecha: "2026-06-15", valor: 1.8 },
      { fecha: "2026-08-20", valor: 1.6 },
    ],
    referencia: 1.27,
    subirEsMejor: null,
    ariaLabel: "test",
  }).filter((n) => n.type === "text");

  it("el primero ancla por su inicio y el último por su final; los del medio siguen centrados", () => {
    const anclas = textos.map((t) => t.props?.textAnchor);
    expect(anclas).toContain("start");
    expect(anclas).toContain("end");
    expect(anclas).toContain("middle");
  });

  it("y con UN SOLO punto se queda centrado: ahí no hay borde contra el que chocar", () => {
    const uno = render({
      puntos: [{ fecha: "2026-08-20", valor: 1.6 }],
      subirEsMejor: null,
      ariaLabel: "test",
      // Se descartan las etiquetas del EJE, que anclan en "end" a proposito y viven a la izquierda del
      // area de dibujo (x < PAD_L). Sin este filtro el test cazaba los numeros del eje y no el punto.
    }).filter((n) => n.type === "text" && Number(n.props?.x) > 52);
    // Ninguno de los dos textos del punto (valor y fecha) ancla en un extremo.
    expect(uno.every((t) => t.props?.textAnchor !== "start" && t.props?.textAnchor !== "end")).toBe(true);
  });
});
