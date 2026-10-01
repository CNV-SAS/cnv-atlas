import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  brutoReconocido,
  COLUMNA_EFECTIVO_NO_RECIBIDO,
  ESTADO_DEVUELTA,
  ESTADO_DISPUTA_PERDIDA,
  FILTRO_FUERA_DE_REVISION,
} from "@/modules/payments/cobro-reconocido";

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
  vendido: { total: number; ventas: number };
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

  const { data: revenue, error: eR } = await supabase
    .from("professional_revenue")
    .select("commission_amount, settlement_id")
    .eq("professional_id", professionalId);
  if (eR) throw new Error(`perfil-reader: revenue: ${eR.message}`);

  // ── LO QUE HA VENDIDO, BAJO SU PROPIA RLS ──
  //
  // TRES CONSULTAS Y LA CUENTA LA HACE EL MODULO NEUTRO, igual que en Inicio, en Direccion y en la pantalla
  // de admin: el alcance cambia (el suyo, toda su historia), la aritmetica no. Escribir aqui una suma propia
  // es como se llega a que dos pantallas digan cifras distintas del mismo hecho, y ya nos paso dos veces.
  const [{ data: pagadas }, { data: perdidas }, { data: devueltas }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount")
      .eq("professional_id", professionalId)
      .eq("status", "paid")
      .or(FILTRO_FUERA_DE_REVISION)
      .is(COLUMNA_EFECTIVO_NO_RECIBIDO, null),
    supabase
      .from("sale_reversals")
      .select("transaction_id, transactions!inner(professional_id)")
      .eq("state", ESTADO_DISPUTA_PERDIDA)
      .eq("transactions.professional_id", professionalId),
    supabase
      .from("sale_reversals")
      .select("debited_amount, transactions!inner(professional_id)")
      .eq("state", ESTADO_DEVUELTA)
      .eq("transactions.professional_id", professionalId),
  ]);

  let causado = 0;
  let liquidado = 0;
  for (const r of revenue ?? []) {
    const monto = Number(r.commission_amount);
    causado += monto;
    if (r.settlement_id != null) liquidado += monto;
  }

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
    margen: { causado, liquidado, pendiente: causado - liquidado },
    vendido: {
      total: brutoReconocido({
        pagadas: pagadas ?? [],
        disputasPerdidas: (perdidas ?? []).map((r) => r.transaction_id),
        devoluciones: (devueltas ?? []).map((r) => r.debited_amount),
      }),
      ventas: (pagadas ?? []).length,
    },
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
