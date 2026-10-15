import { computeAgeYears, isMinorAge } from "@/modules/consent/validations";

// Segundo muro (DELTA2 B3): al confirmar identidad, la rama de consentimiento usada
// debe ser consistente con la edad real del paciente segun su fecha de nacimiento.
//
// Rama usada:
//   - menor: existe un consentimiento 'representante_legal' vigente.
//   - mayor: no existe ese consentimiento.
//
// Es funcion pura (recibe 'now') para poder probarla sin depender del reloj ni de BD.

export type ConsentBranchCheck = { ok: true } | { ok: false; message: string };

export function checkConsentBranchConsistency(input: {
  birthDate: string | null;
  usedMinorBranch: boolean;
  now: Date;
}): ConsentBranchCheck {
  const age = input.birthDate ? computeAgeYears(input.birthDate, input.now) : null;

  if (input.usedMinorBranch) {
    // Se otorgo por representante legal: la fecha debe existir e indicar minoria.
    if (age === null) {
      return {
        ok: false,
        message:
          "Falta la fecha de nacimiento del menor para confirmar la consistencia del consentimiento otorgado por el representante legal.",
      };
    }
    if (!isMinorAge(age)) {
      return {
        ok: false,
        message:
          "El documento indica mayoria de edad, pero el consentimiento se otorgo por un representante legal. Repite el consentimiento como mayor de edad antes de confirmar.",
      };
    }
    return { ok: true };
  }

  // ═══ RAMA MAYOR SOBRE UN MENOR: YA NO BLOQUEA AQUI (Santiago, 2026-10-15) ═══
  //
  // ── QUE PASABA, Y ES EL CASO QUE LO OBLIGA ─────────────────────────────────────────────────────
  //
  // Este muro frenaba la CONFIRMACION DE IDENTIDAD de seis pacientes reales que consintieron por el QR
  // cuando ese camino no tenia rama de menor. La evaluacion se quedaba en `draft` y su profesional no podia
  // hacer NADA con ellos. Textual de Santiago: *"hoy reviso dichos pacientes y siguen bloqueados, entonces
  // la profesional no ha podido hacer nada con ellos. Se supone que si ya pasaron se dejan, pero repiten el
  // consentimiento en su proxima consulta."*
  //
  // ── POR QUE NO ES DEBILITAR EL MURO ────────────────────────────────────────────────────────────
  //
  // Porque el bloqueo NO TENIA SALIDA. El mensaje decia *"repite el consentimiento con el representante
  // legal antes de confirmar"*, y para un paciente QUE YA EXISTE ese camino no esta construido: el pase
  // presencial con rama de menor (0216) solo CREA pacientes nuevos, y el camino remoto necesita un correo
  // que estos pacientes no tienen, que es justo por lo que entraron por el QR. Un guard correcto que manda
  // a hacer algo que no se puede hacer no protege a nadie: detiene la atencion de un menor real.
  //
  // Y COINCIDE CON EL DICTAMEN, que nunca pidio frenar la atencion: *"el profesional trabaja normalmente con
  // ese paciente. La historia es suya y la atencion sigue. En la proxima evaluacion, el gate pide el
  // consentimiento con la rama de menor."*
  //
  // ── DONDE VIVE AHORA, porque no se pierde ──────────────────────────────────────────────────────
  //
  // En el estado derivado `menor_sin_representante` de `modules/consent/regularizacion`, que lo MARCA en la
  // ficha del paciente y en la lista, con lo que hay que hacer. O sea que el hecho sigue visible y deja de
  // ser un bloqueo sin salida. **El dia que exista el camino de regularizacion, el freno vuelve ahi** (en el
  // gate, con su bandera), no aqui: este muro compara una rama contra una fecha, y esa es otra pregunta.
  //
  // LAS OTRAS DOS RAMAS DE ARRIBA SIGUEN BLOQUEANDO, y no es incoherencia: un representante que firmo por un
  // ADULTO afirma una autoridad que no existe, y se arregla en el acto repitiendo el consentimiento como
  // mayor, que SI es un camino que existe.
  return { ok: true };
}
