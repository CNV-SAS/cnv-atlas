import { describe, expect, it } from "vitest";

import { formatDateTime, formatDateTimeConSegundos } from "@/lib/format/date";

// La hora que ve un profesional va con hora y minutos, no con segundos (Santiago, smoke del Bloque 3,
// 2026-09-14): "3:23", no "3:23:57". Solo el registro tecnico de auditoria conserva los segundos.

describe("fecha y hora", () => {
  const entrega = "2026-09-14T20:23:57.320778Z"; // 3:23:57 p. m. en Bogota

  it("sin segundos, en hora de Colombia", () => {
    const s = formatDateTime(entrega);
    expect(s).toMatch(/14\/9\/2026/);
    expect(s).toMatch(/3:23\s/);
    expect(s).not.toContain("3:23:57");
  });

  it("CONTROL: el de auditoria si los conserva", () => {
    expect(formatDateTimeConSegundos(entrega)).toContain("3:23:57");
  });

  it("vacio y fecha invalida se comportan como antes", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("no-es-fecha")).toBe("no-es-fecha");
  });
});
