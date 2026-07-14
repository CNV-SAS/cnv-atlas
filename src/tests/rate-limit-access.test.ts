import { beforeAll, describe, expect, it } from "vitest";

import { limitAccessRequestByUser } from "@/core/rate-limit";

// Verifica el limiter de solicitudes de acceso a las notas (B15). Sin Upstash configurado
// cae a la ventana fija en memoria (20/h por usuario); se fuerza esa via borrando las env
// de Upstash para que el test sea determinista y sin red.

beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("limitAccessRequestByUser", () => {
  it("permite hasta 20 solicitudes por usuario y bloquea la siguiente", async () => {
    const user = "rl-access-user-a";
    for (let i = 0; i < 20; i++) {
      const r = await limitAccessRequestByUser(user);
      expect(r.success).toBe(true);
    }
    const blocked = await limitAccessRequestByUser(user);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("cuenta por usuario, no de forma global", async () => {
    // Otro usuario no se ve afectado por el que ya se bloqueo arriba.
    const r = await limitAccessRequestByUser("rl-access-user-b");
    expect(r.success).toBe(true);
  });
});
