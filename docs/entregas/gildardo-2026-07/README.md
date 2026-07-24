Estos `.js` NO son el motor que corre. El motor vigente vive en `src/clinical-engine/frozen/` (congelado, regla dura 12). Los archivos de esta carpeta son artefactos ENTREGADOS por Gildardo como referencia (2026-07), no codigo en produccion.

# Entrega de Gildardo 2026-07

Inventario completo y decisiones: ver `INVENTARIO.md`.

## Contenido
- **7 modulos `.js`** (`atlas-core-indices.js`, `atlas-encuesta-patron.js`, `atlas-dfi.js`, `atlas-resumen-clinico.js`, `atlas-motores-tratamiento.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js`): re-extraccion del HTML para migrar a software en linea. Referencia para portar (Tratamiento, Diagnostico de encuesta), NO se importan desde la app.
- **Docs de orientacion**: `LEEME.md`, `CHANGELOG.md`, `MAPA-FUNCIONES.md`, `diff-indicadores.md`.
- **`INVENTARIO.md`**: nuestro inventario y las decisiones (que llego, que falta, EB-BIS ya es v5, mecanismo de custodia).
- **`ATLAS.html`**: estado actual del prototipo. Puede no estar en el repositorio por revision de PII (ver `INVENTARIO.md` y el estado del commit).

## No incluido en el repositorio
- **El bundle de `atlas-gil/`** (binario, pertenece a otro repo `CNV-SAS/atlas-gil`): su contenido esta documentado como especificacion en `INVENTARIO.md` (punto 5). No se commitea.

## Regla mientras se migra
No editar la misma pieza en el HTML y en un `.js` a la vez. El HTML sigue siendo la fuente hasta que el backend/online tome el relevo. La ciencia congelada (`src/clinical-engine/frozen/`) solo cambia del lado de Gildardo (regla dura 12).
