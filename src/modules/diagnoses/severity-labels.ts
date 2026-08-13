// Vocabulario UNICO de severidad del DFI (sev 0..3). Alineado con la decision VIGENTE de Gildardo:
// su `_DFI_SEVL` del HTML al dia (gildardo-2026-08-13, L12848-49) es ["Bajo","Leve","Moderado","Alto"],
// con su propio comentario "Antes: [Optimo/Vigilancia/Moderado/Critico]" (cambio deliberado del 13, no
// rezago; resuelve su §11a del 9 que aun no habia aplicado al prototipo). Antes Atlas mostraba sev0 como
// "Optimo" (decision de Santiago por legibilidad); se porta "Bajo" por instruccion (su archivo al dia
// manda). Lo comparten el radar y las tarjetas del DFI para que las dos superficies no puedan divergir;
// el vocabulario de 5 zonas del HTML (_RAD_ZONE_LBL) NO se usa, y "Excepcional" (inalcanzable) se elimina.
export const SEV_LABEL = ["Bajo", "Leve", "Moderado", "Alto"] as const;
