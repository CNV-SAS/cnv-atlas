import { afterEach, describe, expect, it, vi } from "vitest";

import { eq } from "drizzle-orm";

// EL FLUJO DE LA MODALIDAD 2 (QR), CONTRA LA BASE REAL (2026-09-09).
//
// Ejercita la secuencia completa del lado del servidor: emitir la sesion, que el paciente la abra desde
// SU dispositivo, que escriba su identidad, y las dos salidas (coincide / discrepa). Es lo unico que
// prueba que las columnas del dictamen reciben algo: ni tsc ni lint ESCRIBEN en la base, y esta pieza ya
// nos fallo dos veces por ahi.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const creadas: string[] = [];

// Las tres necesarias. El CHECK de la 0109 exige que una confirmacion diga QUE se autorizo: una
// confirmacion sin autorizaciones seria una fila que dice que el paciente acepto sin decir que acepto.
const AUTORIZACIONES = ["servicio", "datos_sensibles", "aceptacion_medio_electronico"];

afterEach(async () => {
  if (!HAS_DB || creadas.length === 0) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  for (const id of creadas) {
    await db
      .delete(schema.presencialConsentSessions)
      .where(eq(schema.presencialConsentSessions.id, id));
  }
  creadas.length = 0;
});

async function profesional() {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const [p] = await db
    .select({
      professionalId: schema.professionalProfiles.id,
      profileId: schema.professionalProfiles.profileId,
      organizationId: schema.profiles.organizationId,
    })
    .from(schema.professionalProfiles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.professionalProfiles.profileId))
    .limit(1);
  return p;
}

async function emitir(documento: string) {
  const { crearSesionPresencial } = await import("@/modules/consent/data/sesion-presencial");
  const pro = await profesional();
  const s = await crearSesionPresencial({
    organizationId: pro.organizationId,
    professionalId: pro.professionalId,
    createdBy: pro.profileId,
    documentType: "CC",
    documentNumber: documento,
    declaracionVersion: "1.0",
    ip: null,
  });
  creadas.push(s.id);
  return { ...s, pro };
}

async function fila(id: string) {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const [f] = await db
    .select()
    .from(schema.presencialConsentSessions)
    .where(eq(schema.presencialConsentSessions.id, id));
  return f;
}

