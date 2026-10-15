import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  hechosDelConsentimiento,
  motivoDeRegularizacion,
  rotuloDeRegularizacion,
} from "@/modules/consent/regularizacion";
import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ PIEZA 2 DEL CONSENTIMIENTO: UN REGISTRO QUE EXISTE Y NO ALCANZA (legal, 2026-10-09) ═══
//
// EL CASO: pacientes MENORES que consintieron por el QR cuando ese camino no tenia rama de menor, asi que su
// consentimiento quedo guardado SIN REPRESENTANTE. Tienen las tres autorizaciones necesarias vigentes y
// ninguna la otorgo quien podia otorgarla.
//
// LO QUE EL DICTAMEN PIDE, y es lo que este candado vigila:
//   · el registro NO se borra ni se invalida (es la evidencia de que algo se firmo ese dia);
//   · "valido" EXCLUYE un consentimiento de menor sin representante, y por eso el gate lo frena;
//   · el profesional sigue atendiendo: lo que se frena es crear evaluaciones NUEVAS;
//   · y el paso del tiempo no inventa casos: lo que se busca es un error, no que alguien cumpla años.

const UN_MENOR = {
  fechaDeNacimiento: "2013-05-20",
  firmadoEl: "2026-03-01T15:00:00.000Z", // 12 años
  tieneRepresentanteVigente: false,
};

describe("el motivo de regularizacion", () => {
  it("marca al menor que firmo sin representante, y FRENA", () => {
    const m = motivoDeRegularizacion(UN_MENOR);
    expect(m?.clave).toBe("menor_sin_representante");
    expect(m?.frenaEvaluaciones).toBe(true);
  });

  it("no marca nada si el menor SI tiene representante vigente", () => {
    expect(motivoDeRegularizacion({ ...UN_MENOR, tieneRepresentanteVigente: true })).toBeNull();
  });

  it("no marca a un adulto", () => {
    expect(
      motivoDeRegularizacion({
        fechaDeNacimiento: "1990-01-01",
        firmadoEl: "2026-03-01T15:00:00.000Z",
        tieneRepresentanteVigente: false,
      }),
    ).toBeNull();
  });

  it("mide la edad EL DIA DE LA FIRMA, no hoy: quien firmo siendo adulto siempre firmo bien", () => {
    // El control que importa: si midiera contra hoy, un paciente nacido en 2010 que firmo en 2030 saldria
    // adulto y uno que firmo en 2026 saldria menor SEGUN CUANDO SE ABRA LA PANTALLA. Lo que se busca es el
    // hecho del dia del acto, que no cambia nunca.
    const nacido2010 = { fechaDeNacimiento: "2010-06-15", tieneRepresentanteVigente: false };
    expect(motivoDeRegularizacion({ ...nacido2010, firmadoEl: "2026-06-14T12:00:00.000Z" })?.clave).toBe(
      "menor_sin_representante",
    );
    // Un dia despues cumple 16... sigue siendo menor. A los 18 ya no.
    expect(motivoDeRegularizacion({ ...nacido2010, firmadoEl: "2028-06-16T12:00:00.000Z" })).toBeNull();
  });

  it("el limite exacto: el dia que cumple 18 ya puede consentir solo", () => {
    const nacido = { fechaDeNacimiento: "2008-07-10", tieneRepresentanteVigente: false };
    expect(motivoDeRegularizacion({ ...nacido, firmadoEl: "2026-07-09T12:00:00.000Z" })?.clave).toBe(
      "menor_sin_representante",
    );
    expect(motivoDeRegularizacion({ ...nacido, firmadoEl: "2026-07-10T12:00:00.000Z" })).toBeNull();
  });

  it("una fecha POSTERIOR a la firma es su propio motivo, y NO pide representante", () => {
    // Hay pacientes con fecha de nacimiento en el futuro (la familia de "la fecha imposible"). Su edad al
    // firmar sale negativa, o sea menor de 18. Sin esta rama, el sistema le pediria la mama a un adulto.
    const m = motivoDeRegularizacion({
      fechaDeNacimiento: "2049-01-01",
      firmadoEl: "2026-03-01T15:00:00.000Z",
      tieneRepresentanteVigente: false,
    });
    expect(m?.clave).toBe("fecha_de_nacimiento_imposible");
    expect(m?.frenaEvaluaciones).toBe(false);
  });

  it("sin fecha de nacimiento o sin firma no concluye nada, y NO frena", () => {
    expect(motivoDeRegularizacion({ ...UN_MENOR, fechaDeNacimiento: null })).toBeNull();
    expect(motivoDeRegularizacion({ ...UN_MENOR, firmadoEl: null })).toBeNull();
  });

  it("una rama que ya no corresponde se marca para revision, pero NO frena la atencion", () => {
    const m = motivoDeRegularizacion({
      fechaDeNacimiento: "1990-01-01",
      firmadoEl: "2026-03-01T15:00:00.000Z",
      tieneRepresentanteVigente: false,
      ramaIncoherente: { versionQueSeUso: "1.1-a", versionQueCorresponde: "1.0" },
    });
    expect(m?.clave).toBe("rama_que_ya_no_corresponde");
    expect(m?.frenaEvaluaciones).toBe(false);
  });

  it("cada motivo tiene rotulo y dice QUE HACER", () => {
    for (const m of [
      motivoDeRegularizacion(UN_MENOR),
      motivoDeRegularizacion({
        fechaDeNacimiento: "2049-01-01",
        firmadoEl: "2026-03-01T15:00:00.000Z",
        tieneRepresentanteVigente: false,
      }),
      motivoDeRegularizacion({
        fechaDeNacimiento: "1990-01-01",
        firmadoEl: "2026-03-01T15:00:00.000Z",
        tieneRepresentanteVigente: false,
        ramaIncoherente: { versionQueSeUso: "1.1-a", versionQueCorresponde: "1.0" },
      }),
    ]) {
      expect(m).not.toBeNull();
      expect(rotuloDeRegularizacion(m!).length).toBeGreaterThan(5);
      // Un aviso que solo dice que algo esta mal deja al profesional sin salida (guard correcto mal expuesto).
      expect(m!.queHacer.length).toBeGreaterThan(40);
    }
  });
});

