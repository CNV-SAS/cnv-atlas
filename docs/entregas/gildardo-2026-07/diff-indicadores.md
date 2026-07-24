# Diff — bloque de indicadores (tabla de composición / índices en Reporte/HC)

**Ubicación:** `ATLAS_v7.html`, componente `ModReporteHC`, sección 4
("COMPOSICIÓN CORPORAL — NIVELES DE WANG"), dentro del IIFE que arma las filas de la tabla (`tbody`).

**Qué hace:** el reporte ahora muestra **solo los índices alterados** — naranja (`#f59e0b`, riesgo/límite),
rojo (`#ef4444`, alto/obesidad) y azul (`#3b82f6`, déficit/bajo peso). Oculta los normales (verde `#10b981`)
y los sin clasificación. Las cabeceras de nivel solo aparecen si el nivel tiene algún hallazgo; si no hay
nada alterado, muestra un mensaje.

> Cada fila trae `row.clf = { l: <etiqueta>, c: <colorHex> }` (o `null`). El color codifica la severidad.

## Unified diff

```diff
@@ ModReporteHC · tbody de la tabla de índices (Niveles de Wang) @@
+                // Reporte/HC: mostrar ítems alterados (naranja=riesgo, rojo=alto, azul=déficit); ocultar solo los normales (verde) y sin clasificación.
+                var RISK = function(clf){ return !!clf && (clf.c==="#f59e0b" || clf.c==="#ef4444" || clf.c==="#3b82f6"); };
                 var result = [];
                 groups.forEach(function(group) {
-                  result.push(LHDR(group.lbl, group.bg));
-                  group.rows.forEach(function(row, i) { result.push(RowR(row, i)); });
+                  var rr = group.rows.filter(function(row){ return RISK(row.clf); });
+                  if(!rr.length) return;
+                  result.push(LHDR(group.lbl, group.bg));
+                  rr.forEach(function(row, i) { result.push(RowR(row, i)); });
                 });
+                if(!result.length){
+                  result.push(CE("tr",{key:"none"},
+                    CE("td",{colSpan:4,style:{padding:"10px 12px",color:C.dim,fontSize:11,fontStyle:"italic",borderBottom:"1px solid "+C.border}},
+                      "Sin índices alterados (riesgo, alto o déficit): todos los valores medidos están en rango normal.")
+                  ));
+                }
                 return result;
```

## Notas para la migración
- El criterio de severidad (colores) hoy está **acoplado por hex** (`#f59e0b`, `#ef4444`, `#3b82f6`).
  Al migrar conviene reemplazarlo por un enum semántico, p.ej. `clf.sev ∈ {normal, deficit, riesgo, alto}`
  y filtrar por `sev !== 'normal'`.
- El módulo de Diagnóstico/composición **NO** se filtró: sigue mostrando todos los índices. El filtro es
  exclusivo del Reporte/HC.
- `LHDR` = fila cabecera de nivel; `RowR` = fila de índice; `CE` = `React.createElement`.
