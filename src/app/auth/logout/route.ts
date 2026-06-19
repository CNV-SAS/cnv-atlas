import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Logout via route handler: a diferencia de un Server Component, aqui SI se pueden
// escribir cookies, asi que signOut() revoca la sesion y limpia las cookies de
// auth. Lo usa requireUser para desloguear de inmediato a un usuario inactivo.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
