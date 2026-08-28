# Plan · Seguimiento (última etapa sin cotejar)

**Preparado el 2026-08-25, sin construir.** Sale del cotejo contra sus cuatro capturas (un paciente con una sola consulta, y el mismo con dos).

**El reparto, decidido:** portar sus cuatro bloques, **arreglar** sus dos defectos en vez de heredarlos, y **conservar** lo nuestro. El criterio, con las palabras de Santiago: **su pantalla es visual y la nuestra tabular. Un gráfico muestra la tendencia; una tabla da el número. El profesional necesita las dos.**

---

## 1. Inventario

### Lo suyo: cuatro bloques

| # | Bloque | Qué muestra |
|---|---|---|
| 1 | **Capacitancia de membrana (C)** | serie temporal. Texto vigente (Gildardo 2026-08-27 §9): *"mejorar es acercarse a la mediana de su grupo de edad y sexo, no subir"*. El *"Mayor C = mejor integridad de membrana"* anterior se RETIRO: su articulo muestra que C discrimina masa muscular baja por abajo y obesidad por arriba, y sube con el IMC. Mientras la mediana de CAP_REF no este cableada, la serie va NEUTRA (sin verde ni rojo). |
| 2 | **Diagnóstico Funcional — Inicial vs Última** | radar de 5 dominios, dos polígonos superpuestos. *"A menor polígono, mejor estado funcional."* |
| 3 | **φ Convergencia bioeléctrica** | dos gráficos: PABU con su línea φ=1,618, e ICA-BIS con su línea objetivo 0 |
| 4 | **Próximo control — según protocolo del DFI** | ruta activa · frecuencia recomendada · criterio de egreso · fecha (sugerida) · frecuencia · observaciones |

### Lo nuestro: un bloque

`FollowupComparison`: fechas, **aviso de cruce de versiones del motor** (que él no tiene), cambio de estado EFR, cambio de riesgo integrado del DFI, y una **tabla de deltas de los siete índices** (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE).

### Lo que YA tenemos y no se muestra en Seguimiento

**`criterioEgreso` y `frecuencia` de las seis rutas están portados** en `clinical-engine/rutas-content.ts` desde hace tiempo. Se muestran en la subpestaña de Rutas del Diagnóstico (`rutas-section.tsx:106-107`), pero **no en Seguimiento**, que es donde son accionables: la frecuencia produce la fecha del próximo control, y el criterio dice cuándo puede terminar el tratamiento. No hay que portar nada: hay que leerlos donde ya están.

---

## 2. Los dos defectos suyos, verificados

### (b) El gráfico que se desborda: es de fondo, no de ancho

Su `lineFollow` emite:

```js
CE("svg", { width: 560, height: 210, style: { overflow: "visible", maxWidth: "100%" } })
```

**Sin `viewBox`.** Un SVG con `width` en atributo y sin `viewBox` no reescala su contenido: `maxWidth:100%` recorta el viewport y ya. Y `overflow:"visible"` hace que lo que queda fuera **se siga pintando**, encima del vecino. Como el contenedor es `grid auto-fit minmax(300px,1fr)`, cada celda puede quedar en ~430 px mientras el dibujo sigue midiendo 560.

**El arreglo:** `viewBox="0 0 560 210"` + `width="100%"` + `overflow:hidden`. Así el dibujo escala con el contenedor.

### (c) Las dos series NO comparten escala: ya van en dos gráficos

Verificado: cada `lineFollow` calcula su propio `minV`/`maxV`. Son dos SVG independientes, uno por índice, cada uno con su línea de referencia (φ=1,618 y objetivo 0). **Su decisión de separarlos es correcta y se porta tal cual.** Lo que se pisa en la captura no es la escala: es el lienzo, por lo de arriba.

### El estado de una sola consulta

Con una sola medición su pantalla dibuja igual: el radar compara *"Inicial 2026-08-13 vs Última 2026-08-13"*, **la misma medición contra sí misma**, y las series pintan un punto suelto con el eje calculado a su alrededor. No dice que falte nada.

**(a) El arreglo convierte el vacío en información**, no solo deja de dibujar:

> *"Este paciente tiene una sola medición. La comparación aparece con la segunda. Según la ruta activa (R4, cada 90 días), correspondería alrededor del 22/11/2026."*

La fecha sale de la misma frecuencia de la ruta que alimenta el próximo control, así que no es un dato nuevo.

---

## 3. El parámetro que no se mueve

En la captura con dos consultas, la capacitancia va de **2.960 a 2.960**. Verificado qué hace su código: `if (Math.abs(dlt) < 1e-9) better = null` y pinta el segmento en **gris**, en vez de verde o rojo. **Sí lo señala**, con el color. Lo que no hace es explicarlo: su leyenda solo dice "verde = mejora · rojo = retroceso", así que el gris queda sin traducción.

**Propuesta, y el criterio detrás:** decirlo con palabras ("sin cambio"), **y no calificarlo**. Un valor que no se mueve puede ser buena noticia o puede ser un cambio por debajo de lo que la medición distingue, y **no tenemos el cambio mínimo detectable**: es la misma pieza que falta para la EB-BIS, cuyo corte de ±2 años sigue marcado como provisional. Afirmar "se mantuvo estable" sería afirmar más de lo que sabemos.

Así que: **"sin cambio respecto de la medición anterior"**, en gris, sin juicio. Y cuando exista el cambio mínimo detectable, esa frase se puede volver "estable" o "cambio no significativo" con fundamento.

---

## 4. Qué se construye

| # | Pieza | Tipo | Tamaño |
|---|---|---|---|
| 1 | **Próximo control**: ruta activa, frecuencia, criterio de egreso, fecha sugerida, frecuencia editable y **observaciones por evaluación** | porte + hueco nuestro (8.6) | **media** |
| 2 | **Serie de capacitancia (C)** con su semáforo de tramo y el estado "sin cambio" | porte + arreglo | media |
| 3 | **Radar inicial vs última**, reusando `ComparisonLayout` y el radar del DFI | porte | media |
| 4 | **Convergencia φ**: dos gráficos, PABU e ICA-BIS, con sus líneas de referencia | porte | media |
| 5 | **Estado de una sola consulta**, con la fecha estimada de la siguiente | arreglo de defecto suyo | chica |
| 6 | **`viewBox` en todos los gráficos nuevos** | arreglo de defecto suyo | trivial, va dentro de 2-4 |
| 7 | Conservar `FollowupComparison` (tabla + aviso de versiones) | nuestro | nada |

**Dependencia de datos:** las piezas 2, 3 y 4 necesitan la **serie completa** del paciente, no solo la previa. Hoy `comparison-reader` devuelve **dos evaluaciones**; hay que extenderlo a **N**, que es justo lo que dice la entrada registrada del `ComparisonLayout` en `BACKLOG.md` ("falta el DATO: `comparison-reader` da dos, el layout quiere la serie").

**Orden propuesto:** primero **1** (cierra el hueco de la cita y desbloquea la fecha estimada de la pieza 5), luego el **reader a N**, y sobre él las tres visuales.

**Lo que espera respuesta:** las observaciones por evaluación son la propuesta del 8.3. La pieza 1 se puede construir sin ellas (fecha, frecuencia y criterio de egreso no dependen de esa respuesta) y las observaciones se suman cuando conteste.
