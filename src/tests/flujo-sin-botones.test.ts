import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL FLUJO SIN BOTONES (2026-09-09, peticion de Gildardo via Santiago).
//
// SE RETIRARON DOS CLICS del camino del profesional: confirmar identidad y guardar las medidas. Lo que
// este candado protege es la distincion que hizo que fuera seguro retirarlos:
//
//   **SE QUITA EL CLIC, NO EL ACTO.** Los efectos de cada uno siguen ocurriendo, con su auditoria y sus
//   guardas. Un candado que solo comprobara que el boton ya no esta certificaria el sintoma; lo que hay
//   que blindar es que lo que el boton disparaba siga disparandose.
const IDENTIDAD = readFileSync(
  "src/modules/evaluations/components/identidad-automatica.tsx",
  "utf8",
);
const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
const ANTRO = sinComentarios(
  readFileSync("src/modules/bis-intake/components/antropometria-editable.tsx", "utf8"),
);
const ACTION = sinComentarios(readFileSync("src/modules/evaluations/actions.ts", "utf8"));
const WRITER = sinComentarios(
  readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8"),
);

describe("identidad: se quita el clic, no el acto", () => {
  it("los CUATRO efectos siguen en el camino", () => {
    // Confirmar identidad nunca fue solo desambiguar. Si alguien simplifica la accion creyendo que si,
    // esto lo para. Cada aserción nombra el efecto para que el rojo diga cuál se perdió.
    expect(ACTION, "se perdió el gate del conflicto de identidad").toContain(
      "if (ownership.identityConflict)",
    );
    expect(WRITER, "se perdió el segundo muro de la rama de consentimiento").toContain(
      "checkConsentBranchConsistency",
    );
    expect(WRITER, "se perdió el paso draft -> in_progress").toContain('status: "in_progress"');
    expect(WRITER, "se perdió la auditoría del acto").toContain('event: "evaluation.identity_confirmed"');
  });

  it("y el bloque humano se conserva donde HAY algo que decidir", () => {
    // Automatica SOLO cuando no hay nada que contrastar. Con conflicto declarado o con candidatos a
    // duplicado, la decision sigue siendo de una persona: es el caso que describio Santiago.
    expect(PAGINA).toContain("pendingIdentity.identityConflict ? (");
    expect(PAGINA).toContain("identityDups.length > 0 ? (");
    expect(PAGINA).toContain("<IdentidadAutomatica evaluationId={pendingIdentity.evaluationId} />");
  });

  it("la confirmación automática se dispara UNA vez", () => {
    // Sin la guarda, React monta dos veces en desarrollo y la accion viaja dos veces. La segunda seria
    // inocua (el guard de estado la rechaza) pero ensucia el log del servidor.
    //
    // ALCANCE AMPLIADO (2026-09-10), no la asercion: a la guarda se le sumo `activa`. Este bloque vive en
    // DOS pestañas (Encuesta y Antrop. & BIS) y, desde que una etapa visitada no se desmonta, pueden
    // existir las DOS instancias: sin `activa` serian dos confirmaciones, y la segunda pintaria "No se
    // pudo confirmar la identidad automáticamente" sobre una identidad que SI se confirmo.
    expect(sinComentarios(IDENTIDAD)).toContain("if (!activa || disparado.current) return;");
    expect(sinComentarios(IDENTIDAD)).toContain("disparado.current = true;");
  });

  it("y si el muro del consentimiento falla, NO pasa callado", () => {
    // Es el caso que no puede quedarse en silencio: la evaluacion se queda en borrador y el profesional
    // tiene que saber por que.
    expect(IDENTIDAD).toContain("No se pudo confirmar la identidad automáticamente");
    expect(sinComentarios(IDENTIDAD)).toContain("if (!state.error) return null;");
  });
});

describe("medidas: se guardan al salir del campo, no en cada tecla", () => {
  it("los dos campos guardan al perder el foco", () => {
    expect(ANTRO).toContain("onBlur={guardarSiCambio}");
    // Los DOS: si solo uno lo lleva, el otro se queda sin forma de guardarse (ya no hay botón).
    expect((ANTRO.match(/onBlur=\{guardarSiCambio\}/g) ?? []).length).toBe(2);
  });

  it("y SOLO si el valor cambió", () => {
    // Sin esto, pasar por los dos campos con el tabulador sin tocar nada escribiria dos veces y dejaria
    // dos entradas de auditoria por visita: `bis.medidas_profesional.recorded` dejaria de significar
    // "el profesional registro algo".
    expect(ANTRO).toContain("if (valor === ultimoGuardado.current[campo]) return;");
  });

  it("y los campos se bloquean mientras la escritura viaja", () => {
    // Es lo unico que habia que cuidar del choque con la sarcopenia: que el guardado haya LLEGADO antes
    // de generar el diagnostico. La prensil entra al motor, pero se lee al generar, no al guardar.
    expect((ANTRO.match(/disabled=\{pending\}/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("los CUATRO campos del equipo conservan su botón", () => {
    // La distincion de Santiago: peso, talla, cintura y cadera CONTRADICEN al equipo, asi que corregirlos
    // es una decision y lleva su acto. La meta y la prensil no contradicen nada.
    // Se afirma por el BOTON DE ENVIO del formulario de cada campo, que es lo que la rama no sellada
    // pinta; el rotulo suelto "Guardar" cabe en varias formas y el candado estaria mirando texto.
    expect(ANTRO).toContain('<Button type="submit" variant="outline" size="sm" disabled={pending}>');
  });
});
