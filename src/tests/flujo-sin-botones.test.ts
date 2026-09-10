import { existsSync, readFileSync } from "node:fs";
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

// ═══ CONFIRMAR EL DIAGNOSTICO DEJO DE SER UN ACTO (2026-09-10) ═══
//
// TERCERA VEZ QUE LA MISMA REGLA HAY QUE RETIRAR, y por eso esto es un BARRIDO y no una asercion sobre un
// archivo. El 2026-09-09 se cambio `assertConfirmedDiagnosis` por `assertDiagnosisExists` en los nueve
// sitios del WRITER; el smoke del 10 encontro que el SERVICIO tenia CINCO comprobaciones propias que aquel
// barrido no toco (el menu semanal, los nutraceuticos y su decision, el reconocimiento de restricciones y
// las notas). Dos capas, una barrida.
//
// EL ARGUMENTO (Gildardo via Santiago): **el diagnostico es del MODELO, no del profesional.** Nadie firma
// el resultado del motor; lo que si se firma es haber prescrito sobre el.
//
// LO QUE SE CONSERVA: `confirmed_by`, `confirmed_at` y `confirmed_profession` se siguen sellando al
// aprobar el reporte. La firma clinica no desaparece, cambia de sitio.
describe("prescribir no depende de confirmar", () => {
  const SERVICIO = sinComentarios(
    readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8"),
  );
  const WRITER = sinComentarios(
    readFileSync("src/modules/treatment/data/treatment-writer.ts", "utf8"),
  );

  it("ningún servicio del tratamiento gatea por `diagnosisConfirmed`", () => {
    expect(
      SERVICIO,
      "volvió un gate de confirmación al servicio del tratamiento: se puede prescribir sin confirmar",
    ).not.toContain("diagnosisConfirmed");
  });

  it("ni el writer", () => {
    // La otra capa, la que se barrió primero. Las dos, o la regla vuelve por la que quede sin mirar.
    expect(WRITER).not.toContain("assertConfirmedDiagnosis");
    expect(WRITER, "el gate que queda es que EXISTA diagnóstico, no que esté confirmado").toContain(
      "assertDiagnosisExists",
    );
  });

  it("y no queda ningún texto de pantalla que lo exija", () => {
    // El defecto se vio como un MENSAJE: "El diagnóstico debe estar confirmado antes de editar el menú
    // semanal". Si vuelve, vuelve como texto.
    const TRAT = readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8");
    expect(sinComentarios(TRAT)).not.toMatch(/diagnóstico debe estar confirmado/i);
  });

  it("el ACTO se retiró entero: no queda acción, servicio, writer ni policy", () => {
    // Una vertical muerta pasa verde con el hueco abierto. Y una server action sin pantalla es un endpoint
    // POST que nadie ve.
    const ACCIONES = readFileSync("src/modules/diagnoses/actions.ts", "utf8");
    expect(sinComentarios(ACCIONES)).not.toContain("confirmDiagnosisAction");
    for (const f of [
      "src/modules/diagnoses/services/diagnosis-confirm-service.ts",
      "src/modules/diagnoses/data/diagnosis-confirm-writer.ts",
      "src/modules/diagnoses/policies/can-confirm-diagnosis.ts",
    ]) {
      expect(existsSync(f), `${f} volvió: el acto de confirmar estaba retirado`).toBe(false);
    }
  });

  it("pero la FIRMA CLINICA se sigue sellando al aprobar el reporte", () => {
    // ES LA MITAD QUE NO SE PUEDE PERDER. Sin esto, retirar el acto habría dejado los diagnósticos sin
    // constancia de quién los asumió, que es lo contrario de lo que se quería.
    const REPORTES = readFileSync("src/modules/reports/data/reports-writer.ts", "utf8");
    expect(REPORTES).toContain("confirmedAt: sql`now()`");
    expect(REPORTES).toContain("confirmedProfession");
    expect(REPORTES).toContain('event: "diagnosis.confirmed_via_report"');
  });

  it("y el bloque de pantalla rinde el HECHO, sin ofrecer el acto", () => {
    const PANEL = readFileSync(
      "src/modules/diagnoses/components/confirm-diagnosis-panel.tsx",
      "utf8",
    );
    const codigo = sinComentarios(PANEL);
    expect(codigo, "volvió el botón de confirmar").not.toContain("Confirmar diagnóstico");
    expect(codigo, "volvió la promesa falsa de que confirmar habilita prescribir").not.toMatch(
      /habilita prescribir/,
    );
    // Y sin confirmar no pinta nada: un bloque que solo dijera "todavía no" sería un reproche sobre algo
    // que el profesional no puede hacer directamente.
    expect(codigo).toContain("if (!confirmed) return null;");
  });
});
