import { z } from "zod";

// El archivo que descarga el exportador del HTML (scripts/exportador-html/exportador.js, formato v1). Es la
// frontera de confianza: llega por correo o WhatsApp, asi que se valida entero antes de leer nada.
//
// LA HISTORIA Y LAS CLAVES RELACIONADAS VIAJAN COMO TEXTO, tal como estaban en el navegador (el exportador
// no las lee, para ser fiel). Aqui solo se valida la envoltura; su contenido lo interpreta la revision.

export const TAMANO_MAXIMO_ARCHIVO = 25 * 1024 * 1024; // 25 MB: cientos de pacientes con su historia

export const archivoDeExportacionSchema = z.object({
  formato: z.literal("atlas-exportacion-html"),
  version: z.literal(1),
  exportadoEn: z.string().min(10).max(40),
  profesional: z.string().max(10_000).nullable(),
  declaracion: z.object({
    version: z.string().min(1).max(20),
    texto: z.array(z.string().max(500)).length(3),
    aceptadaEn: z.string().min(10).max(40),
  }),
  pacientes: z
    .array(
      z.object({
        documento: z.string().min(1).max(60),
        clave: z.string().min(1).max(80),
        historia: z.string().max(5_000_000).nullable(),
        relacionadas: z.record(z.string().max(200), z.string().max(2_000_000)),
      }),
    )
    .min(1)
    .max(5_000),
  hashPacientes: z.string().length(64).nullable().optional(),
});

export type ArchivoDeExportacion = z.infer<typeof archivoDeExportacionSchema>;
