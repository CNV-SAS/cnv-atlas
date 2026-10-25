import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// INACTIVAR A UN PROFESIONAL: LA FORMA  ·  CANDADOS DE CODIGO  ·  0229
//
// El EFECTO lo prueba `el-acceso-del-integrante-se-quita-y-se-devuelve-db.test.ts` contra la base. Aqui se
// defiende la forma: lo que no se puede medir corriendo una vez, pero se pierde en la siguiente edicion.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const WRITER = "src/modules/professionals/data/acceso-del-integrante-writer.ts";
const PANTALLA = "src/modules/professionals/components/acceso-del-integrante.tsx";
const ACCIONES = "src/modules/professionals/actions.ts";
const MIGRACION = "drizzle/0229_inactivar_sin_borrar_la_cuenta.sql";
const LOGIN = "src/modules/auth/actions.ts";
const CABLES = "scripts/check-cables.mjs";

const leer = (p: string) => readFileSync(p, "utf8");

/** Quita comentarios de bloque, de linea y de JSX. */
const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("quitar el acceso sin borrar la cuenta", () => {
  it("el motivo es obligatorio EN LOS DOS SENTIDOS", () => {
    // Gildardo lo pidio "reversible, con motivo y auditoria". Si el motivo solo se exige al quitar, la
    // vuelta atras queda sin explicar, y la pregunta que llega despues es justamente por que volvio.
    const src = leer(WRITER);
    const quitar = src.slice(src.indexOf("export async function inactivarIntegrante"), src.indexOf("export async function reactivarIntegrante"));
    const devolver = src.slice(src.indexOf("export async function reactivarIntegrante"));
    for (const [nombre, trozo] of [["inactivar", quitar], ["reactivar", devolver]] as const) {
      expect(/motivo\.length < 10/.test(trozo), `${nombre} tiene que exigir el motivo`).toBe(true);
      expect(/AccesoDelIntegranteError/.test(trozo), `${nombre} falla con error esperable, no con throw crudo`).toBe(true);
    }
  });

  it("el rastro va INLINE en la transaccion, no por el bus (regla dura 8)", () => {
    const src = leer(WRITER);
    // Las dos llamadas a recordAudit viven dentro de un db.transaction: el acto y su asiento se confirman
    // juntos o no se confirma ninguno. Un asiento fuera deja actos sin rastro cuando algo falla en medio.
    const transacciones = src.split("db.transaction(async (tx) => {").slice(1);
    expect(transacciones.length, "hay dos actos: quitar y devolver").toBe(2);
    for (const t of transacciones) {
      const cuerpo = t.slice(0, t.indexOf("\n  });"));
      expect(/recordAudit\(tx,/.test(cuerpo), "el asiento va con el tx de la transaccion").toBe(true);
    }
  });

  it("el asiento lleva el RETRATO de lo que quedo abierto, no solo el motivo", () => {
    // Es la parte que contesta la pregunta de dentro de un ano: "se le quito el acceso" no dice que paso
    // con sus 25 pacientes. Y el retrato se toma ANTES del cambio, o `llegadosDespues` daria cero siempre.
    const src = leer(WRITER);
    expect(/payload: \{ motivo, abierto \}/.test(src)).toBe(true);
    const i = src.indexOf("const abierto = await loQueQuedaAbierto(input.professionalId, null)");
    const j = src.indexOf("db.transaction", i);
    expect(i, "el retrato se lee antes de la transaccion").toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
  });

  it("la llamada a Supabase Auth vive FUERA de la transaccion", () => {
    // Una llamada externa dentro de la transaccion ata el estado del dominio a la latencia de otro
    // servicio, y un timeout dejaria la fila sin confirmar aunque la cuenta ya estuviera bloqueada.
    const src = leer(WRITER);
    for (const trozo of src.split("db.transaction(async (tx) => {").slice(1)) {
      const cuerpo = trozo.slice(0, trozo.indexOf("\n  });"));
      expect(/bloquearEnAuth|updateUserById/.test(cuerpo), "el bloqueo de la sesion no va dentro del tx").toBe(false);
    }
    expect(/sesionSinRevocar/.test(src), "y si falla se DICE, no se traga").toBe(true);
  });

  it("un fallo del bloqueo de sesion se avisa, no se reporta como exito", () => {
    // Un aviso de exito sobre medio acto es exactamente lo que hace que nadie vuelva a mirar.
    const src = leer(ACCIONES);
    const i = src.indexOf("cambiarAccesoDelIntegranteAction");
    const trozo = src.slice(i);
    expect(/if \(r\.sesionSinRevocar\)/.test(trozo)).toBe(true);
    expect(/warning:/.test(trozo), "va como advertencia, no como success").toBe(true);
  });

  it("el aviso dice LO QUE QUEDA ABIERTO, porque nadie va a ir a buscarlo", () => {
    const src = leer(ACCIONES);
    const trozo = src.slice(src.indexOf("cambiarAccesoDelIntegranteAction"));
    expect(/Sigue abierto:/.test(trozo)).toBe(true);
    expect(/siguen asignados a él|sigue asignado a él/.test(trozo)).toBe(true);
    expect(/se le siguen debiendo/.test(trozo)).toBe(true);
  });

  it("la pantalla no abre un <form> propio ni pone `name` en sus campos (hazards 7 y 8)", () => {
    // SIN LOS COMENTARIOS: el comentario que EXPLICA el hazard menciona la etiqueta, asi que buscarla en el
    // archivo crudo hacia fallar al archivo por documentarse bien.
    const src = sinComentarios(leer(PANTALLA));
    expect(/<form[\s>]/.test(src), "un <form> dentro de otro lo DESCARTA el navegador").toBe(false);
    expect(/<Input[^>]*\bname=/.test(src), "un campo con nombre viajaria en el envio de la pantalla").toBe(false);
    expect(/ejecutarAccion\(action, fd\)/.test(src), "el envio pasa por el mecanismo unico").toBe(true);
  });

  it("los dos botones de envio no comparten `key` (hazard 1)", () => {
    const src = leer(PANTALLA);
    const keys = [...src.matchAll(/key="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(keys).size, "una key repetida hace que React reuse el nodo y el boton cambie de papel").toBe(keys.length);
  });

  it("el boton apagado DICE por que esta apagado (hazard 8)", () => {
    // Un boton muerto sin explicacion es peor que un error claro: quien mira cree que el sistema esta roto.
    const src = leer(PANTALLA);
    expect(/Escribe el motivo para quitar el acceso/.test(src)).toBe(true);
    expect(/Escribe el motivo para devolverle el acceso/.test(src)).toBe(true);
  });

  it("la pantalla dice lo que quitar el acceso NO resuelve", () => {
    // Si el boton no lo dice, lo razonable es dar por hecho que inactivar cierra el offboarding completo,
    // y entonces sus pacientes se quedan sin quien los atienda sin que nadie lo note.
    const src = leer(PANTALLA);
    expect(/Esto NO lo resuelve quitarle el acceso/.test(src)).toBe(true);
    expect(/hay que reasignarlos/.test(src)).toBe(true);
    expect(/siguen en su vitrina/.test(src)).toBe(true);
    // El JSX corta la frase en varias lineas, asi que se fija el trozo que no se parte.
    expect(/a su nombre después de/.test(src)).toBe(true);
    expect(/Nadie los está atendiendo/.test(src)).toBe(true);
  });

  it("deactivateUser YA NO EXISTE en ninguna parte", () => {
    // Era una server action sin pantalla, sin motivo y sin vuelta atras, y desde la 0229 ademas VIOLA el
    // CHECK (pone status = inactive sin inactivo_desde). Dejarla de adorno la volveria el camino oficial.
    const sitios = [
      "src/modules/auth/admin-actions.ts",
      "src/modules/auth/admin-validations.ts",
    ];
    for (const p of sitios) {
      expect(/\bdeactivateUser\s*\(/.test(leer(p)), `${p} no puede volver a declararla`).toBe(false);
      expect(/deactivateUserSchema/.test(leer(p)), `${p}: ni su schema`).toBe(false);
    }
  });

  it("el login distingue una cuenta sin acceso de una clave mala", () => {
    // Un freno sin salida se siente como un defecto: "correo o contraseña incorrectos" manda al integrante
    // a restablecer la clave, funciona, y sigue sin poder entrar.
    const src = leer(LOGIN);
    expect(/user_banned/.test(src)).toBe(true);
    expect(/restablecer la contraseña no lo resuelve/.test(src)).toBe(true);
    // Y la mitad del dominio, por si el bloqueo externo no quedo puesto.
    const i = src.indexOf("signInWithPassword");
    const j = src.indexOf("mfaRelaxedForTesting()");
    expect(src.slice(i, j).includes("status !== \"active\""), "el chequeo va ANTES del step-up de MFA").toBe(true);
  });

  it("la 0229 NO llama a cuenta_activa() desde is_patient_professional: cuesta el 75 %", () => {
    // ESTA ES LA RUTA QUE YA TUMBO LA LISTA DE PACIENTES POR TIMEOUT, asi que el candado es de rendimiento,
    // no de estilo. `is_patient_professional` se evalua POR FILA y una funcion `security definer` no se
    // puede inline, asi que llamar a otra funcion desde dentro es una llamada mas por cada paciente.
    // Medido en local sobre 149 filas: 66-73 ms sin chequeo, 116-123 ms con la llamada aparte, 70-80 ms con
    // el estado como JOIN. El JOIN es la unica de las tres que entra en el ruido.
    const sql = leer(MIGRACION);
    const cuerpo = sql.slice(sql.indexOf("function public.is_patient_professional"));
    const hasta = cuerpo.slice(0, cuerpo.indexOf("$$;"));
    expect(/cuenta_activa/.test(hasta), "una llamada de funcion mas por fila, en la ruta del roster").toBe(false);
    expect(/pr\.status = 'active'/.test(hasta), "el estado va como JOIN dentro del mismo exists").toBe(true);
    // Y en `has_role` SI vale la funcion: las policies la envuelven en (select ...), o sea una vez por
    // consulta. La asimetria es deliberada y por eso se fija.
    const hasRole = sql.slice(sql.indexOf("function public.has_role"));
    expect(/cuenta_activa/.test(hasRole.slice(0, hasRole.indexOf("$$;")))).toBe(true);
  });

  it("check-cables cuenta LLAMADAS, no menciones del nombre", () => {
    // El agujero por el que `deactivateUser` paso verde durante meses: contaba subcadenas, y
    // `deactivateUserSchema` mas la cadena de reportServerError ya daban tres.
    const src = leer(CABLES);
    expect(/const llamadas = propio\.split\(new RegExp\(/.test(src)).toBe(true);
    expect(/propio\.split\(d\.n\)\.length/.test(src), "el conteo por subcadena no puede volver").toBe(false);
  });
});
