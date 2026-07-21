// Vocabulario UNICO de severidad del DFI (sev 0..3). Fuente de verdad = MOTOR (ver V0-b): el
// clasificador congelado emite "Leve/Moderado/Alto" (engine.dfi.js: iscmMap/iscmCl); sev0 se
// muestra como "Optimo" (lectura de riesgo mas clara que el "Bajo" literal del motor, decision de
// Santiago). Lo comparten el radar y las tarjetas del DFI para que las dos superficies no puedan
// divergir; el vocabulario de 5 zonas del render del HTML (_RAD_ZONE_LBL) NO se usa.
export const SEV_LABEL = ["Óptimo", "Leve", "Moderado", "Alto"] as const;
