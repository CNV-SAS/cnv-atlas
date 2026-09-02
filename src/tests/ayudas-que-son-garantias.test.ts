import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LA PODA (cotejo visual 2026-08-31, punto 4). Santiago, leyendo la pantalla al lado de la de
// Gildardo: "Atlas explica demasiado". Es cierto, y la poda quito los parrafos que decian lo que la
// pantalla ya dice ("el total se recalcula abajo", con el total abajo) o lo que un nutricionista sabe
// ("dentro de un grupo los alimentos son equivalentes" es la definicion de lista de intercambio).
//
// PERO EL CRITERIO NO ES "MENOS TEXTO". Su instruccion al aprobarla: "verifica al podar si alguno de los
// doce dice algo que no se ve en ningun otro sitio. Si lo hay, se queda". Los que quedaron no son ayuda:
// son GARANTIAS. Cada uno responde a algo que ya nos costo un defecto o una duda real, y este candado
// existe porque la proxima poda va a mirar la pantalla, no esta historia, y van a parecer texto de mas.
//
// La forma de las aserciones tambien es deliberada: se afirma la FRASE, no el parrafo. Una frase puede
// reordenarse o acortarse sin perder la garantia; lo que no puede es desaparecer.

// Se compara con los espacios COLAPSADOS: en JSX una frase se parte por el ancho de linea, asi que anclar
// al salto exacto convertiria este candado en un detector de reformateo. Lo que tiene que resistir es que
// alguien BORRE la frase, no que la vuelva a envolver.
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const PLANO = PANEL.replace(/\s+/g, " ");
const frasePlana = (f: string) => f.replace(/\s+/g, " ");

const GARANTIAS: [string, string, string][] = [
  [
    "dos gastos, no uno",
    "la base del plan es el",
    "El equipo mide un gasto y la cadena calcula otro. Dos numeros del mismo concepto en la misma pantalla: sin decir cual gobierna, el profesional no sabe cual leer. Santiago dudo exactamente aqui.",
  ],
  [
    "la vista previa ES lo que se sella",
    "la misma fórmula que se\n            sella al aprobar",
    "Corre computeProtocoloEfectivo, la misma funcion del servidor. Sin decirlo, la vista previa parece una estimacion y el profesional no se fia de ella para decidir.",
  ],
  [
    "campo vacío = valor del modelo",
    "Deja un campo vacío para usar",
    "No es deducible: un campo vacio se lee como dato faltante, no como 'usa el del modelo'.",
  ],
  [
    "el sodio se lee al revés",
    "El sodio se{\" \"}",
    "En toda la tabla un cubrimiento bajo es deficit; en el sodio es lo deseable. Sin esta linea el color se lee invertido justo en la fila que mas importa.",
  ],
  [
    "las porciones enteras no igualan el objetivo",
    "Las porciones enteras aproximan el objetivo, no lo igualan",
    "El total queda por debajo del objetivo y se lee como error de calculo. Le paso a Santiago.",
  ],
  [
    "dos columnas, dos preguntas",
    "las dos columnas pueden tener colores distintos en la misma fila",
    "Cubrimiento e ICN responden cosas distintas, asi que una fila puede salir verde y roja a la vez. Sin explicarlo parece un defecto de la tabla.",
  ],
  [
    "los tiempos mandan sobre las dos tablas de abajo",
    "se aplican con un paso propio y no cambian mientras marcas",
    "Explica por que hay un boton de aplicar aparte. Sin eso, el paso extra se lee como un fallo de guardado.",
  ],
  [
    "qué mira la IA, y qué no",
    "No lee las respuestas de la encuesta",
    "Describe el contrato REAL del prompt. Un texto que describe mal el motor es un defecto de seguridad, no de redaccion.",
  ],
  [
    "la IA no compone: sustituye",
    "propone sustituir solo las",
    "Es el gate de su §13. Si se lee como 'la IA arma el menu', el profesional deja de revisar lo que no cambio.",
  ],
  [
    "se aceptan una por una",
    "una por una",
    "Garantiza que ninguna propuesta entra sola. Es el control del profesional sobre la IA.",
  ],
  [
    "las restricciones se guardan ANTES de generar",
    "Guárdalas antes de generar el menú",
    "Orden de operaciones invisible: marcar sin guardar y generar produce un menu que ignora lo marcado.",
  ],
  [
    "hay dos listas de restricciones y solo una es tuya",
    "esas no se editan y ya condicionan el menú",
    "Sin esto, no poder editar las del modelo se lee como campo bloqueado por error.",
  ],
  [
    "aprobar congela, reabrir queda registrado",
    // CAMBIO EL FRAGMENTO, NO LA GARANTIA (2026-09-01). Decia "nueva se le avisa, porque cambia lo que
    // come", y ese texto era FALSO: aprobar escribe el evento en la auditoria y nada mas, no notifica a
    // nadie. La garantia que este candado protege ("nunca se poda un texto que anuncia una consecuencia
    // que llega al paciente") sigue igual y por eso la fila se queda; lo que cambio es que ahora el texto
    // dice lo que el profesional TIENE QUE HACER en vez de prometer un automatismo que no existe.
    // No se relajo el candado: se corrigio el texto que vigilaba.
    "envíale el reporte",
    "Consecuencias de un acto que sale del sistema y llega al paciente. Nunca se poda un texto que anuncia eso.",
  ],
  [
    "las notas no se editan ni se borran",
    "no se editan ni se borran",
    "Irreversibilidad. El profesional tiene derecho a saberlo ANTES de escribir.",
  ],
  [
    "por qué el menú parte de un ciclo",
    "criterio clínico",
    "Es de Gildardo y pidio expresamente que se leyera en pantalla (§13): al pie se leeria como limitacion tecnica.",
  ],
  [
    "el ciclo no trae todos los tiempos",
    "esa columna queda",
    "Explica una columna vacia. Una ausencia sin explicacion se lee como fallo.",
  ],
  [
    "por qué faltan alimentos en la distribución",
    "Solo se muestran los alimentos con porciones",
    "Explica una ausencia Y como revertirla. Familia de ausencia-de-fila vs fila-vacia.",
  ],
  [
    "por qué no hay nada que adaptar",
    "no hay nada que adaptar",
    "Explica por que el boton no hace nada para este paciente, en vez de dejarlo parecer roto.",
  ],
];

describe("las ayudas que sobrevivieron a la poda son garantías, no explicaciones", () => {
  it.each(GARANTIAS)("%s", (_titulo, frase, porQue) => {
    expect(PLANO, `SE PODÓ UNA GARANTÍA. ${porQue}`).toContain(frasePlana(frase));
  });
});

describe("y lo que se podó no volvió", () => {
  it("no hay dos párrafos seguidos diciendo lo mismo en tiempos ni en distribución", () => {
    // Eran cuatro parrafos, dos por seccion, cada par con el mismo contenido en dos longitudes. Es la
    // forma tipica en que la pantalla engorda: alguien agrega la version corta sin borrar la larga.
    expect(PANEL).not.toContain("Gobiernan el reparto de porciones y el menú.");
    expect(PANEL).not.toContain("Se calcula sobre los tiempos de comida activos. Puedes ajustar celda por celda.");
  });

  it("no volvió el índice de lo que se ve justo debajo", () => {
    expect(PANEL).not.toContain("La cadena calórica y su desarrollo: intercambio, restricciones y menú");
  });
});
