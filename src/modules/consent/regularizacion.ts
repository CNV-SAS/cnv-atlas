import { ramaSigueCorrespondiendo } from "./text/declaracion-presencial";
import { computeAgeYears, isMinorAge, NECESSARY_CONSENT_TYPES } from "./validations";

// ═══ UN CONSENTIMIENTO QUE EXISTE PERO NO ALCANZA (pieza 2, dictamen legal del 2026-10-09) ═══
//
// ── EL CASO QUE LA OBLIGA ────────────────────────────────────────────────────────────────────────
//
// Hubo pacientes MENORES que consintieron por el QR, que entonces no tenia rama de menor, asi que su
// consentimiento quedo guardado SIN REPRESENTANTE. La prevencion ya esta construida y vive en el unico
// escritor de consentimientos (`ConsentimientoDeMenorSinRepresentanteError`, decidida por la EDAD y no por
// la rama declarada), asi que esto no puede volver a entrar. **Lo que faltaba es que lo ya guardado se
// reconozca**, porque hoy se ve igual que uno completo.
//
// ── LO QUE DICE EL DICTAMEN, Y LO QUE ESTE MODULO NO HACE ────────────────────────────────────────
//
// Textual: *"el registro actual no se borra. Se conserva marcado como insuficiente, porque es la evidencia
// de que algo se firmo ese dia. Borrarlo empeoraria la posicion."* Y: *"el profesional trabaja normalmente
// con ese paciente. La historia es suya y la atencion sigue. En la proxima evaluacion, el gate pide el
// consentimiento con la rama de menor."*
//
// Asi que este modulo NO invalida nada, NO escribe nada y NO toca la historia. Solo DERIVA un estado de
// hechos que ya estan guardados, para que el gate y la ficha lo puedan decir. Es la misma forma de la
// marca de prueba (0203): una respuesta con varios insumos, no un filtro repetido en cada lector.
//
// ── Y EL SEGUNDO MOTIVO ES DEL MISMO HALLAZGO, UN MES DESPUES ───────────────────────────────────
//
// El abogado (2026-10-14) nombro una consecuencia de congelar la fecha de nacimiento al emitir el pase:
// *"si esa fecha esta mal digitada y se corrige despues, el consentimiento ya firmado quedo bajo la rama
// equivocada, y nada lo va a detectar."* Es la MISMA clase de hecho (un registro que afirma algo que no
// corresponde), asi que entra aqui como otro motivo y no como un mecanismo aparte: darle el suyo seria un
// segundo constructor del mismo insumo.

/** Por que un consentimiento guardado no alcanza. El orden del tipo es el orden de gravedad. */
export type MotivoDeRegularizacion =
  | {
      clave: "menor_sin_representante";
      /** Años cumplidos el dia que firmo. */
      edadAlFirmar: number;
      /** FRENA evaluaciones nuevas: quien firmo no tenia capacidad para autorizar. */
      frenaEvaluaciones: true;
      queHacer: string;
    }
  | {
      clave: "rama_que_ya_no_corresponde";
      versionQueSeUso: string | null;
      versionQueCorresponde: string | null;
      /** NO frena: el consentimiento puede estar bien; lo que hace falta es que alguien lo mire. */
      frenaEvaluaciones: false;
      queHacer: string;
    }
  | {
      clave: "fecha_de_nacimiento_imposible";
      /** Negativa: la fecha de nacimiento es POSTERIOR al dia en que firmo. */
      edadAlFirmar: number;
      frenaEvaluaciones: false;
      queHacer: string;
    };

