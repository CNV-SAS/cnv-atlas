# CHANGELOG — ATLAS_v7.html → módulos para software en línea

Paquete para modularizar `ATLAS_v7.html` (app profesional, un solo archivo, React.createElement).
Todo lo de este paquete se extrajo del **estado actual** del HTML y cada módulo pasa `node --check`
y una prueba funcional (`import` + ejecución con paciente de prueba).

> Regla de oro: mientras se migra, **no edites la misma pieza en el HTML y en el `.js` a la vez**.
> El HTML sigue siendo la fuente hasta que el backend/online tome el relevo.

---

## 1. Módulos `.js` nuevos y su LÍNEA FINAL DE EXPORT

| Archivo | Contenido | Línea final de export |
|---|---|---|
| `atlas-core-indices.js` | Clasificadores por índice + `calcPABU` (base, sin dependencias) | `export { calcPABU, cIFC, cIRC, cPABU, cAF, cIR, cISCM, cIEHH, cIAE, cFMI, cFFMI, cSMM, cASMI };` |
| `atlas-encuesta-patron.js` | Grupos de frecuencia (GABA/ICBF, 15 grupos), `catLabel`, `calcPatron` | `export { FREQ_GROUPS, catLabel, calcPatron };` |
| `atlas-dfi.js` | Motor DFI + adaptador + rutas | `export { computeDFI, computeDFIFromData, RUTAS, rutasActivasDFI };` |
| `atlas-resumen-clinico.js` | Párrafos de resumen por profesión + helpers | `export { _resumenNutriParrafo, _resumenMedicoParrafo, _resumenEjercicioParrafo, _resumenPsicoParrafo };` |
| `atlas-motores-tratamiento.js` | 4 motores deterministas de tratamiento | `export { motorTratNutri, motorTratMedico, motorTratEjercicio, motorTratPsico };` |
| `atlas-lista-intercambio.js` | Lista de intercambio U de A · ICBF 2025 (grupos, subgrupos, catálogo) | `export { INTER_GRUPOS, INTER_TABLA_A, INTER_TABLA_B };` |
| `atlas-menu-ciclo.js` | Ciclo de 21 menús en medidas caseras | `export { CICLO_MENU_21 };` |

Son módulos ES (`export`). Para CommonJS cambia la última línea por `module.exports = { ... }`.

---

## 2. Cambios funcionales de esta ronda (para el changelog del repo)

### Motores de tratamiento (deterministas)
- **Modelo calórico reemplazado**: Mifflin-St Jeor (peso actual) × Factor de Actividad **prescrito**
  (`motorTratEjercicio(...).faRec`), no un FA fijo.
- `motorTratNutri`: GEB → GET → objetivo. **Déficit editable** que se aplica siempre
  (positivo = hipocalórico, negativo = superávit/hipercalórico). `tipoEnergia` se recalcula
  `kcalObjetivo` vs `GET`. Salvaguarda TCA pausa lo hipocalórico. Devuelve
  `{geb,fa,faNivel,get,kcalObjetivo,deficit,tipoEnergia,etiqueta,protKg,protG,fatG,choG,sodioMax,chips,attrs,notas,...}`.
- `motorTratMedico/Ejercicio/Psico`: metas/monitoreo/remisión, FITT-VP + clearance ACSM, SCOFF/PHQ-9/GAD-7.

### DFI
- `computeDFI` ahora devuelve además `parrafo` (DFI redactado como párrafo, transcripción de los 5 dominios)
  y `metas` (por rol: `nutricion/medicina/ejercicio/psicologia`, con salvaguarda R3/TCA).

### Resumen clínico por profesión
- 4 párrafos (`_resumen*Parrafo`) que resumen alimentación/antecedentes/actividad/imagen corporal según el rol.

### Lista de intercambio
- Reconstruida desde el Excel **UdeA 2018** (fuente: "Lista de intercambio U de A · ICBF 2025"):
  12 grupos (G1–G12, incluye mecato y bebidas), 21 subgrupos, 350 alimentos, 27 nutrientes.

### Encuesta / patrón
- `FREQ_GROUPS` a 15 grupos (nueva carne roja `d1_15`), `catLabel` y `calcPatron` alineados a GABA/ICBF.

### Menú
- `CICLO_MENU_21` convertido de gramos/cc a **medidas caseras** (vaso, pocillo, presa, tajada, cucharada,
  unidad, porción). El prompt de IA del menú también exige medidas caseras.

### Reporte/HC (cambios dentro del componente `ModReporteHC`, ver MAPA-FUNCIONES.md)
- Rediseño sin duplicados, en orden: composición → resumen dx por profesión → DFI → meta → objetivo →
  nutracéuticos enviados → plan → recomendaciones → remisiones → próxima cita.
- **Nutracéuticos enviados** = solo los que el profesional marcó/despachó (`localStorage["atlas:nutra:<doc>"]`).
- **Plan** ahora sale del motor con el plan editado y persistido (`localStorage["atlas:plan_pn:<doc>"]`).
- **Próxima cita** = próximo control del seguimiento basado en DFI (`localStorage["atlas:citas:<doc>"].proxControl`),
  con respaldo que recalcula la fecha desde la frecuencia del protocolo del DFI.
- **Tabla de indicadores**: solo muestra ítems alterados (naranja/rojo/azul), oculta los normales. Ver `diff-indicadores.md`.

### Persistencia (localStorage) que el backend debe modelar
`atlas:plan_pn:<doc>` (plan nutricional editado) · `atlas:obj_nutri:<doc>` (objetivo escrito) ·
`atlas:plan_inter:<doc>:<fecha>` (porciones por intercambio) · `atlas:nutra:<doc>` (nutracéuticos despachados) ·
`atlas:citas:<doc>` (`.proxControl`, `.frecControl`, `.nutr/.med/.ej/.psi`).

---

## 3. Dependencias — TODAS RESUELTAS (paquete autónomo)
- `atlas-core-indices.js` es la **base** (clasificadores por índice + `calcPABU`), sin dependencias.
- `atlas-dfi.js` → `import { calcPABU, cIFC, cIRC, cIEHH, cIAE, cFMI, cFFMI } from './atlas-core-indices.js'`.
  Además lleva embebidos, como locales, la paleta `C5` (metadata de color de las rutas) y los helpers del
  párrafo (`_dfiCap3, _dfiFmt, _dfiSigned, _dfiIsLimiting`).
- `atlas-resumen-clinico.js` → `import { cFMI, cFFMI } from './atlas-core-indices.js'`.
- `atlas-motores-tratamiento.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js`, `atlas-encuesta-patron.js`:
  autónomos.
- **Verificación end-to-end** (Node ESM): `computeDFIFromData(enc,bis)` produce nivel de riesgo, rutas
  activas, párrafo del DFI y metas por rol; los 4 motores y los resúmenes por profesión ejecutan sin errores.
  Los 7 módulos pasan `node --check`.
- Nota: `num` NO es dependencia externa — `computeDFIFromData` lo define localmente.
