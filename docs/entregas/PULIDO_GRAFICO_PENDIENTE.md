# Pulido gráfico: la lista que se atiende en UNA pasada (abierta el 2026-09-19)

**Por qué una lista y no arreglos sueltos.** Santiago lo pidió así en el smoke del 19/9: *"hay muchos
ajustes de diseño gráfico, no solo decorar, sino de espacios entre textos y en algunos aparece el fondo
gris (layout carretera) y pues se ve feo. Podemos dejarlo para el final."*

Y conviene por una razón que ya nos costó antes: **el espaciado se corrige por sistema, no por pantalla.**
Arreglar el margen de un bloque suelto produce la pantalla siguiente con otro margen, y la suma es lo que
se ve mal. La pasada única mira las reglas (escala de espaciado, superficie de bloque, jerarquía
tipográfica) y las aplica de arriba abajo.

**Regla mientras tanto:** lo que se encuentre se anota aquí, no se arregla al vuelo.

---

## Lo anotado hasta ahora

| # | Qué se ve | Dónde | Nota |
|---|---|---|---|
| 1 | **Espacios irregulares entre textos** | varias pantallas | Santiago, smoke del 19/9. Falta ubicar los casos concretos: se recorren en la pasada |
| 2 | **El fondo gris asomando** ("layout carretera") | varias pantallas | Un bloque sin superficie propia (`bg-card`) sobre el gris de la página. Ya se corrigió una vez en `bloque.tsx` y en el plan imprimible: la pasada tiene que barrer TODOS los sitios, que es la lección de "una regla también vive en varios sitios" |

## Cómo se cierra

1. Recorrer las pantallas del flujo clínico (Entrada, Diagnóstico, Tratamiento, Seguimiento, Reporte/HC)
   anotando cada caso en la tabla, con su archivo.
2. Decidir las reglas: escala de espaciado, cuándo un bloque lleva superficie, jerarquía de títulos.
3. Aplicarlas de una vez, con candado donde la regla se pueda afirmar (como ya lo hace `bloque.tsx`).

**No entra aquí** lo que no es pulido: si algo se ve mal porque falta o sobra contenido, eso es un cambio
de producto y va por su camino.