export type HechosDelConsentimiento = {
  /** La del paciente HOY, en `patient_profiles`. null: no se sabe, y entonces no se concluye nada. */
  fechaDeNacimiento: string | null;
  /**
   * El dia en que firmo la mas reciente de sus autorizaciones NECESARIAS vigentes. null: no tiene
   * ninguna, y entonces el gate ya lo frena por otra razon (le faltan autorizaciones).
   */
  firmadoEl: string | null;
  /** Tiene una autorizacion `representante_legal` VIGENTE. */
  tieneRepresentanteVigente: boolean;
  /**
   * De la sesion presencial confirmada (0216): la rama que se uso contra la que corresponderia con la
   * fecha de nacimiento de hoy. null cuando no hay sesion presencial o cuando las dos coinciden.
   */
  ramaIncoherente?: { versionQueSeUso: string | null; versionQueCorresponde: string | null } | null;
};

/**
 * El motivo por el que este consentimiento esta pendiente de regularizar, o null si esta completo.
 *
 * ── LA FALTA DE DATOS NO FRENA, Y ES UNA DECISION ───────────────────────────────────────────────
 *
 * Sin fecha de nacimiento no se puede saber si era menor, y entonces no se concluye nada. Frenar por un
 * dato ausente pararia la atencion de un paciente real por un hueco de captura que tiene su propio
 * arreglo, y eso es peor que el riesgo que se quiere cubrir: el guard de la escritura ya impide que entre
 * uno nuevo.
 */
export function motivoDeRegularizacion(h: HechosDelConsentimiento): MotivoDeRegularizacion | null {
  if (h.fechaDeNacimiento && h.firmadoEl) {
    const edadAlFirmar = computeAgeYears(h.fechaDeNacimiento, new Date(h.firmadoEl));

    // ── UNA FECHA POSTERIOR A LA FIRMA ES OTRO PROBLEMA, Y NO SE DISFRAZA DE ESTE ──────────────
    //
    // Hay pacientes con fecha de nacimiento en el FUTURO (la familia de "la fecha imposible", tres
    // correcciones en octubre). Su edad al firmar sale NEGATIVA, o sea menor de 18, y sin esta rama el
    // sistema le pediria un representante legal a alguien de 40 años. El profesional iria a buscar a la
    // mama de un adulto en vez de corregir un digito, que es lo unico que hay que hacer.
    if (edadAlFirmar != null && edadAlFirmar < 0) {
      return {
        clave: "fecha_de_nacimiento_imposible",
        edadAlFirmar,
        frenaEvaluaciones: false,
        queHacer:
          "La fecha de nacimiento es posterior al día en que firmó, así que está mal digitada. Corrígela en la ficha: después de corregirla el sistema vuelve a revisar el consentimiento por su cuenta.",
      };
    }

    if (isMinorAge(edadAlFirmar) && !h.tieneRepresentanteVigente) {
      return {
        clave: "menor_sin_representante",
        edadAlFirmar: edadAlFirmar as number,
        frenaEvaluaciones: true,
        queHacer:
          "Era menor de edad el día que firmó y no quedó registrado su representante legal, así que ese consentimiento no lo autorizaba quien tenía que autorizarlo. No se borra: queda como la constancia de lo que se firmó ese día. Para volver a evaluarlo, firma el consentimiento de nuevo con la rama que corresponda a su edad de hoy; si hoy sigue siendo menor, el representante recibe el código y firma él.",
      };
    }
  }

  if (h.ramaIncoherente) {
    return {
      clave: "rama_que_ya_no_corresponde",
      versionQueSeUso: h.ramaIncoherente.versionQueSeUso,
      versionQueCorresponde: h.ramaIncoherente.versionQueCorresponde,
      frenaEvaluaciones: false,
      queHacer:
        "El consentimiento se firmó con el texto que correspondía a la fecha de nacimiento que tenía entonces, y esa fecha se corrigió después: hoy le correspondería otro texto. Revísalo con el paciente. Si la fecha de hoy es la correcta y lo deja del lado de menor de edad, hay que volver a firmarlo con su representante.",
    };
  }

  return null;
}

