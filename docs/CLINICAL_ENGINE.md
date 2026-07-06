# CLINICAL_ENGINE.md — Motor clínico de Atlas

**Versión:** 1.0 (basado en inventario de ATLAS v7)
**Estado:** contrato e implementación definidos; contenido numérico pendiente de la entrega final de Gildardo.
**Relación:** `SCIENTIFIC_MODEL.md` define *qué es* ANI-BIS-E (la ciencia, propiedad de Gildardo/Research). Este documento define *cómo se implementa y se porta* el motor en Atlas (la ingeniería).

> **Actualización B11 (port hecho).** El motor real de Gildardo ya se portó. La ciencia entra **verbatim** como JavaScript CommonJS en `src/clinical-engine/frozen/` (`engine.core.js`, `engine.indices.js`, `engine.dfi.js`): excepción nombrada a la regla dura 12 (ver `ARCHITECTURE.md`); nunca se convierte a TS ni se edita, cualquier cambio lo entrega Gildardo. El borde (normalización de sexo, contrato de 94 columnas del Biody, puerta dura fail-loud) vive en `edge/`; el adaptador (`analysis.ts`) y el mapeo al contrato (`engine.ts`) son TS nuestros. Los golden tests (paridad con el HTML, tolerancia 1e-3) están en `src/tests/clinical-engine-golden.test.ts`. La taxonomía real (81 EFR / 9 estructural / 9 FyR / DFI de 5 dominios) tiene autoridad sobre F1-F12/PBI/EIEC. Hallazgo informativo reportado a Gildardo: el `index.ts` de conveniencia de su paquete omitía FMI al calcular ISCM (corregido en nuestro adaptador, la ciencia congelada intacta). Pendiente aparte: el contenido real de la encuesta (IDs `d*`), que enciende el DFI completo; hasta entonces corre degradado y marcado.

## Principios
- **Fidelidad absoluta.** El motor no cambia ni un decimal al portar. Primero equivalencia (golden tests), después optimización. Nunca al revés.
- **Server-side exclusivo, TS puro.** `src/clinical-engine/` no importa Next, React ni Supabase. Entran objetos tipados, salen objetos tipados.
- **Versionado.** Cada salida lleva `engine_version` + `model_version_id` + `rules_version`.
- **Código vs datos.** Las fórmulas son código del engine; los cortes, mapas y las 81 entradas de la Diana son datos versionados del `model-registry` (vienen de los Excel de Gildardo).

## Hallazgos del inventario del v7
El v7 (16.207 líneas, React + Supabase + jsPDF + SheetJS) confirma que el núcleo clínico es determinista y portable. Está en capas:

- **Capa 1:** factores de riesgo + carga alostática (derivados de la encuesta).
- **Capa 2 (tesis doctoral):** MCCB 12 fenotipos (FMI × FFMI × MCA), PBI 9 estados (AF × IR), EIEC (equilibrio hídrico ECW/ICW).
- **Capa 3 (ANI BIS-E):** IFC, IRC, PABU (Cole-Cole), ICA-BIS, ISCM, IEHH, IAE, EB; sector FR (IFC × IRC → S1–S9); Diana EFR de 81 estados; clasificaciones; alertas críticas.

### Fórmulas puras encontradas
```
calcIFC(C, Rinf)        = C / Rinf * 1000
calcIRC(Re, Ri, C)      = (Re / (Ri * C)) * 10
calcPABU(Re,Ri,Rinf,C)  = (Re + Ri) * 0.9 / (Rinf * C)
icaBis                  = PABU - 1.618        (desviación del punto áureo φ)
```
ISCM, IEHH, IAE y EB se consumen de la fuente (`bis`/`enc`), no se calculan con una fórmula simple en esta capa. **Pregunta para Gildardo:** ¿dónde se calculan (otra función, el Excel, ingreso manual)?

### Clasificadores puros
`cIFC`, `cIRC`, `cPABU`, `cAF`, `cIR`, `cISCM`, `cIEHH`, `cIAE`, `cFMI`, `cFFMI`, `cSMM`. Cada uno: valor (y a veces `sexo`) devuelve `{ label, color, risk, k }` (k = banda 1/2/3). Los cortes son, según los comentarios del v7, **EXACTOS de los Excel `MAPA_RyF_BIS` y `Mapa E_BIS`** de Gildardo. Por eso los cortes son datos versionados, no constantes de código.

### Mapeos de estado (ya son lookups tabulares)
- **Fenotipo MCCB (12, F1–F12):** `nivelFMI + '_' + nivelFFMI` → `{ id, nombre, riesgo, color }`. El nivel de FMI usa MCA para distinguir alto clínico vs preclínico.
- **Sector FR (9, S1–S9):** `nivelIFC + '_' + nivelIRC` → sector + nombre.
- **Estado PBI (9):** `nivelAF + '_' + nivelIR` → estado.
- **EIEC:** ratio ECW/ICW → estado hídrico.
- **Diana EFR (81):** llave de 4 bandas `gk(bandaIFC, bandaIRC, bandaFFMI, bandaFMI)` → `DB[llave] = { diagnóstico, mecanismo, biomarcadores, riesgos, nutracéuticos }`. **Esto ya es data-driven.** Se porta como datos versionados al `model-registry`, no como código. (Aquí muere la preocupación de "Diana hardcodeada".)

