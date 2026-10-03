import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { historicoDelProfesional, type HistoricoDelProfesional } from "@/modules/payments/data/historico-del-profesional";

import { completitudDelPerfil, type Completitud } from "../completitud";

// ═══ LO QUE LA CABECERA Y LOS TRES INDICADORES DEL PERFIL NECESITAN (2026-09-25) ═══
//
// BAJO RLS: el integrante lee lo suyo. No hace falta service role en ningun punto de esta pantalla, porque
// todo lo que muestra es de el.
//
// EL MARGEN SE LEE CON SU LIQUIDACION, no como una suma sola. Hasta hoy el perfil sumaba TODAS las filas de
// `professional_revenue` y lo llamaba "comision pendiente"; eso era cierto antes de que existieran las
// liquidaciones (0171) y dejo de serlo: una comision ya liquidada seguia contando como pendiente. Aqui se
// parte en causado / liquidado / pendiente, que es lo mismo que muestra /comercial, para que las dos
// pantallas no puedan decir cifras distintas.

export type PerfilDelIntegrante = {
  nombre: string;
  correo: string;
  estado: string;
  profesion: string;
  registroProfesional: string | null;
  documento: { tipo: string | null; numero: string | null; dv: string | null };
  /** Lo que el integrante SI edita (0177). */
  contacto: { phone: string | null; officeAddress: string | null; officeCity: string | null };
  /** Firmas de documentos del integrante (hoy solo el Anexo 3 existe como tipo). */
  documentosFirmados: { tipo: string; version: string; firmadoEn: string }[];
  margen: { causado: number; liquidado: number; pendiente: number };
  /**
   * LO QUE HA VENDIDO EN TODA SU HISTORIA (Santiago, 2026-10-01).
   *
   * La pantalla decia el margen y nada mas, asi que "cuanto he vendido" era una pregunta sin respuesta. Va
   * al lado del margen porque son la misma historia: lo que vendio y lo que le queda de eso.
   *
   * NO LLEVA EL CORTE DEL ARRANQUE: es un total historico, de la familia de lo que se le debe.
   */
  // La forma la fija el lector compartido (): repetirla aqui es como se llega a que
  // una pantalla muestre un campo que la otra no.
  vendido: HistoricoDelProfesional["vendido"];
  completitud: Completitud;
};

export async function getPerfilDelIntegrante(
  professionalId: string,
  userId: string,
): Promise<PerfilDelIntegrante | null> {
  const supabase = await createSupabaseServerClient();

  const { data: perfil, error: eP } = await supabase
    .from("profiles")
    .select("full_name, email, status")
    .eq("id", userId)
    .maybeSingle();
  if (eP) throw new Error(`perfil-reader: profiles: ${eP.message}`);
  if (!perfil) return null;

  const { data: prof, error: ePP } = await supabase
    .from("professional_profiles")
    .select(
      "profession, license, phone, office_address, office_city, tax_person_type, tax_has_rut, tax_id_type, tax_id_number, tax_id_dv, rut_path, rut_verified_at, bank_name, bank_account_number, bank_account_holder_document",
    )
    .eq("id", professionalId)
    .maybeSingle();
  if (ePP) throw new Error(`perfil-reader: professional_profiles: ${ePP.message}`);
  if (!prof) return null;

  const { data: firmas, error: eF } = await supabase
    .from("professional_document_signatures")
    .select("document_type, signed_version, signed_at")
    .eq("professional_id", professionalId)
    .order("signed_at", { ascending: false });
  if (eF) throw new Error(`perfil-reader: firmas: ${eF.message}`);

  // ═══ EL HISTORICO SALE DEL LECTOR COMPARTIDO (Santiago, 2026-10-01) ═══
  //
  // Aqui vivian las consultas propias de su dinero, y daban 244.700 cuando la pantalla de admin daba
  // 154.700 de la MISMA persona. Las dos aplicaban el mismo filtro y el INSUMO era distinto: esta pedia la
  // lista de pacientes marcados BAJO SU RLS, y un paciente marcado que el no ve no entraba en la lista.
  //
  // Dos consultas que calculan lo mismo divergen. Ahora hay una.
  const historico = await historicoDelProfesional(professionalId);
  return {
    nombre: perfil.full_name,
    correo: perfil.email,
    estado: perfil.status,
    profesion: prof.profession,
    registroProfesional: prof.license,
    documento: { tipo: prof.tax_id_type, numero: prof.tax_id_number, dv: prof.tax_id_dv },
    contacto: { phone: prof.phone, officeAddress: prof.office_address, officeCity: prof.office_city },
    documentosFirmados: (firmas ?? []).map((f) => ({
      tipo: f.document_type,
      version: f.signed_version,
      firmadoEn: f.signed_at,
    })),
    margen: {
      causado: historico.comision.causada,
      liquidado: historico.comision.liquidada,
      pendiente: historico.comision.pendiente,
    },
    vendido: historico.vendido,
    completitud: completitudDelPerfil({
      personType: prof.tax_person_type,
      idNumber: prof.tax_id_number,
      rutUploaded: prof.rut_path != null,
      hasRut: prof.tax_has_rut,
      rutVerified: prof.rut_verified_at != null,
      bankName: prof.bank_name,
      bankAccountNumber: prof.bank_account_number,
      bankAccountHolderDocument: prof.bank_account_holder_document,
      license: prof.license,
    }),
  };
}
