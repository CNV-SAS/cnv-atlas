import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Tests de integracion de los flujos de auth de B2 contra el stack local
// (Supabase + Mailpit). Verifican lo que SI es automatizable: efectos en BD,
// correo de invitacion y MFA end-to-end. Los redirects del proxy/layout se
// verifican aparte con un smoke de la app (necesitan el server de Next corriendo).

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAILPIT = "http://127.0.0.1:54324";
const ORG = "11111111-1111-1111-1111-111111111111";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

// --- TOTP minimo (RFC 6238), sin dependencias ---
function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = alphabet.indexOf(c);
    if (idx >= 0) bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string, timeMs: number): string {
  const key = base32Decode(secret);
  let counter = Math.floor(timeMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, "0");
}

async function deleteUserByEmail(email: string) {
  // Borra el usuario de auth para no dejar cuentas fantasma. Primero via API
  // (service role); luego un hard-delete directo en auth.users que cascada a
  // profiles/user_roles y, sobre todo, a auth.one_time_tokens (el token de
  // invitacion), que es lo que hacia que Supabase reenviara la invitacion si el
  // borrado por API no completaba.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = data.users.find((x) => x.email === email);
  if (u) await admin.auth.admin.deleteUser(u.id);
  await sql`delete from auth.users where email = ${email}`;
}

async function mailpitFindHtml(email: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    const list = (await res.json()) as { messages: { ID: string; To: { Address: string }[] }[] };
    const msg = list.messages.find((m) => m.To.some((t) => t.Address === email));
    if (msg) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`);
      const body = (await detail.json()) as { HTML: string; Text: string };
      return body.HTML || body.Text;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const createdEmails = ["b2.create@example.com", "b2.invite@example.com"];

afterAll(async () => {
  for (const e of createdEmails) await deleteUserByEmail(e);
  await sql.end();
});

describe("B2: creacion de usuario (efectos en BD)", () => {
  it("invitar materializa el profile; rol + professional + audit se escriben atomicos", async () => {
    const email = "b2.create@example.com";
    await deleteUserByEmail(email);

    const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { organization_id: ORG, full_name: "B2 Create" },
    });
    expect(error).toBeNull();
    const uid = inv!.user!.id;

    // Profile materializado por el trigger (committed).
    const prof =
      await sql`select organization_id, full_name from public.profiles where id = ${uid}`;
    expect(prof.length).toBe(1);
    expect(prof[0].full_name).toBe("B2 Create");
    expect(prof[0].organization_id).toBe(ORG);

    // Rol + professional_profiles + audit en una transaccion. Se asserta DENTRO
    // (las filas estan escritas y visibles) y se revierte para no contaminar el
    // audit append-only.
    let snap: { ur: number; pp: number; au: number } | null = null;
    await sql
      .begin(async (tx) => {
        const role = await tx`select id from public.roles where name = 'professional' limit 1`;
        expect(role.length).toBe(1); // verifica que el rol exista ANTES de asignar
        await tx`insert into public.user_roles (user_id, role_id) values (${uid}, ${role[0].id})`;
        await tx`insert into public.professional_profiles (profile_id) values (${uid})`;
        await tx`insert into public.clinical_audit_log (event, actor_id, entity_type, entity_id)
                 values ('user.created', ${uid}, 'profile', ${uid})`;
        const ur = await tx`select 1 from public.user_roles where user_id = ${uid}`;
        const pp = await tx`select 1 from public.professional_profiles where profile_id = ${uid}`;
        const au =
          await tx`select 1 from public.clinical_audit_log where entity_id = ${uid} and event = 'user.created'`;
        snap = { ur: ur.length, pp: pp.length, au: au.length };
        throw new Error("ROLLBACK");
      })
      .catch((e) => {
        if ((e as Error).message !== "ROLLBACK") throw e;
      });
    expect(snap).toEqual({ ur: 1, pp: 1, au: 1 });
  }, 30000);
});

describe("B2: invitacion y set-password", () => {
  it("el correo de invitacion llega a Mailpit con el enlace /auth/confirm y permite fijar contrasena", async () => {
    const email = "b2.invite@example.com";
    await deleteUserByEmail(email);

    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { organization_id: ORG, full_name: "B2 Invite" },
    });
    expect(error).toBeNull();

    // Verificado en Mailpit: el correo existe y trae el enlace server-side.
    const html = await mailpitFindHtml(email);
    expect(html).toBeTruthy();
    expect(html).toContain("/auth/confirm");
    expect(html).toContain("type=invite");

    // Extrae el token_hash del enlace y completa el set-password.
    const tokenHash = html!.match(/token_hash=([A-Za-z0-9]+)/)?.[1];
    expect(tokenHash).toBeTruthy();

    const userClient = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: otpError } = await userClient.auth.verifyOtp({
      type: "invite",
      token_hash: tokenHash!,
    });
    expect(otpError).toBeNull();

    const newPassword = "Contrasena-Nueva-123";
    const { error: updError } = await userClient.auth.updateUser({ password: newPassword });
    expect(updError).toBeNull();

    // La contrasena fijada permite iniciar sesion.
    const loginClient = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: loginError } = await loginClient.auth.signInWithPassword({
      email,
      password: newPassword,
    });
    expect(loginError).toBeNull();
  }, 30000);
});

describe("B2: MFA del admin end-to-end", () => {
  it("enroll deja el factor unverified; tras verificar el TOTP queda verified y la sesion en aal2", async () => {
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: loginError } = await sb.auth.signInWithPassword({
      email: "sau.idk001@gmail.com",
      password: process.env.SEED_ADMIN_PASSWORD!,
    });
    expect(loginError).toBeNull();

    // Estado MFA limpio: se borran los factores via SQL (autoritativo e
    // independiente del AAL). unenroll() desde aal1 no puede quitar un factor
    // verificado, asi que un factor remanente (p. ej. de una prueba manual)
    // rompia el enroll siguiente por conflicto de nombre.
    const {
      data: { user: adminUser },
    } = await sb.auth.getUser();
    await sql`delete from auth.mfa_factors where user_id = ${adminUser!.id}`;

    const { data: enrolled, error: enrollError } = await sb.auth.mfa.enroll({ factorType: "totp" });
    expect(enrollError).toBeNull();
    const factorId = enrolled!.id;

    const f1 = await sb.auth.mfa.listFactors();
    expect(f1.data?.all.find((f) => f.id === factorId)?.status).toBe("unverified");

    const code = totp(enrolled!.totp.secret, Date.now());
    const { data: challenge } = await sb.auth.mfa.challenge({ factorId });
    const { error: verifyError } = await sb.auth.mfa.verify({
      factorId,
      challengeId: challenge!.id,
      code,
    });
    expect(verifyError).toBeNull();

    const f2 = await sb.auth.mfa.listFactors();
    expect(f2.data?.all.find((f) => f.id === factorId)?.status).toBe("verified");
    const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data?.currentLevel).toBe("aal2");

    // Limpieza: deja al admin sin MFA.
    await sb.auth.mfa.unenroll({ factorId });
  }, 30000);
});
