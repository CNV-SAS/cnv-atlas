# Smoke de Diagnóstico (dirigido): verifica estos puntos, no todo

**Para:** Santiago. **Fecha:** 2026-08-15.
**Cambio de método:** ya no es "compara todo contra el HTML" (eso dependía de que recordaras el listado). Es "verifica estos N puntos concretos" (lo que se construyó o cambió). Los que YA sabemos que faltan están listados abajo aparte: **no los reportes como bugs nuevos.**

---

## A. Verifica que esté BIEN (lo construido)

1. **Tabla de Wang (Composición), filas nuevas.** Aparecen: **Cadera** (Nivel V), **MG hidratación constante** (Nivel IV), **FFW** (Nivel II). Y los dos desplegables:
   - "Ver desglose de agua (con/sin grasa, L y %)" → abre 6 filas de agua.
   - "Ver parámetros bioeléctricos crudos" → abre Re, Ri, R∞, C, Fo + impedancias (R50, reactancia, Z5, Z50, Z200).
2. **El colapso sobrevive:** abre un desplegable, ve a "Diagnóstico Funcional" y vuelve a "Composición". Debe seguir abierto (vive en la URL).
3. **Decimales:** los valores muestran dos decimales; un entero NO muestra ".00".
4. **Botón de IA en el criterio del profesional:** "Generar borrador con IA" produce un texto que cae en el campo grande; puedes editarlo y guardarlo como criterio.
5. **Mensaje de D8 (contexto sociodemográfico), el defecto que encontraste:**
   - En una evaluación **vieja/demo** cuyo paciente SÍ tiene los datos en el perfil, D8 ahora dice *"Esta evaluación es anterior al registro del contexto por evaluación. Los datos del paciente están en su perfil..."*, NO "no se capturó".
   - En una **evaluación NUEVA** (intake completo hecho hoy, con los sociodemográficos llenos), D8 debe **mostrar los valores** (educación, ocupación, etc.). Esto verifica que las columnas nuevas sí se guardan (una eval seedeada/demo no las trae; usa un intake real).
6. **Veto conductual** (si lo activas): un intake donde en conducta alimentaria se marque un método de control de peso de riesgo (vómito, laxantes, ayuno). Debe salir el banner del DFI y el mensaje en la tarjeta del dominio Conductual. Si no lo activas, no pasa nada (no es bug).

## B. Sanidad rápida (que carguen)

7. Las tres subpestañas (Funcional por defecto, Composición, Encuesta) abren con su contenido.

---

## Lo que YA SABEMOS que falta (NO lo reportes, está en cola)

Estos son de contenido, registrados en BACKLOG, pendientes de construir. No son bugs nuevos:
- **(b)** Los ítems del DFI (tarjetas de dominio) sin los cortes por sexo ni la línea PABU. Hay que re-portarlos del frozen del 13 (modificación autorizada).
- **(f)** El subtítulo de la Diana ("9 anillos IFCxIRC × 9 sectores FFMIxFMI = 81 estados") y algún campo del estado seleccionado.
- **(g2)** EB e ICA-BIS muestran "N/D" (no tienen clasificador en el frozen); pendiente decisión.
- **Layout Diana/radar** (la Diana ocupa mucho, el radar arrinconado) y comparar estados al lado: eso es la fase de diseño, después.

---

## Cómo reportar

Por cada punto de A: "bien" o "mal: [qué]". Con eso confirmamos el contenido antes de entrar al diseño.