### Generador de protocolo (determinista)
Una función deriva, por reglas sobre fenotipo + comorbilidades + umbrales de indicadores: estrategia calórica (refs ESPEN/KDIGO/ADA), proteína min/max, restricciones dietarias, exámenes recomendados, suplementación (mapeada a productos VitaCelleBIS), resumen clínico y alerta de síndrome de realimentación. Es código determinista del engine; el resultado se guarda en `treatment_*`.

### IA (Groq)
Groq **solo genera el menú de comida** (`generarMenuGroq`) dados los objetivos del protocolo. El diagnóstico NO es IA. Por tanto: al LLM van objetivos y restricciones (datos clínicos, sin PII) y devuelve el menú. En el v7 la `GROQ_API_KEY` está hardcodeada y la llamada es client-side: ambas cosas se corrigen (key a env, IA server-side).

## El contrato del motor (la interfaz)
Esto es lo que permite construir el stub y cablear la propagación antes del HTML final.

```ts
// Forma (las firmas exactas se fijan en el port)
type EngineInput = {
  sexo: 'M' | 'F';
  edad: number;
  bis: {
    // Cole-Cole
    Re: number; Ri: number; Rinf: number; C: number;
    // Composición (Biody Manager)
    FMI: number; FFMI: number; MCA: number; MCA_ref: number;
    smmW: number; ASMI: number; AF: number; IR: number;
    ECW: number; ICW: number; FFM: number;
    peso: number; talla: number; imc: number;
    // Indicadores de fuente (a confirmar dónde se calculan)
    iscm?: number; iehh?: number; iae?: number; eb?: number;
  };
  survey: Record<string, unknown>; // respuestas codificadas (d1..d5), comorbilidades, LE8, hábitos
};

type EngineOutput = {
  indicators: { ifc; irc; pabu; icaBis; iscm; iehh; iae; eb; FMI; FFMI; AF; IR; /* ... */ };
  classifications: Record<string, { label; color; risk; k }>;
  fenotipo: { id; nombre; riesgo };          // MCCB F1-F12
  sectorFR: { id; nombre };                  // S1-S9
  estadoPBI: { id; nombre; riesgo };
  estadoEIEC: { nombre; riesgo };
  efrState: { number /*1-81*/; diagnostico; mecanismo; biomarcadores; riesgos; nutraceuticos };
  alerts: string[];
  protocol: { estrategia; protMin; protMax; restricciones; examenes; suplementacion; resumenClinico; alertaSindRealim };
  versions: { engine; model; rules };
};
```

## Estrategia de port (golden master + stub-first)
1. **Inventario fino** (este documento es el arranque).
2. **Capturar valores oro:** ejecutar las funciones del v7 (y del HTML final) en Node contra cientos de casos reales. El código viejo decide la respuesta.
3. **Stub-first:** implementar un stub que devuelve un `EngineOutput` con la forma correcta y valores dummy. Construir `indicators` / `diagnosis` / `treatment` y **el cableado de propagación contra el stub**, y probar esa propagación (el bug crónico de ATLAS) ahora, sin esperar el HTML final.
4. **Portar las funciones reales** a `clinical-engine` (TS puro).
5. **Golden tests:** `output_TS == valor_oro` hasta el decimal que defina Gildardo. Cambiar stub por real.
6. **Poblar el `model-registry`** con los cortes/mapas (de los Excel) y las 81 entradas EFR.

## Frontera código vs datos
- **Código** (`clinical-engine`): las fórmulas, la lógica de bandas, los mapeos a fenotipo/sector/PBI/EIEC/EFR, el generador de protocolo.
- **Datos** (`model-registry`, versionados): los cortes de los clasificadores, las 81 entradas de la Diana, los catálogos de fenotipos y sectores, los umbrales/refs de protocolo que cambian entre versiones del modelo.
- **Regla:** si un número clínico puede cambiar entre versiones del modelo, es dato versionado, no constante en código. La frontera exacta se afina con Gildardo.

## Preguntas abiertas para Gildardo
- ¿Dónde se calculan ISCM, IEHH, IAE y EB?
- Confirmar que los cortes y mapas del v7 son idénticos a los de los Excel finales.
- ¿Diferencias del núcleo clínico entre v7 y el HTML final corregido? (esperamos mínimas; el inventario asume estructura estable).
- Firmar una muestra de valores oro como clínicamente correctos (los golden tests prueban paridad con el HTML, no corrección clínica).
