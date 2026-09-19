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
