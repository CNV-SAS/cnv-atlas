import { describe, expect, it } from "vitest";

import { analizarDFI } from "@/clinical-engine/analysis";
import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { MEASURED_WAIST_HEADER } from "@/clinical-engine/edge/biody-columns";
import { buildBisRow } from "@/modules/clinical-pipeline/services/build-engine-input";
import { normalizeHeader } from "@/modules/bis/services/header-map";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import encuesta from "./fixtures/clinical-engine/encuesta-sintetica.json";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ULTIMO CABLE DE LA ADIPOSIDAD CENTRAL  ·  v17 §2.3  ·  2026-11-12
//
// ═══ POR QUE ESTE CANDADO EXISTE, Y ES LA FORMA DE DEFECTO QUE MAS VECES NOS HA PASADO ═══
//
// El modificador de adiposidad central del dominio metabolico-estructural (+1 si la cintura pasa el corte
// de la OMS o si el ICT llega a 0,50) se construye en el motor congelado, tiene sus casos de prueba y los
// pasa. Pero su insumo NO viaja por el camino normal: `buildBisRow` reconstruye la fila que el motor lee
// recorriendo `BIODY_COLUMNS`, y la CINTURA MEDIDA esta FUERA de ese mapa a proposito (el mapeo de
// Gildardo apunta al umbral de la OMS, 102 para todo paciente, y hay un candado que exige que no vuelva).
//
// O sea que sin una linea explicita el modificador queda construido y sin insumo: existiendo, verde en
// sus pruebas, y sin encenderse NUNCA con un paciente real. Es "la pieza terminada a la que le falta el
// ultimo cable", y la unica manera de atraparlo es probar la CADENA, no la pieza.
//
// Los casos de abajo prueban los dos tramos del cable y el extremo:
//   1. que `buildBisRow` ponga la cintura en la fila (el tramo que nadie mas mira);
//   2. que el mapa del motor siga SIN `cintura` (si alguien la "arregla" metiendola ahi, vuelve el 102);
//   3. que con un export REAL el modificador se encienda de verdad.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("la cintura medida llega del export al dominio 2", () => {
  it("`buildBisRow` la pone en la fila del motor, con su header exacto", () => {
    const fila = buildBisRow({ [normalizeHeader(MEASURED_WAIST_HEADER)]: 98 });
    expect(fila[MEASURED_WAIST_HEADER]).toBe(98);
  });

  it("y si no viene, no la inventa (no hay cero que parezca medido)", () => {
    // Un 0 de cintura entraria en su formula como "no hay dato" igual que la ausencia, pero dejarlo
    // escrito en la fila hace creer que se midio. Asi que no se escribe.
    expect(MEASURED_WAIST_HEADER in buildBisRow({})).toBe(false);
  });

  it("el mapa del motor sigue SIN `cintura`: ahi vive el umbral, no la medida", () => {
    // Este caso ya existe en `composition-map.test.ts` y se repite aqui a proposito: es la razon por la
    // que la cintura necesita un cable propio, y quien lea este archivo tiene que verla.
    expect(BIODY_COLUMNS.cintura).toBeUndefined();
  });

  it("con el export real de un paciente, el modificador SE ENCIENDE (no es un camino muerto)", () => {
    // El donante del golden trae cintura de 98 cm (hombre, corte de la OMS 94) e ICT de 0,544 (corte
    // 0,50): las dos vias del modificador. Si este caso se pone rojo, el cable se corto en algun tramo.
    const out = analizarDFI(biody as Record<string, unknown>, {
      ...(encuesta as Record<string, unknown>),
      sexo: "M",
      edad: 54,
    });
    const d2 = out.domains.find((d) => d.id === "d2")!;
    expect(d2.clasif, "el dominio 2 no vio la adiposidad central").toContain("adiposidad central");
    expect(d2.items.some((i) => i.includes("cintura de 98 cm"))).toBe(true);
    // Y su sector es S2 (gravedad 0), asi que el 1 de severidad viene ENTERO del modificador: es la
    // comprobacion de que el cable cambia el resultado, no solo el texto.
    expect(d2.sev).toBe(1);
  });
});
