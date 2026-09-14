import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  crearFetchConTimeout,
  fetchConTimeout,
  SUPABASE_STORAGE_TIMEOUT_MS,
  SUPABASE_TIMEOUT_MS,
} from "@/lib/supabase/fetch-con-timeout";

// ═══ LOS CLIENTES DE SUPABASE TIENEN TIMEOUT (regla dura 10) ═══
//
// Se creaban sin `global.fetch` y cada llamada esperaba sin limite. Lo destapo el link de pago del paciente
// (502 intermitentes de la API de Supabase, 2026-09-14): con una respuesta lenta en vez de un error, la
// pantalla del paciente habria quedado colgada.

describe("fetchConTimeout", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  // Un fetch que no responde nunca y solo termina si lo abortan: la forma del proveedor colgado.
  const colgado = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
  // Plazos cortos y relojes REALES: `AbortSignal.timeout` no obedece a los relojes simulados.
  const corto = crearFetchConTimeout({ consultasMs: 60, storageMs: 400 });
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("los plazos de verdad: 10 s para consultas, 60 s para Storage", () => {
    expect(SUPABASE_TIMEOUT_MS).toBe(10_000);
    expect(SUPABASE_STORAGE_TIMEOUT_MS).toBe(60_000);
  });

  it("aborta una consulta que no responde, en su plazo", async () => {
    globalThis.fetch = colgado as typeof fetch;
    await expect(corto("https://x.supabase.co/rest/v1/transactions?id=eq.1")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("CONTROL: antes del plazo no aborta", async () => {
    globalThis.fetch = colgado as typeof fetch;
    let termino = false;
    corto("https://x.supabase.co/rest/v1/t").catch(() => (termino = true));
    await esperar(20);
    expect(termino).toBe(false);
    await esperar(120);
    expect(termino).toBe(true);
  });

  it("Storage tiene un plazo mas largo: una subida no se corta con el de las consultas", async () => {
    globalThis.fetch = colgado as typeof fetch;
    let termino = false;
    corto("https://x.supabase.co/storage/v1/object/reports/a.pdf").catch(() => (termino = true));
    await esperar(150);
    expect(termino, "la subida se cortó con el plazo de las consultas").toBe(false);
    await esperar(400);
    expect(termino).toBe(true);
  });

  it("respeta la senal propia de la llamada: una cancelacion pedida aborta antes del plazo", async () => {
    globalThis.fetch = colgado as typeof fetch;
    const propia = new AbortController();
    const promesa = fetchConTimeout("https://x.supabase.co/rest/v1/t", { signal: propia.signal });
    propia.abort(new Error("cancelada por quien llamo"));
    await expect(promesa).rejects.toThrow(/cancelada por quien llamo/);
  });

  it("un corte en la SESION no lanza: getUser devuelve error, que es lo que el proxy sabe manejar", async () => {
    // El proxy corre en cada navegacion. Si un corte lanzara aqui, toda la aplicacion fallaria mientras la
    // API de Supabase este lenta; devolviendo error, una ruta protegida manda a /login.
    const cliente = createClient("https://x.supabase.co", "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: () => Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
      },
    });
    const r = await cliente.auth.getUser("token-cualquiera");
    expect(r.data.user).toBeNull();
    expect(r.error).toBeTruthy();
  });
});

describe("los cuatro clientes usan el fetch con timeout (el defecto era una OMISION en cada uno)", () => {
  it.each(["src/lib/supabase/admin.ts", "src/lib/supabase/server.ts", "src/lib/supabase/client.ts", "src/proxy.ts"])(
    "%s",
    (archivo) => {
      expect(readFileSync(archivo, "utf8")).toContain("global: { fetch: fetchConTimeout }");
    },
  );

  it("y no queda otro cliente de Supabase creado a mano en la aplicacion", () => {
    // Si alguien crea un quinto cliente, este test lo nombra para que se le ponga el timeout.
    const permitidos = new Set(["src/lib/supabase/admin.ts", "src/lib/supabase/server.ts", "src/lib/supabase/client.ts", "src/proxy.ts"]);
    const archivos = execSync('git grep -l -E "createServerClient\\(|createBrowserClient\\(|createClient\\(" -- src ":!src/tests"', {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    expect(archivos.filter((a) => !permitidos.has(a))).toEqual([]);
  });
});
