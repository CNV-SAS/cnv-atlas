import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ EL MENOR EN EL PASE PRESENCIAL (QR) ═══
//
// ── DE DONDE VIENE ────────────────────────────────────────────────────────────────────────────────
//
// Seis evaluaciones de menores quedaron bloqueadas al confirmar identidad, porque su consentimiento se
// habia guardado SIN representante: entraron por el pase del QR, que no tenia rama de menor y no lo
// preguntaba. El 2026-10-12 el dictamen legal cerro el hueco donde se ESCRIBE (un guard en
// `signIntakeEvaluation`, que decide por la EDAD y no por la rama declarada, porque mirar la rama seria
// creerle al formulario justo en lo que el formulario se equivoco).
//
// ── Y EL 2026-10-12, LA PIEZA 3: EL PASE YA ACEPTA UN MENOR (0216) ───────────────────────────────
//
// Este archivo vigilaba que el pase FRENARA y lo dijera, porque frenar era lo correcto mientras no
// existiera el texto de la declaracion para el caso del representante. Ese texto llego (1.1-a y 1.1-b),
// asi que el pase dejo de frenar y empezo a resolver, y lo que hay que vigilar es otra cosa.
//
// LO QUE SE CONSERVA DE LA VERSION ANTERIOR es el guard del escritor: sigue siendo la ultima linea, y
// sigue decidiendo por la edad.
//
// ── LAS CUATRO COSAS QUE ESTE CANDADO VIGILA AHORA ───────────────────────────────────────────────
//
//   1. QUE LA VALIDACION DURA SIGA DECIDIENDO POR LA EDAD, en el unico sitio donde se escribe un
//      consentimiento. Es lo que cubre el QR, el correo, el presencial y el que alguien escriba el mes
//      que viene.
//   2. QUE LA FECHA SE EXIJA EN EL SERVIDOR, al EMITIR el pase. El `required` del campo lo comprueba el
//      navegador, y es textual del dictamen: *"este hueco existio porque el formulario permitio guardar un
//      estado imposible, y mientras eso siga siendo posible va a volver a ocurrir POR OTRA VIA"*.
//   3. QUE LA RAMA LA FIJE LA SESION Y NO SE RECALCULE AL DECLARAR. Si se eligiera dos veces, el dia que
//      las dos elecciones discreparan el profesional aceptaria un texto y se guardaria otro.
//   4. Y QUE EL CALLEJON SIN SALIDA NO VUELVA. El mensaje viejo decia que el representante sin correo "aun
//      no tiene salida": era cierto y era el hueco, porque esta via existe PORQUE no hay correo. Un texto
//      que vuelva a decirlo es la señal de que la rama se rompio.

const leer = (p: string): string => readFileSync(p, "utf8");
const ACCIONES = "src/modules/consent/actions.qr.ts";
const WRITER = "src/modules/evaluations/data/intake-writer.ts";
const PASE = "src/modules/patients/components/pase-qr-presencial.tsx";
const TELEFONO = "src/modules/consent/components/consentimiento-qr.tsx";

describe("el pase presencial y el consentimiento de un menor", () => {
  it("la validacion dura sigue decidiendo por la EDAD, no por la rama declarada", () => {
    const src = sinComentarios(leer(WRITER));
    // Mirar `ageBranch` seria creerle al formulario en lo que el formulario se equivoco.
    expect(src, "el guard dejo de calcular la edad al firmar").toMatch(/edadAlFirmar/);
    expect(src, "el guard dejo de exigir el representante").toMatch(/traeRepresentante/);
    expect(src).toMatch(/throw new ConsentimientoDeMenorSinRepresentanteError\(\)/);
  });

  it("la fecha se exige en el SERVIDOR al emitir el pase, no solo en la pantalla", () => {
    const src = sinComentarios(leer(ACCIONES));
    expect(leer(PASE), "el campo dejo de pedirse en la pantalla del pase").toMatch(
      /name="birthDate"/,
    );
    expect(
      src,
      "sin esta comprobacion en el servidor, un pase sin fecha deja la rama sin decidir y el guard del " +
        "escritor sin insumo: vuelve el estado imposible que costo seis evaluaciones",
    ).toMatch(/birthDate[\s\S]{0,400}return fail\(/);
  });

  it("y la rama se elige UNA vez, al emitir: la version sale de la sesion al declarar", () => {
    const src = sinComentarios(leer(ACCIONES));
    expect(src, "la version de la declaracion dejo de elegirse por la edad al emitir").toMatch(
      /declaracionPorEdad\(/,
    );
    expect(
      src,
      "al declarar, la version tiene que salir de la SESION. Una constante aqui volveria a decir 1.0 " +
        "sobre un menor, que es la declaracion equivocada",
    ).toMatch(/declaracionVersion: sesion\.declaracionVersion/);
    expect(
      src,
      "y la fecha tambien: volver a pedirla al declarar abre la puerta a que el texto aceptado y la edad " +
        "guardada no correspondan",
    ).toMatch(/birthDate: sesion\.patientBirthDate/);
  });

  it("el pase arma los dos tipos derivados del menor, como el camino remoto", () => {
    const src = sinComentarios(leer(ACCIONES));
    expect(src, "sin representante_legal el gate clinico bloquea la evaluacion del menor").toMatch(
      /"representante_legal"/,
    );
    expect(src).toMatch(/legalRepresentative:/);
    // EL ASENTIMIENTO SOLO SI LA DECLARACION LO AFIRMA: la 1.1-a existe porque para un menor de 14 no se
    // puede declarar un asentimiento que no ocurrio, y guardarlo seria la misma afirmacion falsa.
    expect(src).toMatch(/declaracionAfirmaAsentimiento\(sesion\.declaracionVersion\)/);
  });

  it("y la pantalla del paciente NO ofrece la rama: la trae la sesion", () => {
    const src = sinComentarios(leer(TELEFONO));
    expect(
      src,
      "si la rama fuera una opcion de esta pantalla, la elegiria quien tiene el telefono",
    ).toMatch(/esDeMenor/);
    expect(src).not.toMatch(/ageBranch/);
  });

  it("y el callejon sin salida no vuelve: el representante sin correo SI tiene via", () => {
    const acciones = sinComentarios(leer(ACCIONES));
    const telefono = sinComentarios(leer(TELEFONO));
    expect(
      acciones,
      'el mensaje viejo decia que el caso sin correo "aun no tiene salida y no se puede resolver aqui". ' +
        "Era cierto y era el hueco: esta via existe PORQUE no hay correo",
    ).not.toMatch(/no tiene salida/i);
    expect(acciones, "el mensaje del camino remoto manda a un paso que aqui no existe").not.toMatch(
      /vuelve al paso anterior/i,
    );
    expect(
      telefono,
      "el correo del representante tiene que estar marcado como opcional en su propia pantalla",
    ).toMatch(/opcional/i);
  });
});
