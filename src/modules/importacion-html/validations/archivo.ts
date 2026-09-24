import { z } from "zod";

// El archivo que descarga el exportador del HTML (scripts/exportador-html/exportador.js, formato v1). Es la
// frontera de confianza: llega por correo o WhatsApp, asi que se valida entero antes de leer nada.
//
// LA HISTORIA Y LAS CLAVES RELACIONADAS VIAJAN COMO TEXTO, tal como estaban en el navegador (el exportador
// no las lee, para ser fiel). Aqui solo se valida la envoltura; su contenido lo interpreta la revision.

export const TAMANO_MAXIMO_ARCHIVO = 25 * 1024 * 1024; // 25 MB: cientos de pacientes con su historia

// ═══ LO QUE TUMBA EL ARCHIVO Y LO QUE NO (Santiago, 2026-09-24) ═══
//
// EL PRIMER ARCHIVO REAL TRAIA 160 PACIENTES Y UNO SIN DOCUMENTO. El esquema exigia documento a TODOS, asi
// que ese uno dejaba fuera a los otros 159. Y va a volver a pasar: en el HTML el documento se teclea a mano
// y nunca fue obligatorio.
//
// LA REGLA QUE SALE DE AHI: lo que esta MAL EN UN PACIENTE excluye A ESE PACIENTE, no al archivo. Solo tumba
// el archivo lo que hace que el archivo entero no sea lo que dice ser:
//
//   · `formato` y `version`: si no son los nuestros, no hay nada que leer;
//   · `pacientes` ausente o vacio: no hay nada que importar (y tiene su propio mensaje);
//   · y el tamaño, que es una defensa de la frontera.
//
// Todo lo demas es PERMISIVO aqui y lo juzga la REVISION, que puede decir "este paciente no, y por que"
// mientras deja pasar a los demas. Tambien se solto `declaracion.texto`, que exigia EXACTAMENTE tres lineas:
// el dia que la declaracion cambie de forma, no puede morir el import de todos.
export const archivoDeExportacionSchema = z.object({
  formato: z.literal("atlas-exportacion-html"),
  version: z.literal(1),
  exportadoEn: z.string().max(40),
  profesional: z.string().max(10_000).nullable(),
  declaracion: z.object({
    version: z.string().min(1).max(20),
    texto: z.array(z.string().max(500)).min(1).max(10),
    aceptadaEn: z.string().max(40),
  }),
  pacientes: z
    .array(
      z.object({
        // Permisivos A PROPOSITO: un paciente sin documento se EXCLUYE en la revision, con su razon, en vez
        // de tumbar el archivo. Ver `revisarLote`.
        documento: z.string().max(60),
        clave: z.string().max(80),
        historia: z.string().max(5_000_000).nullable(),
        relacionadas: z.record(z.string().max(200), z.string().max(2_000_000)),
      }),
    )
    .min(1)
    .max(5_000),
  hashPacientes: z.string().length(64).nullable().optional(),
});

export type ArchivoDeExportacion = z.infer<typeof archivoDeExportacionSchema>;

// ═══ POR QUE NO PASO, EN VEZ DE "NO TIENE EL FORMATO" (Santiago, 2026-09-24) ═══
//
// El primer archivo REAL de una profesional fue rechazado con "El archivo no tiene el formato del exportador
// (version 1). Pidele al profesional que lo exporte otra vez", y ese mensaje hace dos cosas malas: le echa la
// culpa al formato sin saberlo (el archivo puede ser del exportador y fallar por otra cosa) y manda a repetir
// un trabajo que quiza ya estaba bien hecho.
//
// Zod YA SABE que campo fallo. Lo que faltaba era decirlo. Se dice el CAMINO del campo y la razon, NUNCA el
// valor: el camino es el nombre de una clave y un indice, el valor seria PII de un paciente.
export function porQueNoPasa(crudo: unknown, issues: { path: PropertyKey[]; code: string }[]): string {
  const objeto = crudo && typeof crudo === "object" ? (crudo as Record<string, unknown>) : {};
  const camino = (p: PropertyKey[]) => p.map((x) => (typeof x === "number" ? `[${x + 1}]` : x)).join(".");

  // 1. NO ES DEL EXPORTADOR. La marca es lo primero que escribe, asi que si falta, el archivo es otra cosa
  //    (un export del navegador, un respaldo, otro sistema).
  if (objeto.formato !== "atlas-exportacion-html") {
    return objeto.formato === undefined
      ? "Este archivo no lo hizo el exportador de CNV: no trae su marca. Si el profesional guardó otra cosa (un respaldo del navegador, por ejemplo), hay que exportar de nuevo con la copia de CNV."
      : `Este archivo dice ser de otro formato ("${String(objeto.formato).slice(0, 40)}"), no del exportador de CNV.`;
  }

  // 2. ES DEL EXPORTADOR PERO DE OTRA VERSION. Aqui repetir el export NO sirve: hace falta la copia al dia.
  if (objeto.version !== 1) {
    return `Este archivo es del exportador de CNV pero de la versión ${String(objeto.version)}, y Atlas lee la 1. El profesional tiene una copia vieja del exportador: hay que mandarle la actual.`;
  }

  // 3. SALIO VACIO. Es el caso del navegador equivocado: el exportador corrio, pero ese navegador no tenia
  //    los pacientes. Repetir el export EN EL MISMO navegador daria lo mismo; hay que usar el otro.
  const pacientes = Array.isArray(objeto.pacientes) ? objeto.pacientes.length : null;
  if (pacientes === 0) {
    return "Este archivo es del exportador de CNV, pero salió SIN PACIENTES. Suele ser que se exportó desde un navegador (o un perfil) distinto del que se usó para atender: lo guardado vive en el navegador, no en el archivo. Hay que repetir la exportación en el navegador donde están los pacientes.";
  }

  // 4. LE FALTA ALGO CONCRETO. Se nombra el campo, sin su valor.
  const campos = [...new Set(issues.map((i) => camino(i.path)).filter(Boolean))].slice(0, 5);
  const cuantos = pacientes == null ? "" : ` El archivo trae ${pacientes} paciente(s).`;
  return campos.length > 0
    ? `Este archivo es del exportador de CNV, pero le falta o viene mal: ${campos.join(", ")}.${cuantos} Mándame ESTO (no el archivo) y lo miro.`
    : `Este archivo es del exportador de CNV pero no pasó la validación, y no se pudo precisar dónde.${cuantos} Mándame esta frase y lo miro.`;
}
