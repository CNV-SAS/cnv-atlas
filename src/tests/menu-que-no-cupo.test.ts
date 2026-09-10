import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCambiosMenu } from "@/modules/treatment/ai/prompts/menu.v4";

import { sinComentarios } from "./helpers/sin-comentarios";

// EL MENU FALLABA CON DOS RESTRICCIONES (smoke Santiago, 2026-09-10).
//
// EL SINTOMA: "No se pudo adaptar el menú. Respuesta inválida", y en la pantalla clínica el JSON crudo del
// modelo, que se veía BIEN FORMADO.
//
// Y LO ESTABA. Lo que pasaba es que llegaba CORTADO. Verificado contra la fila de producción, no razonado:
// el texto termina a media cadena, hay 29 llaves abiertas contra 27 cerradas y `JSON.parse` rompe con
// "Unterminated string in JSON at position 4037".
//
// LA SERIE lo confirma y explica por qué apareció justo ahora: una restricción daba 8 entradas y 1.371
// caracteres; una compuesta, 14 y 3.683; dos restricciones, 28-30 entradas y ~4.000-4.900. El trabajo crece
// con las RESTRICCIONES (el modelo devuelve una entrada por restricción incumplida), y el tope no crecía.
//
// Y NO ERA DETERMINISTA, que es por qué pasó desapercibido: los modelos de razonamiento gastan del mismo
// presupuesto en pensar antes de escribir. Una generación de 4.949 caracteres pasó y otra de 4.037 se cortó.

const PROVIDER = readFileSync("src/lib/ai/provider.ts", "utf8");
const SERVICIO = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
const ACCIONES = readFileSync("src/modules/treatment/actions.ts", "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("un JSON cortado no parsea, y ese es el caso que hubo", () => {
  it("EL CASO DE PRODUCCIÓN: la respuesta termina a media entrada", () => {
    // El final real de la fila que falló, recortado. Sin esto, el candado hablaría de un caso imaginado.
    const cortado =
      '{ "cambios": [ { "dia": 6, "tiempo": "cena", "reemplazo": "Puré de papa sin mantequilla", "mot';
    expect(parseCambiosMenu(cortado)).toBeNull();
  });

  it("y el mismo texto COMPLETO sí parsea", () => {
    // CONTROL: sin esto, "devuelve null siempre" también pasaría verde y el caso de arriba no probaría
    // nada sobre el truncamiento.
    const entero =
      '{ "cambios": [ { "dia": 6, "tiempo": "cena", "reemplazo": "Puré de papa sin mantequilla", "motivo": "sin lacteos" } ] }';
    expect(parseCambiosMenu(entero)?.cambios).toHaveLength(1);
  });
});

describe("el tope de salida es POR LLAMADA, y el del menú es propio", () => {
  it("el proveedor lo recibe en vez de tenerlo clavado", () => {
    expect(sinComentarios(PROVIDER), "el tope volvió a ser una constante compartida").not.toContain(
      "max_completion_tokens: 4096",
    );
    expect(PROVIDER).toContain("max_completion_tokens: maxTokens");
    expect(PROVIDER).toContain("maxOutputTokens: maxTokens");
  });

  it("y el menú, que es la llamada más larga de Atlas, pide el suyo", () => {
    // Un tope único obligaba a elegir entre el borrador de criterio (párrafos) y una semana entera de
    // sustituciones. No tienen nada que ver.
    expect(SERVICIO).toContain("const MAX_TOKENS_MENU = 8192;");
    expect(SERVICIO).toContain("{ maxTokens: MAX_TOKENS_MENU }");
  });
});

describe("y si aun así se corta, se dice que se cortó", () => {
  it("el proveedor mira el motivo de cierre de los DOS", () => {
    // Groq y Gemini lo nombran distinto. Mirar solo uno dejaría el fallback sin diagnóstico.
    expect(PROVIDER).toContain('finish_reason === "length"');
    expect(PROVIDER).toContain('finishReason === "MAX_TOKENS"');
  });

  it("el servicio lo separa de un texto malo", () => {
    expect(SERVICIO).toContain('completion.truncado ? ("truncado" as const)');
  });

  it("y el aviso dice qué hacer, no solo que falló", () => {
    // Reintentar SIRVE aquí, porque el tamaño depende de cuánto razone el modelo en esa llamada. Decirlo
    // igual que "respuesta inválida" mandaría a buscar un defecto de formato donde hubo falta de espacio.
    expect(ACCIONES).toContain("llegó incompleta");
    expect(ACCIONES).toContain("Vuelve a intentarlo");
  });
});

describe("el JSON crudo NO se le enseña al profesional", () => {
  it("la rama de prosa exige que el intento haya salido bien", () => {
    // EL DEFECTO: con el parseo fallido, `menuJson` quedaba en null y el texto crudo caía en la rama de
    // prosa de la v2. La pantalla clínica mostraba el JSON entero del modelo: eso es depuración, y además
    // invita a aplicar a mano una propuesta que el sistema no pudo validar.
    expect(PANEL).toContain('m.status === "success" && m.generatedText');
  });

  it("y en su lugar se dice qué pasó y qué queda en pie", () => {
    expect(PANEL).toContain("no se pudo leer");
    expect(PANEL).toContain("La grilla se queda con el menú del ciclo.");
  });
});
