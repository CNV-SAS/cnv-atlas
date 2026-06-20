import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// TTL del link de checkout: 24h (SECURITY.md, superficies publicas).
const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CheckoutView = {
  id: string;
  amount: string;
  currency: string;
};

// Lectura de la transaccion para la pagina publica /checkout/[token], que no tiene
// sesion. Usa service role (BYPASSA RLS) a proposito: el token es el id opaco (uuid
// v4) de la transaccion. Solo devuelve los campos minimos para armar el redirect a
// Wompi y solo si la transaccion sigue 'pending' y dentro de las 24h. Es un caso
// legitimo de superficie publica (SECURITY.md); el monto va firmado a Wompi de
// todos modos, asi que el unico dato que se filtra es si el link sirve o no.
export async function getCheckoutByToken(token: string): Promise<CheckoutView | null> {
  if (!UUID_RE.test(token)) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, currency, status, created_at")
    .eq("id", token)
    .maybeSingle();
  if (error) throw new Error(`checkout-reader: getCheckoutByToken: ${error.message}`);
  if (!data || data.status !== "pending") return null;
  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > CHECKOUT_TTL_MS) return null; // vencido (>24h)
  return { id: data.id, amount: data.amount, currency: data.currency };
}
