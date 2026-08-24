// Resuelve la recomendacion de nutraceuticos del modelo (string sellado del snapshot) contra el
// catalogo, con un MAPA DE ALIAS EXPLICITO (no una regla generica tipo "quitar guiones"). El motor de
// Gildardo emite el nombre de 3 productos con dos grafias segun la rama del arbol de decision (Q31); el
// catalogo usa la grafia del registro sanitario (INVIMA). Aqui se mapea grafia-del-motor -> grafia-del-
// catalogo. Explicito a proposito: un nombre nuevo del motor NO empareja por accidente; cae a
// "no_en_catalogo" y se ve (no falla en silencio). El candado (test) verifica que las grafias conocidas
// resuelvan; el estado "no_en_catalogo" cubre un producto que el modelo recomienda pero que aun no
// existe en el catalogo (p. ej. Gildardo agrega un nutraceutico antes de que exista el producto).

// Alias motor -> nombre canonico del catalogo. SOLO las grafias que DIFIEREN de la del catalogo; las que
// coinciden no necesitan entrada. La del motor DOMINANTE para MultiCell lleva guion y el catalogo no.
const MOTOR_ALIAS: Record<string, string> = {
  "MULTI-CELL BASE": "MULTICELL BASE", // motor: mayormente con guion; catalogo (INVIMA): sin guion
  "HEPA DETOX": "HEPA-DETOX", // motor: a veces sin guion
  "GUTIMMUNE PRO": "GUT-IMMUNE PRO", // motor: a veces pegado
};

export type RecommendationCatalogItem = {
  id: string;
  name: string;
  indication: string | null;
  commercialAvailability: string; // en_consultorio | solo_tienda | no_disponible
  // Posologia y composicion del catalogo (cotejo 2026-08-24): las muestra la tarjeta del recomendado,
  // como en el v8. Opcionales: un producto sin ellas se muestra igual, sin la linea.
  servingSize?: string | null;
  presentation?: string | null;
  composition?: string | null;
};

export type RecommendedItem =
  // El modelo lo recomienda y existe en el catalogo: accionable (se puede agregar a la prescripcion).
  | { motorName: string; status: "en_catalogo"; product: RecommendationCatalogItem }
  // El modelo lo recomienda pero NO existe el producto: se muestra como aviso, no desaparece.
  | { motorName: string; status: "no_en_catalogo" };

export function resolveRecommendation(
  recommended: string | null,
  catalog: RecommendationCatalogItem[],
): RecommendedItem[] {
  if (!recommended || !recommended.trim()) return [];
  const byName = new Map(catalog.map((c) => [c.name, c]));
  return recommended
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((motorName) => {
      const canonical = MOTOR_ALIAS[motorName] ?? motorName;
      const product = byName.get(canonical);
      return product
        ? ({ motorName, status: "en_catalogo", product } as const)
        : ({ motorName, status: "no_en_catalogo" } as const);
    });
}

// Nombres que el motor PUEDE emitir (extraidos del v8, Q31), incluidas las grafias inconsistentes. El
// candado (nutraceuticals-recommendation.test.ts) verifica que cada uno resuelva a un producto del
// catalogo: si el catalogo se renombra o falta un alias, truena en CI en vez de fallar en silencio.
export const KNOWN_MOTOR_NAMES: string[] = [
  "OMEGA COMPLEX",
  "MULTI-CELL BASE",
  "MULTICELL BASE",
  "MITO-Q10 PLUS",
  "BERBERINA METABO",
  "CURCUMIN BIOACTIV",
  "HEPA-DETOX",
  "HEPA DETOX",
  "SARCO-PROTECT",
  "GUT-IMMUNE PRO",
  "GUTIMMUNE PRO",
  "D3-K2 OSTEO",
  "ADAPTO-STRESS",
];
