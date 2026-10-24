import { z } from "zod";

// Validaciones del modulo de pacientes.

const DOCUMENT_TYPES = ["CC", "CE", "TI", "PA", "NIT"] as const;

// Documento a verificar antes de crear un paciente en consulta. MISMOS limites que el intake
// (`intakeIdentitySchema`) a proposito: si aqui se aceptara un documento que alla se rechaza, la pantalla
// diria "libre" y la creacion fallaria despues por validacion, que es la contradiccion que estamos
// evitando en toda esta pieza.
export const documentoSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: z.string().trim().min(3).max(30),
});

// ARCHIVAR / DESARCHIVAR. El destino viaja como booleano y no como "accion": asi la action no tiene que
// interpretar una cadena, y un valor raro cae en el mismo sitio que un id malo.
export const archivarPacienteSchema = z.object({
  patientId: z.guid(),
  archivar: z.boolean(),
});

// CORREGIR EL CONTACTO (2026-09-19). Los dos campos son OPCIONALES y el vacio se guarda como null a
// proposito: borrar un correo equivocado es una correccion legitima, y un correo mal escrito es peor que
// ninguno (el reporte se da por enviado y no llega a nadie).
//
// EL CORREO SE VALIDA COMO CORREO, que es justo el defecto que esto viene a arreglar: si se acepta
// cualquier texto, el envio falla despues, lejos, y con un mensaje que no habla de este formulario.
const vacioANull = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s.length === 0 ? null : s;
};

// COMPLETAR EL SEXO QUE FALTA. Exactamente F/M, como el intake (`intakeIdentitySchema`) y como lo exige
// el motor (`normalizeSex` falla en voz alta ante cualquier otra cosa). No se acepta texto libre: el
// desplegable produce F/M y ya hubo que canonizar perfiles viejos una vez.
export const sexoPacienteSchema = z.object({
  patientId: z.guid(),
  sex: z.enum(["F", "M"], { message: "Elige Femenino o Masculino." }),
});

// COMPLETAR LA FECHA DE NACIMIENTO QUE FALTA. `YYYY-MM-DD` exacto, que es lo que exige `computeAgeYears`
// (la lectura estricta del consentimiento, la misma que usa el pipeline clinico desde el 2026-10-24).
//
// LOS DOS CINTURONES SON DE LO IMPOSIBLE, NO DE LO IMPROBABLE (Regla 0): una fecha POSTERIOR A HOY no es
// una fecha de nacimiento de nadie, y una edad mayor de 130 anos tampoco. Son los dos casos que de verdad
// aparecieron (el ano de cinco digitos del tecleo y el 1795 del import). No se pone ningun corte por
// "paciente muy joven": eso si seria una cifra nuestra decidiendo sobre un paciente.
export const fechaDeNacimientoPacienteSchema = z.object({
  patientId: z.guid(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha tiene que ir como AAAA-MM-DD." })
    .refine(
      (v) => {
        const n = new Date(`${v}T00:00:00Z`);
        if (Number.isNaN(n.getTime())) return false;
        const hoy = new Date();
        if (n.getTime() > hoy.getTime()) return false;
        return hoy.getUTCFullYear() - n.getUTCFullYear() <= 130;
      },
      { message: "Esa fecha no corresponde a una persona viva. Revísala con el paciente." },
    ),
});

export const contactoPacienteSchema = z.object({
  patientId: z.guid(),
  email: z
    .string()
    .nullish()
    .transform(vacioANull)
    .refine((v) => v === null || z.string().email().max(160).safeParse(v).success, {
      message: "El correo no tiene un formato válido.",
    }),
  phone: z.string().nullish().transform(vacioANull).refine((v) => v === null || v.length <= 40, {
    message: "El teléfono es demasiado largo.",
  }),
});

// ═══ CORREGIR UN SEXO YA REGISTRADO (Santiago, 2026-10-10) ═══
//
// ES OTRO ACTO QUE COMPLETAR EL QUE FALTA, y por eso tiene su propio schema: aquel rellena un hueco y no
// puede equivocarse contra nada; este PISA un dato que ya alimento (o va a alimentar) clasificaciones.
//
// EL CASO QUE LO PIDE es suyo y es real: *"un paciente por ejemplo transexual puede pensar que es el
// genero, entonces el profesional debe poder cambiarlo."* El motor usa el sexo BIOLOGICO (sus
// clasificadores son sexo-especificos), asi que un genero registrado en ese campo no es un dato de
// identidad mal puesto: es un insumo clinico equivocado, y sin salida era un callejon.
//
// POR ESO EXIGE MOTIVO: no como tramite, sino porque el rastro clinico tiene que poder explicar por que el
// mismo paciente se clasifico de dos formas. Sin el, un diagnostico viejo y uno nuevo se contradicen y
// nadie sabe cual leer.
export const correccionDeSexoSchema = z.object({
  patientId: z.guid(),
  sex: z.enum(["F", "M"], { message: "Elige Femenino o Masculino." }),
  motivo: z
    .string()
    .trim()
    .min(10, { message: "Escribe por qué se corrige, con al menos 10 caracteres." })
    .max(300, { message: "El motivo es demasiado largo (máximo 300 caracteres)." }),
});

// REASIGNAR UN PACIENTE A OTRO PROFESIONAL. El motivo es obligatorio y con minimo: una reasignacion sin
// motivo es indistinguible de un error, y un espacio en blanco no explica nada dentro de un ano. Mismo
// criterio que la correccion del sexo y que la marca de prueba.
export const reasignacionDePacienteSchema = z.object({
  patientId: z.guid(),
  haciaProfesionalId: z.guid({ message: "Elige el profesional que lo va a atender." }),
  motivo: z
    .string()
    .trim()
    .min(5, { message: "Escribe por qué se reasigna (al menos 5 caracteres)." })
    .max(200),
});
