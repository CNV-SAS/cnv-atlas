import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DE LA COMPROBACION AUTOMATICA DEL CODIGO (2026-08-26). Existe desde que verificar dejo de
// consumir: antes, comprobar mientras el paciente escribia habria QUEMADO el codigo al sexto digito y
// habria empeorado el defecto en vez de arreglarlo.

const FORM = readFileSync("src/modules/evaluations/components/sign-phase-form.tsx", "utf8");
const ACTIONS = readFileSync("src/modules/evaluations/actions.ts", "utf8");

const accion = ACTIONS.slice(ACTIONS.indexOf("export async function checkConsentOtpAction"));

describe("comprobar el código no lo consume", () => {
  it("la acción usa verifyOtp y NO consumeOtp", () => {
    expect(accion.slice(0, 1500)).toContain("verifyOtp(sessionId, code)");
    expect(accion.slice(0, 1500)).not.toContain("consumeOtp");
  });
});

describe("el pegado funciona igual que teclear", () => {
  it("se dispara con el VALOR, no con teclas", () => {
    // Pegar y el autocompletado del código del correo no producen pulsaciones: con onKeyDown no
    // dispararían, y es lo que hace la mayoría en el teléfono.
    expect(FORM).toContain("useEffect(() => {");
    expect(FORM).toContain("if (!otpState.sent || !otpCodeOk || otpValidado) return;");
    expect(FORM).not.toContain("onKeyDown={(e) => setOtpCode");
  });

  it("el servidor limpia lo que venga alrededor antes de comparar", () => {
    // Espacios, guiones o un salto de línea del correo: un código bueno no puede fallar por cómo se copió.
    expect(accion.slice(0, 1200)).toContain('str(form, "otpCode").replace(/\D/g, "")');
  });
});

describe("no se gastan intentos de más", () => {
  it("el mismo código no se comprueba dos veces", () => {
    // Cada comprobación gasta intento (es lo que sostiene el límite anti-fuerza-bruta). Sin esto, escribir
    // un dígito, borrarlo y volver a escribirlo gastaría dos de los cinco.
    expect(FORM).toContain("if (otpChecked.current === otpCode) return;");
  });

  it("un fallo de RED deja reintentar el mismo, y lo dice", () => {
    // Un fallo de conexión no es un código equivocado.
    expect(FORM).toContain("if (otpCheck.retryable) otpChecked.current = \"\";");
    expect(FORM).toContain("no gastaste ningún intento");
    expect(accion.slice(0, 1500)).toContain("retryable: true");
  });
});

describe("mientras comprueba se ve, y al validar se cierra", () => {
  it("hay señal de espera: un segundo sin nada parece que no pasó", () => {
    expect(FORM).toContain("Comprobando el código…");
  });

  it("el campo se bloquea al validar, pero SIN disabled (ver el bloque de abajo)", () => {
    expect(FORM).toContain("readOnly={otpValidado}");
  });

  it("y el botón de pedir otro DESAPARECE", () => {
    // Pulsarlo invalidaría justo el código que acaba de servir.
    expect(FORM).toContain('otpValidado ? "hidden" : ""');
  });

  it("firmar exige código COMPROBADO, no solo escrito", () => {
    expect(FORM).toContain("!otpState.sent || !otpValidado || pending");
  });
});

// ── EL DEFECTO DEL SMOKE (2026-08-26): la pantalla se contradecia ────────────────────────────────────
//
// Se pegaba el codigo bueno, salia el verde "Código correcto. Ya puedes firmar", se pulsaba Firmar y el
// servidor respondia "Ingresa el código de verificación". Dos partes de la misma pantalla afirmando lo
// contrario.
//
// La causa no eran los codigos fallidos previos (esa fue la sospecha razonable al verlo): era que al
// validar se ponia `disabled` en el campo, y UN INPUT DESHABILITADO NO SE ENVIA EN EL FORMDATA. Es
// comportamiento del navegador, invisible a tsc y a los tests que no montan el DOM. El codigo dejaba de
// viajar justo cuando ya se habia validado.
describe("el campo bloqueado SIGUE enviando el codigo", () => {
  it("es readOnly, NUNCA disabled", () => {
    expect(FORM).toContain("readOnly={otpValidado}");
    // El guard es sobre el CAMPO DEL CODIGO: `disabled` en el, y solo en el, rompe el envio.
    const campo = FORM.slice(FORM.indexOf('name="otpCode"'), FORM.indexOf('</Field>', FORM.indexOf('name="otpCode"')));
    expect(campo).not.toContain("disabled=");
  });

  it("y se ve bloqueado sin estarlo para el navegador", () => {
    expect(FORM).toContain('otpValidado ? "bg-muted text-muted-foreground" : ""');
    expect(FORM).toContain("aria-readonly={otpValidado}");
  });
});