describe("los hechos se arman en un solo sitio", () => {
  it("la firma que cuenta es la MAS RECIENTE de las necesarias", () => {
    // Un menor que firmo a los 13 y volvio a firmar a los 19 ya tiene un consentimiento de quien podia darlo.
    const h = hechosDelConsentimiento({
      fechaDeNacimiento: "2007-01-01",
      consents: [
        { consent_type: "servicio", signed_at: "2019-05-01T12:00:00.000Z" },
        { consent_type: "datos_sensibles", signed_at: "2026-05-01T12:00:00.000Z" },
      ],
    });
    expect(h.firmadoEl).toBe("2026-05-01T12:00:00.000Z");
    expect(motivoDeRegularizacion(h)).toBeNull();
  });

  it("no mira la fecha de las OPCIONALES: no son las que el gate exige", () => {
    const h = hechosDelConsentimiento({
      fechaDeNacimiento: "2007-01-01",
      consents: [
        { consent_type: "servicio", signed_at: "2019-05-01T12:00:00.000Z" },
        { consent_type: "comunicaciones_comerciales", signed_at: "2026-05-01T12:00:00.000Z" },
      ],
    });
    expect(h.firmadoEl).toBe("2019-05-01T12:00:00.000Z");
  });

  it("reconoce al representante por su autorizacion, no por una columna aparte", () => {
    const h = hechosDelConsentimiento({
      fechaDeNacimiento: "2013-01-01",
      consents: [
        { consent_type: "servicio", signed_at: "2026-05-01T12:00:00.000Z" },
        { consent_type: "representante_legal", signed_at: "2026-05-01T12:00:00.000Z" },
      ],
    });
    expect(h.tieneRepresentanteVigente).toBe(true);
    expect(motivoDeRegularizacion(h)).toBeNull();
  });

  it("una sesion presencial cuya fecha congelada ya no corresponde entra como rama incoherente", () => {
    const h = hechosDelConsentimiento({
      // Hoy dice que nacio en 2013 (menor el dia del acto); al emitir el pase decia 1990 (adulto).
      fechaDeNacimiento: "2013-01-01",
      consents: [{ consent_type: "servicio", signed_at: "2026-05-01T12:00:00.000Z" }],
      sesiones: [
        {
          confirmed_at: "2026-05-01T12:00:00.000Z",
          patient_birth_date: "1990-01-01",
          declaracion_version: "1.0",
        },
      ],
    });
    expect(h.ramaIncoherente).not.toBeNull();
  });

  it("y si las dos fechas dan la MISMA rama, no hay nada que revisar", () => {
    const h = hechosDelConsentimiento({
      fechaDeNacimiento: "1990-01-02",
      consents: [{ consent_type: "servicio", signed_at: "2026-05-01T12:00:00.000Z" }],
      sesiones: [
        {
          confirmed_at: "2026-05-01T12:00:00.000Z",
          patient_birth_date: "1990-01-01",
          declaracion_version: "1.0",
        },
      ],
    });
    expect(h.ramaIncoherente).toBeNull();
  });
});

