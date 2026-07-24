# MAPA — en qué archivo quedó cada función

Origen: `ATLAS_v7.html`. "Línea HTML" = dónde vive hoy en el monolito (aprox., para localizarla).

## Módulos `.js` extraídos (framework-agnósticos)

| Función / constante | Archivo `.js` destino | Línea en ATLAS_v7.html | Tipo |
|---|---|---|---|
| `calcPABU` | `atlas-core-indices.js` | 3201 | fn pura |
| `cIFC` `cIRC` `cPABU` `cAF` `cIR` | `atlas-core-indices.js` | 3210–3256 | fn pura |
| `cISCM` `cIEHH` `cIAE` | `atlas-core-indices.js` | 3264–3292 | fn pura |
| `cFMI` `cFFMI` `cSMM` `cASMI` | `atlas-core-indices.js` | 3305–3376 | fn pura |
| `C5` (paleta), `_dfiCap3` `_dfiFmt` `_dfiSigned` `_dfiIsLimiting` | embebidos en `atlas-dfi.js` | 9279 / 11436–11441 | locales |
| `FREQ_GROUPS` | `atlas-encuesta-patron.js` | 587 | datos |
| `catLabel` | `atlas-encuesta-patron.js` | 642 | datos |
| `calcPatron` | `atlas-encuesta-patron.js` | 2296 | fn pura |
| `RUTAS` | `atlas-dfi.js` | 9301 | datos |
| `computeDFI` | `atlas-dfi.js` | 11443 | fn |
| `computeDFIFromData` | `atlas-dfi.js` | 9523 | fn |
| `rutasActivasDFI` | `atlas-dfi.js` | 9574 | fn |
| `_resSuj` `_resLista` `_resArr` `_resLower` `_resNum` `_resDietaCoarse` `_resSexoM` `_resFMIcat` `_resFFMIcat` | `atlas-resumen-clinico.js` | 11626–11642 | helpers |
| `_resumenNutriParrafo` | `atlas-resumen-clinico.js` | 11579 | fn |
| `_resumenMedicoParrafo` | `atlas-resumen-clinico.js` | 11644 | fn |
| `_resumenEjercicioParrafo` | `atlas-resumen-clinico.js` | 11668 | fn |
| `_resumenPsicoParrafo` | `atlas-resumen-clinico.js` | 11689 | fn |
| `motorTratNutri` | `atlas-motores-tratamiento.js` | 13899 | fn pura |
| `motorTratMedico` | `atlas-motores-tratamiento.js` | 13998 | fn pura |
| `motorTratEjercicio` | `atlas-motores-tratamiento.js` | 14031 | fn pura |
| `motorTratPsico` | `atlas-motores-tratamiento.js` | 14057 | fn pura |
| `INTER_GRUPOS` | `atlas-lista-intercambio.js` | 14105 | datos |
| `INTER_TABLA_A` | `atlas-lista-intercambio.js` | 14119 | datos |
| `INTER_TABLA_B` | `atlas-lista-intercambio.js` | 14142 | datos |
| `CICLO_MENU_21` | `atlas-menu-ciclo.js` | 14079 | datos |

## Se quedan en el componente (React) — NO se extraen como módulo puro

Son código de render (usan `React.createElement`/`CE`, estado y `localStorage`). Documentados por ubicación:

| Pieza | Componente | Línea aprox. | Nota |
|---|---|---|---|
| `_tratLista(titulo,arr,col)` | helper de render | 13991 | Devuelve `CE(...)`. Reescribir en la capa de UI. |
| Rediseño del reporte (resumen/DFI/meta/objetivo/plan/recs) | `ModReporteHC` | 13065+ | Consume los módulos de arriba. |
| Filtro tabla de indicadores | `ModReporteHC` (sección 4) | ~13460 | Ver `diff-indicadores.md`. |
| Sección F "Ejemplo de menú" | `ModTratamiento` | ~15422 | Renderiza `CICLO_MENU_21`. |
| Persistencia próximo control DFI | `ModSeguimiento` | ~12918 | Escribe `atlas:citas:<doc>.proxControl`. |
| `generarMenuGroq` (prompt IA menú) | `ModTratamiento` | ~15022 | Debe ir por backend; pide medidas caseras. |

## Orden de importación sugerido (por dependencias)
1. `atlas-core-indices.js` (por crear: clasificadores `c*` + `num`, `calcPABU`)
2. `atlas-encuesta-patron.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js` (autónomos)
3. `atlas-dfi.js` (depende de 1)
4. `atlas-resumen-clinico.js` (depende de 1)
5. `atlas-motores-tratamiento.js` (autónomo; algunos motores leen rutas del DFI vía `faRec`)
