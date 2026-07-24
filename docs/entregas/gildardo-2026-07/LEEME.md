# Paquete para migrar ATLAS a software en línea

Contenido de esta carpeta (todo verificado con `node --check` + prueba funcional `import`):

## Lo que pediste
1. **Módulos `.js` nuevos** (6): `atlas-encuesta-patron.js`, `atlas-dfi.js`, `atlas-resumen-clinico.js`,
   `atlas-motores-tratamiento.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js`.
2. **CHANGELOG con la línea final de export** → `CHANGELOG.md` (tabla de exports + cambios de la ronda).
3. **En qué archivo quedó cada función** → `MAPA-FUNCIONES.md`.
4. **Diff del bloque de indicadores** → `diff-indicadores.md`.

## Cómo probar rápido (Node)
```bash
node --check atlas-motores-tratamiento.js
node -e "import('./atlas-motores-tratamiento.js').then(m=>console.log(m.motorTratNutri({sexo:'Femenino',peso:82,tallaCm:160,edad:45,d5_39:['Diabetes tipo 2']},{FFMI:16,FMI:13},{}).etiqueta))"
# -> Dieta Hipocalórica de 1723 kcal/día
```

## Estado — paquete autónomo (7 módulos, 7/7 pasan `node --check`)
- `atlas-core-indices.js` es la **base** (clasificadores por índice + `calcPABU`), sin dependencias.
- `atlas-dfi.js` y `atlas-resumen-clinico.js` ya **importan del core** (import inyectado arriba de cada archivo).
- `atlas-encuesta-patron.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js`, `atlas-motores-tratamiento.js`: autónomos.
- Verificado end-to-end: `computeDFIFromData(enc,bis)` → nivel de riesgo, rutas, párrafo DFI y metas.
- Módulos ES (`export`). Para CommonJS: cambiar la última línea por `module.exports = {...}`.

## Orden de importación
`atlas-core-indices.js` primero; luego dfi / resumen-clinico (dependen del core); el resto es independiente.