/**
 * Lo mismo, dicho en una linea para un rotulo de lista.
 *
 * VIVE AQUI Y NO EN EL COMPONENTE para que la lista y la ficha no puedan nombrar distinto el mismo estado,
 * que es el defecto del hazard 4 (dos partes de la pantalla que leen fuentes distintas).
 */
export function rotuloDeRegularizacion(m: MotivoDeRegularizacion): string {
  switch (m.clave) {
    case "menor_sin_representante":
      return "Consentimiento de menor sin representante";
    case "rama_que_ya_no_corresponde":
      return "Consentimiento por revisar (cambió la fecha de nacimiento)";
    case "fecha_de_nacimiento_imposible":
      return "Fecha de nacimiento imposible";
  }
}

/**
 * ARMA LOS HECHOS a partir de las filas crudas, para que la ficha y la lista de pacientes no los puedan
 * armar distinto.
 *
 * ES LA MITAD QUE DE VERDAD SE EQUIVOCA. La derivacion de arriba es corta y tiene candado; lo que se
 * desalinea entre dos pantallas es esto: cual firma se mira, si se cuentan las revocadas, que se hace con
 * varias sesiones. Vivia en los dos lectores y ahora vive una vez (hazard 4: dos partes de la pantalla que
 * dicen cosas opuestas no es que una este mal, es que LEEN FUENTES DISTINTAS).
 */
export function hechosDelConsentimiento(crudo: {
  fechaDeNacimiento: string | null;
  /** Autorizaciones VIGENTES del paciente (ya filtradas por `revoked_at is null`). */
  consents: readonly { consent_type: string; signed_at?: string | null }[];
  /** Sesiones presenciales CONFIRMADAS y con la fecha congelada. Puede venir vacio. */
  sesiones?: readonly {
    confirmed_at: string | null;
    patient_birth_date: string | null;
    declaracion_version?: string | null;
  }[];
}): HechosDelConsentimiento {
  // ── LA FIRMA QUE CUENTA ES LA MAS RECIENTE DE LAS NECESARIAS ───────────────────────────────────
  //
  // Y no la primera: si el paciente re-consintio, lo que decide si quien autorizo podia autorizar es el
  // ULTIMO acto, no el de hace dos años. Un menor que firmo a los 13 y volvio a firmar a los 19 ya tiene
  // un consentimiento otorgado por quien podia otorgarlo.
  const necesarias = new Set<string>(NECESSARY_CONSENT_TYPES);
  const firmas = crudo.consents
    .filter((c) => necesarias.has(c.consent_type) && c.signed_at)
    .map((c) => c.signed_at as string)
    .sort();
  const tieneRepresentanteVigente = crudo.consents.some(
    (c) => c.consent_type === "representante_legal",
  );

  // ── LA RAMA INCOHERENTE: CUALQUIERA DE SUS SESIONES BASTA ─────────────────────────────────────
  //
  // Si tuvo dos actos presenciales y uno quedo bajo la rama equivocada, hay algo que revisar aunque el
  // otro este bien. Se devuelve el primero que aparezca: la pantalla manda a revisar, no a contar.
  let ramaIncoherente: HechosDelConsentimiento["ramaIncoherente"] = null;
  for (const s of crudo.sesiones ?? []) {
    if (!s.confirmed_at) continue;
    const r = ramaSigueCorrespondiendo({
      fechaAlEmitir: s.patient_birth_date,
      fechaDeHoy: crudo.fechaDeNacimiento,
      diaDelActo: s.confirmed_at.slice(0, 10),
    });
    if (r && !r.coherente) {
      ramaIncoherente = {
        versionQueSeUso: s.declaracion_version ?? r.versionQueSeUso,
        versionQueCorresponde: r.versionQueCorresponde,
      };
      break;
    }
  }

  return {
    fechaDeNacimiento: crudo.fechaDeNacimiento,
    firmadoEl: firmas.length > 0 ? firmas[firmas.length - 1] : null,
    tieneRepresentanteVigente,
    ramaIncoherente,
  };
}