describe.skipIf(!HAS_DB)("modalidad 2: la sesión del QR de punta a punta (BD real)", () => {
  it("al abrirla queda el dispositivo del paciente y la primera marca de tiempo", async () => {
    const { abrirSesionPresencial } = await import("@/modules/consent/data/sesion-presencial");
    const s = await emitir(`QR-${Date.now()}`);

    const antes = await fila(s.id);
    expect(antes.estado).toBe("emitida");
    expect(antes.openedAt, "recién emitida no puede tener marca de apertura").toBeNull();

    const abierta = await abrirSesionPresencial({
      token: s.token,
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0 (iPhone)",
    });
    expect(abierta).not.toBeNull();

    const f = await fila(s.id);
    expect(f.estado).toBe("abierta");
    expect(f.openedAt).not.toBeNull();
    // "Sin esto, la afirmación de que fueron dispositivos distintos es solo una etiqueta que puso el
    // sistema" (dictamen). Por eso se comprueban los dos, no solo que la sesión exista.
    expect(f.patientIp).toBe("203.0.113.7");
    expect(f.patientUserAgent).toBe("Mozilla/5.0 (iPhone)");
  });

  it("y si el paciente recarga, la marca original NO se mueve", async () => {
    // Es la que sostiene la DISTANCIA hasta la confirmación. Si cada recarga la reiniciara, bastaría con
    // recargar justo antes de aceptar para que un consentimiento de cuatro segundos pareciera pausado.
    const { abrirSesionPresencial } = await import("@/modules/consent/data/sesion-presencial");
    const s = await emitir(`QR-REC-${Date.now()}`);
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.7", userAgent: "A" });
    const primera = (await fila(s.id)).openedAt;
    await new Promise((r) => setTimeout(r, 1100));
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.9", userAgent: "B" });
    const f = await fila(s.id);
    expect(f.openedAt?.getTime()).toBe(primera?.getTime());
    expect(f.patientIp, "el dispositivo también es el del primer acceso").toBe("203.0.113.7");
  });

  it("el documento que escribe el paciente se compara, y una discrepancia PARA", async () => {
    const { abrirSesionPresencial, confirmarSesionPresencial } = await import(
      "@/modules/consent/data/sesion-presencial"
    );
    const doc = `QR-DISC-${Date.now()}`;
    const s = await emitir(doc);
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.7", userAgent: "A" });

    const r = await confirmarSesionPresencial({
      token: s.token,
      nombres: "Ana",
      apellidos: "Pérez",
      documentType: "CC",
      documentNumber: "OTRO-DISTINTO",
      autorizaciones: AUTORIZACIONES,
    });
    expect(r.estado).toBe("discrepancia");

    const f = await fila(s.id);
    expect(f.estado).toBe("discrepancia");
    expect(f.confirmedAt, "una discrepancia no confirma nada").toBeNull();
    // PERO LO QUE ESCRIBIÓ SE GUARDA: es lo que los dos necesitan para resolverlo. No se pisa ninguno de
    // los dos documentos, se conservan los dos y lo deciden ellos.
    expect(f.declaradoDocumentNumber).toBe("OTRO-DISTINTO");
    expect(f.documentNumber, "lo que escribió el profesional sigue intacto").toBe(doc);
  });

  it("con el documento correcto confirma, y el formato no crea discrepancias falsas", async () => {
    const { abrirSesionPresencial, confirmarSesionPresencial } = await import(
      "@/modules/consent/data/sesion-presencial"
    );
    const s = await emitir("1098765432");
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.7", userAgent: "A" });
    await new Promise((r) => setTimeout(r, 1100));

    // El paciente lo escribe con puntos, como en la cédula. No está declarando otro documento, y tratarlo
    // como discrepancia mandaría a los dos a resolver un problema que no existe.
    const r = await confirmarSesionPresencial({
      token: s.token,
      nombres: "Ana María",
      apellidos: "Pérez Gómez",
      documentType: "CC",
      documentNumber: "1.098.765.432",
      autorizaciones: AUTORIZACIONES,
    });
    expect(r.estado).toBe("confirmada");

    const f = await fila(s.id);
    expect(f.estado).toBe("confirmada");
    expect(f.confirmedAt).not.toBeNull();
    // LA DISTANCIA, que es lo que el dictamen pide poder mirar: "un consentimiento aceptado cuatro
    // segundos después de abrirse es difícil de defender como informado".
    const segundos = (f.confirmedAt!.getTime() - f.openedAt!.getTime()) / 1000;
    expect(segundos).toBeGreaterThanOrEqual(1);
    // Y queda lo que el paciente escribió, TAL CUAL, no normalizado: es su manifestación.
    expect(f.declaradoNombres).toBe("Ana María");
    expect(f.declaradoDocumentNumber).toBe("1.098.765.432");
  });

  it("y una sesión ya confirmada no se puede volver a abrir ni reconfirmar", async () => {
    const { abrirSesionPresencial, confirmarSesionPresencial } = await import(
      "@/modules/consent/data/sesion-presencial"
    );
    const s = await emitir("1098765432");
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.7", userAgent: "A" });
    await confirmarSesionPresencial({
      token: s.token,
      nombres: "Ana",
      apellidos: "Pérez",
      documentType: "CC",
      documentNumber: "1098765432",
      autorizaciones: AUTORIZACIONES,
    });
    expect(await abrirSesionPresencial({ token: s.token, ip: "1.2.3.4", userAgent: "X" })).toBeNull();
    const otra = await confirmarSesionPresencial({
      token: s.token,
      nombres: "Otro",
      apellidos: "Nombre",
      documentType: "CC",
      documentNumber: "1098765432",
      autorizaciones: AUTORIZACIONES,
    });
    expect(otra.estado, "un solo uso: ya se consumió").toBe("no_disponible");
  });
});

describe.skipIf(!HAS_DB)("el intento se registra SIN datos del paciente (BD real)", () => {
  it("el rastro dice qué pasó y cuándo, nunca quién", async () => {
    // Aquí el dictamen corrigió nuestra lectura: un log del intento NO es guardar datos del paciente.
    // Sirve para usabilidad y, sobre todo, para VIGILAR la modalidad más frágil: un profesional que abra
    // el flujo sin el paciente delante deja sesiones emitidas que nadie abrió nunca.
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { abrirSesionPresencial, confirmarSesionPresencial } = await import(
      "@/modules/consent/data/sesion-presencial"
    );
    const doc = `QR-LOG-${Date.now()}`;
    const s = await emitir(doc);
    await abrirSesionPresencial({ token: s.token, ip: "203.0.113.7", userAgent: "A" });
    await confirmarSesionPresencial({
      token: s.token,
      nombres: "Ana",
      apellidos: "Pérez",
      documentType: "CC",
      documentNumber: "NO-COINCIDE",
      autorizaciones: AUTORIZACIONES,
    });

    const eventos = await db
      .select({ event: schema.clinicalAuditLog.event, payload: schema.clinicalAuditLog.payload })
      .from(schema.clinicalAuditLog)
      .where(eq(schema.clinicalAuditLog.entityId, s.id));
    const nombres = eventos.map((e) => e.event);
    expect(nombres).toContain("presencial.session_created");
    expect(nombres).toContain("presencial.session_mismatch");

    for (const e of eventos) {
      const texto = JSON.stringify(e.payload ?? {});
      for (const prohibido of [doc, "NO-COINCIDE", "Ana", "Pérez"]) {
        expect(texto, `el rastro del intento filtró ${prohibido}`).not.toContain(prohibido);
      }
    }
  });
});
