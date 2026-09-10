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
