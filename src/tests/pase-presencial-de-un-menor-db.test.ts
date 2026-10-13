import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ EL PASE PRESENCIAL DE UN MENOR (0216, pieza 3 del consentimiento) ═══
//
// EL HUECO QUE CIERRA: la modalidad 2 (QR) no tenia rama de menor. Si la fecha indicaba menor, el guard
// del escritor paraba el acto y el mensaje mandaba al camino del enlace, "y si el representante no tiene
// correo, avisale a quien administra Atlas: ese caso aun no tiene salida". O sea: la via presencial existe
// PORQUE el paciente no tiene correo, y para un menor sin correo no habia ninguna.
//
// ── LAS CINCO COSAS QUE ESTE CANDADO SOSTIENE ─────────────────────────────────────────────────────
//
//   1. QUE LA RAMA LA FIJE LA FECHA, al emitir el pase, y no una opcion de pantalla. Si la rama fuera
//      elegible en el telefono, la elegiria quien tiene el telefono.
//   2. QUE EL ASENTIMIENTO SOLO QUEPA EN LA 1.1-b. La 1.1-a existe porque para un menor de 14 el
//      profesional no puede declarar un asentimiento que no ocurrio; guardarlo en la fila seria la misma
//      afirmacion falsa por la puerta de al lado. Lo defiende un CHECK, y por eso se prueba contra la base.
//   3. QUE UNA SESION CONFIRMADA DE LA RAMA MENOR TENGA REPRESENTANTE. Confirmada significa que alguien
//      autorizo; si fue el representante, tiene que constar quien.
//   4. QUE LA RAMA MAYOR NO GUARDE REPRESENTANTE, aunque alguien lo mande: ahi la declaracion 1.0 afirma
//      que marco EL PACIENTE, y un representante colgando de esa fila la contradice.
//   5. Y QUE EL CORREO PUEDA FALTAR, que es la unica diferencia con el camino remoto y la razon de ser de
//      esta pieza. En el remoto es obligatorio porque por ahi va el codigo, que ES la verificacion.
//
// Contra la BD real porque tres de las cinco viven en un CHECK, y un CHECK mal escrito no falla: PASA
// (la leccion de la 0181, donde un CHECK que evaluaba a NULL se cumplia).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el pase presencial de un menor (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sesionData: any;
  let orgId = "";
  let profId = "";
  let profileId = "";
  const sesiones: string[] = [];

  // Fechas calculadas desde hoy, no fijas: una fecha absoluta en un test contra la base envejece y
  // despues falla por OTRA razon (un menor de 17 cumple 18).
  const haceAnios = (n: number): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    d.setDate(d.getDate() - 1); // un dia de margen, para no caer justo en el cumpleaños
    return d.toISOString().slice(0, 10);
  };

  async function emitir(birthDate: string, declaracionVersion: string) {
    const r = await sesionData.crearSesionPresencial({
      organizationId: orgId,
      professionalId: profId,
      createdBy: profileId,
      documentType: "TI",
      documentNumber: `ZZ-MENOR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientBirthDate: birthDate,
      declaracionVersion,
      ip: null,
    });
    if ("yaHayUna" in r) throw new Error(`habia una sesion viva: ${r.documento}`);
    sesiones.push(r.id);
    // SE ABRE, como hace el telefono al montarse. El CHECK de tiempos de la 0108 exige que confirmar venga
    // despues de abrir, y tiene razon: lo que prueba algo es la DISTANCIA entre las dos marcas.
    await sesionData.abrirSesionPresencial({ token: r.token, ip: null, userAgent: "candado" });
    return r;
  }

  const fila = async (id: string) => {
    const [f] = await db.execute(dsql`
      select declaracion_version, patient_birth_date::text as nacimiento, estado, confirmed_at,
             representante_nombre, representante_documento, representante_parentesco,
             representante_email, asentimiento_menor
        from presencial_consent_sessions where id = ${id}`);
    return f;
  };

  const documentoDe = async (id: string): Promise<string> => {
    const [f] = await db.execute(
      dsql`select document_number from presencial_consent_sessions where id = ${id}`,
    );
    return f.document_number;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    sesionData = await import("@/modules/consent/data/sesion-presencial");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    profileId = prof.profile_id;
    orgId = prof.organization_id;
  }, 30_000);

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of sesiones) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from presencial_consent_sessions where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
    sesiones.length = 0;
  });

  it("la fecha y la version quedan en la sesion desde que se emite el pase", async () => {
    const nacimiento = haceAnios(10);
    const s = await emitir(nacimiento, "1.1-a");
    const f = await fila(s.id);
    expect(f.nacimiento).toBe(nacimiento);
    expect(f.declaracion_version).toBe("1.1-a");
  }, 30_000);

  // LA PANTALLA DEL PACIENTE SOLO SABE LA RAMA, no la fecha ni el documento: son datos del paciente y no
  // hacen falta para pintar la pagina.
  it("la pagina publica sabe la rama, y nada mas del paciente", async () => {
    const s = await emitir(haceAnios(16), "1.1-b");
    const r = await sesionData.resolverSesionPorToken(s.token);
    expect(r.esDeMenor).toBe(true);
    expect(r.pideAsentimiento).toBe(true);
    expect(Object.keys(r).sort()).toEqual([
      "esDeMenor",
      "estado",
      "pideAsentimiento",
      "professionalId",
      "vigente",
    ]);
  }, 30_000);

  it("un menor de 14 abre la 1.1-a, y ahi NO se pide asentimiento", async () => {
    const s = await emitir(haceAnios(10), "1.1-a");
    const r = await sesionData.resolverSesionPorToken(s.token);
    expect(r.esDeMenor).toBe(true);
    expect(
      r.pideAsentimiento,
      "la 1.1-a no afirma el asentimiento, asi que la pantalla no lo puede pedir",
    ).toBe(false);
  }, 30_000);

  it("el representante confirma, y queda registrado con su parentesco", async () => {
    const s = await emitir(haceAnios(16), "1.1-b");
    const r = await sesionData.confirmarSesionPresencial({
      token: s.token,
      nombres: "Menor",
      apellidos: "De Prueba",
      documentType: "TI",
      documentNumber: await documentoDe(s.id),
      autorizaciones: ["servicio", "datos_sensibles", "aceptacion_medio_electronico"],
      representante: {
        nombre: "Madre De Prueba",
        documento: "ZZ-REP-1",
        parentesco: "madre",
        email: null,
      },
      asentimientoMenor: true,
    });
    expect(r.estado).toBe("confirmada");

    const f = await fila(s.id);
    expect(f.representante_nombre).toBe("Madre De Prueba");
    expect(f.representante_parentesco).toBe("madre");
    expect(
      f.representante_email,
      "EL CORREO PUEDE FALTAR: es la unica diferencia con el camino remoto y la razon de esta pieza",
    ).toBeNull();
    expect(f.asentimiento_menor).toBe(true);
  }, 30_000);

  it("la rama de menor SIN los datos del representante no confirma, y lo dice", async () => {
    const s = await emitir(haceAnios(16), "1.1-b");
    const r = await sesionData.confirmarSesionPresencial({
      token: s.token,
      nombres: "Menor",
      apellidos: "De Prueba",
      documentType: "TI",
      documentNumber: await documentoDe(s.id),
      autorizaciones: ["servicio", "datos_sensibles", "aceptacion_medio_electronico"],
    });
    expect(r.estado).toBe("faltan_datos_del_representante");
    const f = await fila(s.id);
    expect(f.confirmed_at, "no se confirma a medias").toBeNull();
  }, 30_000);

  it("y la 1.1-b sin el asentimiento del menor tampoco: la declaracion lo afirma", async () => {
    const s = await emitir(haceAnios(16), "1.1-b");
    const r = await sesionData.confirmarSesionPresencial({
      token: s.token,
      nombres: "Menor",
      apellidos: "De Prueba",
      documentType: "TI",
      documentNumber: await documentoDe(s.id),
      autorizaciones: ["servicio", "datos_sensibles", "aceptacion_medio_electronico"],
      representante: { nombre: "Padre", documento: "ZZ-REP-2", parentesco: "padre", email: null },
      asentimientoMenor: false,
    });
    expect(r.estado).toBe("faltan_datos_del_representante");
  }, 30_000);

  // EN LA RAMA MAYOR NO SE GUARDA REPRESENTANTE aunque el formulario lo mande: la declaracion 1.0 afirma
  // que marco EL PACIENTE, y un representante colgando de esa fila la contradice.
  it("un pase de MAYOR ignora un representante que llegue de todos modos", async () => {
    const s = await emitir(haceAnios(30), "1.0");
    const r = await sesionData.confirmarSesionPresencial({
      token: s.token,
      nombres: "Adulto",
      apellidos: "De Prueba",
      documentType: "TI",
      documentNumber: await documentoDe(s.id),
      autorizaciones: ["servicio", "datos_sensibles", "aceptacion_medio_electronico"],
      representante: { nombre: "Colado", documento: "ZZ-REP-3", parentesco: "tutor", email: null },
      asentimientoMenor: true,
    });
    expect(r.estado).toBe("confirmada");
    const f = await fila(s.id);
    expect(f.representante_nombre).toBeNull();
    expect(f.asentimiento_menor, "ni el asentimiento, que ahi no significa nada").toBeNull();
  }, 30_000);

  // ── LO QUE DEFIENDE LA BASE, por si alguna vez se escribe sin pasar por el escritor ──
  it("LA BASE rechaza el asentimiento en una version que no lo afirma", async () => {
    const s = await emitir(haceAnios(10), "1.1-a");
    const e = await db
      .execute(
        dsql`update presencial_consent_sessions
                set representante_nombre = 'X', representante_documento = 'Y',
                    representante_parentesco = 'madre', asentimiento_menor = true
              where id = ${s.id}`,
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    // Drizzle envuelve el error de Postgres: el nombre de la restriccion va en la causa.
    expect(e, "la base tiene que negarse").not.toBeNull();
    expect(String((e as { cause?: unknown }).cause)).toMatch(/rama_de_edad_coherente/i);
  }, 30_000);

  it("y rechaza confirmar la rama menor sin representante", async () => {
    const s = await emitir(haceAnios(16), "1.1-b");
    const e = await db
      .execute(
        // LAS AUTORIZACIONES VAN PUESTAS a proposito: sin ellas salta OTRO check (el de la 0109) y este
        // candado pasaria por una razon que no es la suya.
        dsql`update presencial_consent_sessions
                set confirmed_at = now(), estado = 'confirmada',
                    declarado_autorizaciones = '["servicio"]'::jsonb
              where id = ${s.id}`,
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(e).not.toBeNull();
    expect(String((e as { cause?: unknown }).cause)).toMatch(/rama_de_edad_coherente/i);
  }, 30_000);
});