describe("el gate (regla dura 15) lo ejerce", () => {
  const LAS_TRES = ["servicio", "datos_sensibles"] as const;

  it("con las necesarias y un menor sin representante, NO autoriza", () => {
    const g = canCreateEvaluation(LAS_TRES as never, motivoDeRegularizacion(UN_MENOR));
    expect(g.ok).toBe(false);
    // Y no miente sobre lo que falta: no hay autorizaciones ausentes, hay una que no sirve.
    expect(g.ok === false && g.missing).toEqual([]);
    expect(g.ok === false && g.regularizar?.clave).toBe("menor_sin_representante");
  });

  it("los motivos que no frenan NO bloquean la atencion", () => {
    const g = canCreateEvaluation(
      LAS_TRES as never,
      motivoDeRegularizacion({
        fechaDeNacimiento: "2049-01-01",
        firmadoEl: "2026-03-01T15:00:00.000Z",
        tieneRepresentanteVigente: false,
      }),
    );
    expect(g.ok).toBe(true);
  });

  it("si faltan necesarias, eso manda: el motivo no sustituye a lo que falta", () => {
    const g = canCreateEvaluation(["servicio"] as never, motivoDeRegularizacion(UN_MENOR));
    expect(g.ok).toBe(false);
    expect(g.ok === false && g.missing.length).toBeGreaterThan(0);
    expect(g.ok === false && g.regularizar).toBeNull();
  });
});

// ═══ Y LOS CABLES: UN GUARD SIN SUPERFICIE QUE LO ALCANCE NO EXISTE ═══
//
// Es la leccion de [[guard-sin-superficie-que-lo-alcance]] y la de [[pieza-terminada-sin-el-ultimo-cable]]:
// la derivacion puede ser perfecta y no llegar a ninguna pantalla. Estas comprobaciones son estaticas porque
// lo que vigilan es que el cable SIGA puesto, no que el texto sea bonito.

describe("los cables de la pieza 2", () => {
  const SEGUIMIENTO = sinComentarios(readFileSync("src/modules/evaluations/data/intake-writer.ts", "utf8"));
  const FICHA = sinComentarios(readFileSync("src/app/(app)/pacientes/[patientId]/page.tsx", "utf8"));
  const PANEL = sinComentarios(
    readFileSync("src/modules/consent/components/panel-autorizaciones.tsx", "utf8"),
  );
  const LISTA_LECTOR = sinComentarios(
    readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8"),
  );
  const LISTA = sinComentarios(readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8"));

  it("el seguimiento SIN FIRMA lo mira: es el gate que el dictamen nombra", () => {
    // "En la proxima evaluacion, el gate pide el consentimiento con la rama de menor". Si este cable se
    // cayera, un consentimiento insuficiente serviria para siempre y nada lo diria.
    expect(SEGUIMIENTO).toContain("startFollowupWithoutSignature");
    expect(SEGUIMIENTO).toContain("motivoDeRegularizacion");
    expect(SEGUIMIENTO).toContain("ConsentimientoPendienteDeRegularizarError");
  });

  it("la ficha del paciente lo pide y el panel lo pinta", () => {
    expect(FICHA).toContain("getRegularizacionDelPaciente");
    expect(FICHA).toContain("pendienteDeRegularizar={pendienteDeRegularizar}");
    expect(PANEL).toContain("rotuloDeRegularizacion");
    expect(PANEL).toContain("queHacer");
  });

  it("la lista lo rotula, y NO lo mete en 'sin autorizacion vigente'", () => {
    expect(LISTA_LECTOR).toContain("pendienteDeRegularizar: regularizar");
    expect(LISTA).toContain("rotuloDeRegularizacion");
    // EL CONTROL QUE IMPORTA: el rotulo de arriba dice que el paciente RETIRO algo. Un menor sin
    // representante no retiro nada, asi que ese booleano se calcula con `null` y los dos estados quedan
    // separados. Si volvieran a juntarse, la lista afirmaria una revocacion que no existe.
    expect(LISTA_LECTOR).toMatch(/sinAutorizacionVigente: !canCreateEvaluation\(vigentes, null\)\.ok/);
  });

  it("y el freno no puede subir como excepcion: seria un 500 en medio de la encuesta", () => {
    const ACCIONES = sinComentarios(readFileSync("src/modules/evaluations/actions.ts", "utf8"));
    const INTAKE = sinComentarios(readFileSync("src/modules/evaluations/services/survey-intake.ts", "utf8"));
    const QR = sinComentarios(readFileSync("src/modules/consent/actions.qr.ts", "utf8"));
    for (const [nombre, src] of [
      ["actions", ACCIONES],
      ["survey-intake", INTAKE],
      ["actions.qr", QR],
    ] as const) {
      expect(src, `${nombre} dejo de atrapar el freno de la pieza 2`).toContain(
        "instanceof ConsentimientoPendienteDeRegularizarError",
      );
    }
  });
});
