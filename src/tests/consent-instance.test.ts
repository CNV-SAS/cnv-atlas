import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildConsentInstance, type ConsentInstanceData } from "@/modules/consent/consent-instance";
import { CONSENT_TEXT_V1_7 } from "@/modules/consent/text/consent-v1.7";

// Golden de la capa de INSTANCIA del consentimiento (B7). Ancla los DOS casos enteros (adulto y menor
// 14-17) y un tercero (menor de 14: representante SI, asentimiento NO), no solo "no aparece el bloque
// del menor". Si un corte se lleva de mas o de menos, o un relleno cambia, el diff exacto salta.
//
// Los fixtures se generan con fecha PENDIENTE (acceptedAt null) para que el golden sea determinista: el
// formato de fecha depende de ICU/Node. La fecha real se prueba aparte (regex, no exacto).

const PROF = { fullName: "Ana Gómez Ruiz", profession: "Nutricionista", license: "NUT-12345" };
const ACCEPTED_AT = 1_754_000_000_000;

// Las 3 necesarias + la casilla del medio electronico (siempre marcadas para poder firmar).
const NECESSARY = ["servicio", "datos_sensibles", "internacional_ia", "aceptacion_medio_electronico"];

const mayor: ConsentInstanceData = {
  branch: "mayor",
  patient: { name: "Juan Pérez López", document: "CC 1234567890" },
  professional: PROF,
  granted: [...NECESSARY, "investigacion"], // una opcional marcada, las otras dos no
  acceptedAt: null,
};

const menor1417: ConsentInstanceData = {
  branch: "menor",
  patient: { name: "Sofía Ramírez", document: "TI 1122334455" },
  professional: PROF,
  representative: {
    name: "María Ramírez",
    document: "CC 9988776655",
    relationship: "madre",
    email: "maria@example.com",
  },
  assent: { applies: true, minorName: "Sofía Ramírez" },
  granted: [...NECESSARY, "comunicaciones_continuidad"],
  acceptedAt: null,
};

const menor12: ConsentInstanceData = {
  ...menor1417,
  patient: { name: "Diego Ramírez", document: "TI 5544332211" },
  representative: {
    name: "Carlos Ramírez",
    document: "CC 1010101010",
    relationship: "tutor", // ejercita el mapeo a "tutor legal"
    email: "carlos@example.com",
  },
  assent: { applies: false, minorName: "Diego Ramírez" },
  granted: [...NECESSARY], // solo necesarias
};

// Lee un fixture normalizando saltos de linea (git puede checkout con CRLF; la funcion produce LF).
function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/consent/${name}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

describe("consent-instance: golden de los casos enteros", () => {
  it("adulto: solo su declaracion + firma propia; sin bloque de representante ni asentimiento", () => {
    expect(buildConsentInstance(CONSENT_TEXT_V1_7, mayor)).toBe(fixture("instance-mayor.md"));
  });

  it("menor 14-17: representante + asentimiento marcado; sin declaracion de mayoria", () => {
    expect(buildConsentInstance(CONSENT_TEXT_V1_7, menor1417)).toBe(
      fixture("instance-menor-1417.md"),
    );
  });

  it("menor de 14: representante SI, asentimiento NO (no queda un bloque de asentimiento vacio)", () => {
    expect(buildConsentInstance(CONSENT_TEXT_V1_7, menor12)).toBe(fixture("instance-menor-12.md"));
  });
});

describe("consent-instance: invariantes de rama (belt-and-suspenders sobre el golden)", () => {
  it("el adulto NO ve los bloques de datos/firma del menor", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, mayor);
    // Los BLOQUES del menor no aparecen (la palabra "representante" si sobrevive en la nota
    // interpretativa del numeral 2, que se conserva a proposito: no es un bloque de datos).
    expect(out).not.toContain("Datos del representante legal");
    expect(out).not.toContain("Nombre completo del representante");
    expect(out).not.toContain("Asentimiento del menor");
    expect(out).not.toContain("Si el paciente es menor de 18 años");
    // pero conserva SU propia declaracion (el corte no se la lleva)
    expect(out).toContain("Declaro que soy mayor de 18 años y actúo en nombre propio.");
  });

  it("el menor NO ve la declaracion de mayoria de edad", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, menor1417);
    expect(out).not.toContain("Declaro que soy mayor de 18 años");
    expect(out).toContain("otorgado por su representante legal");
  });
});

