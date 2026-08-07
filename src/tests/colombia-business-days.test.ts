import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  businessDaysUntil,
  isBusinessDay,
  isColombianHoliday,
} from "@/core/dates/colombia-business-days";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// El plazo del faltante (5 dias habiles) tiene consecuencia economica: vencer en un festivo seria injusto.
// Este test ancla el calendario colombiano (fijos + Ley Emiliani + Semana Santa) y el conteo de dias habiles.
describe("dias habiles en Colombia", () => {
  it("festivo fijo: 7 de agosto (Batalla de Boyaca) no es habil", () => {
    expect(isColombianHoliday(new Date(2026, 7, 7))).toBe(true);
    expect(isBusinessDay(new Date(2026, 7, 7))).toBe(false);
  });

  it("Ley Emiliani: Reyes (6 ene 2026, martes) se corre al lunes 12 ene", () => {
    expect(isColombianHoliday(new Date(2026, 0, 6))).toBe(false); // el 6 NO
    expect(isColombianHoliday(new Date(2026, 0, 12))).toBe(true); // el lunes siguiente SI
  });

  it("Semana Santa: Viernes Santo 2026 (3 de abril) es festivo", () => {
    expect(isColombianHoliday(new Date(2026, 3, 3))).toBe(true);
  });

  it("fin de semana no es habil; un miercoles normal si", () => {
    expect(isBusinessDay(new Date(2026, 7, 8))).toBe(false); // sabado
    expect(isBusinessDay(new Date(2026, 7, 9))).toBe(false); // domingo
    expect(isBusinessDay(new Date(2026, 7, 12))).toBe(true); // miercoles normal
  });

  it("addBusinessDays salta fin de semana Y festivo (jueves 6 ago + 5 -> viernes 14 ago)", () => {
    // 6 ago jue; 7 ago festivo; 8-9 finde; 10 lun=1, 11=2, 12=3, 13=4, 14 vie=5.
    expect(ymd(addBusinessDays(new Date(2026, 7, 6), 5))).toBe("2026-08-14");
  });

  it("businessDaysUntil cuenta los habiles que quedan (0 si ya paso)", () => {
    const from = new Date(2026, 7, 6, 12, 0, 0); // jue 6 ago mediodia
    const to = addBusinessDays(from, 5); // vie 14 ago
    expect(businessDaysUntil(from, to)).toBe(5);
    expect(businessDaysUntil(to, from)).toBe(0); // ya paso
  });
});
