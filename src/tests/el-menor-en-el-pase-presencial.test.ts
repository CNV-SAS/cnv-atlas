import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ EL MENOR EN EL PASE PRESENCIAL (QR), 2026-10-12 ═══
//
// ── DE DONDE VIENE ────────────────────────────────────────────────────────────────────────────────
//
// Seis evaluaciones de menores quedaron bloqueadas al confirmar identidad, porque su consentimiento se
// habia guardado SIN representante: entraron por el pase del QR, que no tiene rama de menor y no lo
// pregunta. El dictamen legal cerro el hueco donde se escribe (un guard en `signIntakeEvaluation`, que
// decide por la EDAD y no por la rama declarada, porque mirar la rama seria creerle al formulario justo en
// lo que el formulario se equivoco).
//
// ── LO QUE ESTE CANDADO VIGILA, Y SON DOS COSAS DISTINTAS ────────────────────────────────────────
//
//   1. QUE LA VALIDACION DURA TENGA SU INSUMO. El guard decide por la edad, asi que SIN FECHA DE
//      NACIMIENTO no puede disparar: `edadAlFirmar` queda en null y el consentimiento de un menor se
//      guarda sin representante igual que antes. El campo lleva `required`, pero eso lo comprueba el
//      NAVEGADOR. Es textual del dictamen: *"este hueco existio porque el formulario permitio guardar un
//      estado imposible, y mientras eso siga siendo posible va a volver a ocurrir POR OTRA VIA"*.
//
//   2. QUE CUANDO DISPARE, SE DIGA. Sin su rama, el error caia en el generico (*"intenta de nuevo"*) mas
//      una excepcion en Sentry: invita a repetir lo mismo, y lo mismo va a volver a fallar porque el
//      problema no es pasajero. Y el mensaje NO puede ser el del camino remoto, que esta escrito para el
//      paciente y le dice que vuelva al paso anterior a elegir la rama de menor: en este pase esa opcion
//      no existe todavia, asi que mandar ahi al profesional es un guard correcto mal expuesto.
//
// LO QUE ESTE CANDADO NO PUEDE VIGILAR, y hay que decirlo: que el pase ACEPTE un menor. Eso es la pieza 3
// y le falta el texto de la declaracion del profesional para el caso del representante, que es del
// dictamen y verbatim ("fue EL quien marco las autorizaciones" no se puede declarar sobre un menor cuyo
// representante marco). Mientras ese texto no exista, el pase frena y lo dice, que es lo correcto.

const leer = (p: string): string => readFileSync(p, "utf8");
const ACCIONES = "src/modules/consent/actions.qr.ts";
const WRITER = "src/modules/evaluations/data/intake-writer.ts";
const PASE = "src/modules/patients/components/pase-qr-presencial.tsx";

describe("el pase presencial y el consentimiento de un menor", () => {
  it("la validacion dura sigue decidiendo por la EDAD, no por la rama declarada", () => {
    const src = sinComentarios(leer(WRITER));
    // Mirar `ageBranch` seria creerle al formulario en lo que el formulario se equivoco.
    expect(src, "el guard dejo de calcular la edad al firmar").toMatch(/edadAlFirmar/);
    expect(src, "el guard dejo de exigir el representante").toMatch(/traeRepresentante/);
    expect(src).toMatch(/throw new ConsentimientoDeMenorSinRepresentanteError\(\)/);
  });

  it("y el pase EXIGE la fecha en el servidor, que es lo que le da insumo al guard", () => {
    const src = sinComentarios(leer(ACCIONES));
    // El `required` de la pantalla se queda (es buena cortesia), pero no es la garantia.
    expect(leer(PASE), "el campo dejo de pedirse en la pantalla").toMatch(
      /name="birthDate"[^>]*required|required[^>]*name="birthDate"/,
    );
    expect(
      src,
      "sin esta comprobacion, una fecha vacia deja a edadAlFirmar en null y el guard no dispara: " +
        "vuelve el estado imposible que costo seis evaluaciones",
    ).toMatch(/if \(!s\("birthDate"\)\)/);
  });

  it("y cuando el guard dispara, el profesional lee QUE pasa, no 'intenta de nuevo'", () => {
    const src = sinComentarios(leer(ACCIONES));
    expect(
      src,
      "sin su rama cae en el generico, que invita a repetir lo que va a volver a fallar",
    ).toMatch(/e instanceof ConsentimientoDeMenorSinRepresentanteError/);
    // Y SE IMPORTA: la clase tiene que llegar, o el `instanceof` es siempre falso y nada falla.
    expect(src, "la clase no se importa, asi que el instanceof nunca es cierto").toMatch(
      /ConsentimientoDeMenorSinRepresentanteError\b[\s\S]*await import\(/,
    );
  });

  it("y NO reusa el mensaje del camino remoto, que manda a un paso que aqui no existe", () => {
    const src = sinComentarios(leer(ACCIONES));
    expect(
      src,
      'el mensaje del paciente dice "vuelve al paso anterior y elige la opcion de menor de edad", y en ' +
        "este pase esa opcion no esta: es un guard correcto mal expuesto",
    ).not.toMatch(/vuelve al paso anterior/i);
    // Lo que SI tiene que decir: por donde se puede hoy, y que el representante sin correo no tiene salida.
    expect(src).toMatch(/representante legal/i);
    expect(src, "el caso sin correo es el que Santiago necesita: no se puede callar").toMatch(
      /no tiene correo/i,
    );
  });
});