describe("consent-instance: reglas de relleno", () => {
  it("dato faltante omite el segmento, no deja placeholder ni raya (licencia null)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, { ...mayor, professional: { ...PROF, license: null } });
    expect(out).toContain("> **Profesional:** `Ana Gómez Ruiz` — `Nutricionista`");
    expect(out).not.toContain("Registro profesional No.");
    expect(out).not.toContain("{{professional_license}}");
  });

  it("dato faltante omite el bullet completo (representante sin correo)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, {
      ...menor1417,
      representative: { ...menor1417.representative!, email: "" },
    });
    expect(out).not.toContain("Correo electrónico:");
    expect(out).not.toContain("`____"); // ninguna raya cruda queda
  });

  it("nunca deja placeholders crudos del profesional", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, mayor);
    expect(out).not.toContain("{{professional_full_name}}");
    expect(out).not.toContain("{{professional_profession}}");
    expect(out).not.toContain("se rellena automáticamente");
  });

  it("con fecha real, la línea de fecha lleva una fecha (no la pendiente ni una raya)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, { ...mayor, acceptedAt: ACCEPTED_AT });
    expect(out).toMatch(/\*\*Fecha:\*\* `.*20\d\d.*`/); // contiene un año
    expect(out).not.toContain("(se generará al confirmar)");
    expect(out).not.toContain("(generada automáticamente por ATLAS)");
  });
});

describe("consent-instance: casillas del numeral 12 (lo que autorizó)", () => {
  it("marca las otorgadas y deja SIN marcar las no otorgadas (no marcó != no se sabe)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, mayor); // necesarias + investigacion
    expect(out).toContain("- [x] Autorizo el tratamiento de mis datos personales para las finalidades necesarias");
    expect(out).toContain("- [x] Acepto que este consentimiento se otorga por medios electrónicos");
    expect(out).toContain("- [x] Autorizo el uso de mis datos seudonimizados para investigación");
    // las dos opcionales NO otorgadas quedan en blanco (prueban que se ofrecieron y se declinaron)
    expect(out).toContain("- [ ] Autorizo recibir comunicaciones de continuidad");
    expect(out).toContain("- [ ] Autorizo recibir comunicaciones comerciales");
  });

  it("sin opcionales, las tres opcionales quedan en blanco y las necesarias marcadas", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, menor12); // solo necesarias
    expect(out).toContain("- [x] Autorizo el tratamiento de mis datos sensibles de salud");
    expect(out).toContain("- [ ] Autorizo el uso de mis datos seudonimizados para investigación");
    expect(out).toContain("- [ ] Autorizo recibir comunicaciones de continuidad");
  });
});

describe("consent-instance: casilla de parentesco en la declaración (numeral 11)", () => {
  it("marca la casilla elegida y muestra su etiqueta en el campo (madre)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, menor1417);
    expect(out).toContain("☑ madre");
    expect(out).toContain("☐ padre"); // las otras quedan sin marcar
    expect(out).toContain("- Parentesco o calidad: `Madre`");
  });

  it("mapea el valor a la casilla correcta (tutor -> tutor legal)", () => {
    const out = buildConsentInstance(CONSENT_TEXT_V1_7, menor12);
    expect(out).toContain("☑ tutor legal");
    expect(out).toContain("- Parentesco o calidad: `Tutor legal`");
  });
});

describe("consent-instance: representante pendiente en pantalla (sin encabezado huérfano)", () => {
  const pending = "*(Se completarán con los datos del representante.)*";
  const out = buildConsentInstance(CONSENT_TEXT_V1_7, {
    branch: "menor",
    patient: { name: "(se completará con tus datos)", document: "(se completará con tus datos)" },
    professional: PROF,
    representative: { name: "", document: "", relationship: "", email: "" }, // aun sin escribir
    assent: { applies: true, minorName: "(se completará con tus datos)" },
    granted: [],
    acceptedAt: null,
    representativePending: pending,
  });

  it("muestra una línea pendiente, no rayas crudas ni bullets vacíos", () => {
    expect(out).toContain(pending);
    expect(out).not.toContain("- Nombre completo: `"); // ninguna raya de campo del representante
    expect(out).not.toContain("- Correo electrónico: `");
    expect(out).not.toContain("del representante: `");
  });

  it("el encabezado del bloque NO queda huérfano (la línea pendiente va justo después)", () => {
    expect(out).toContain(`**Datos del representante legal**:\n\n${pending}`);
  });
});

describe("consent-instance: robustez y pureza", () => {
  it("ante una plantilla sin las anclas, devuelve el texto intacto (no revienta, no deja en blanco)", () => {
    const garbage = "# Documento distinto\n\nSin anclas conocidas.\n";
    expect(buildConsentInstance(garbage, mayor)).toBe(garbage);
  });

  it("no muta la plantilla congelada (opera sobre una copia)", () => {
    buildConsentInstance(CONSENT_TEXT_V1_7, menor1417);
    expect(CONSENT_TEXT_V1_7).toContain("{{professional_full_name}}");
    expect(CONSENT_TEXT_V1_7).toContain("________________________________");
  });
});
