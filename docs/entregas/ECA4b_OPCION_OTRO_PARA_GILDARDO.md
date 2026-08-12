# ECA4b: ¿a qué preguntas de la encuesta les agregamos la opción "Otro"? (para Gildardo)

**Estado:** BORRADOR listo. **NO enviar todavía.** Se manda como pregunta corta y aparte APENAS Gildardo responda la ronda `RONDA_GILDARDO_2026-08-10.md` (no se guarda para una tercera ronda: es una lista que Santiago propone y Gildardo aprueba, decisión de instrumento).

---

**Para Gildardo (breve):** varias preguntas de opción cerrada de la encuesta no tienen una salida "Otro / Otra" para el paciente que no encaja en las opciones. Hoy solo dos la tienen (diagnósticos personales y medicamentos). Te proponemos a cuáles agregarla; tú apruebas la lista final. La opción "Otro" abriría un campo de texto libre; ese texto se guarda como registro, no cambia ningún cálculo.

**Candidatas fuertes (enumeraciones donde el paciente puede no encajar):**

- **d2_21** ¿Qué métodos ha usado para cambiar su peso? (métodos)
- **d3_25** ¿Qué tipo de actividad realiza? (caminata, trote, bici, pesas, yoga, deporte en equipo)
- **d4_34** ¿Sigue algún patrón alimentario? (vegetariano, vegano, keto, sin gluten, sin lácteos, bajo en sal)
- **d4_35** ¿Qué suplementos toma actualmente? (multivitamínico, vitamina D, omega-3, proteína, hierro, magnesio, probióticos)
- **d5_38** ¿Familiares cercanos con estas enfermedades? (DM2, HTA, obesidad, infarto/ACV, cáncer, tiroides, depresión)
- **d5_42** ¿Exposición habitual a contaminantes? (pesticidas, metales pesados, aire)
- **d6_43** ¿Alergias alimentarias diagnosticadas? (leche, huevo, maní, trigo, soya, pescado, mariscos)
- **d6_44** ¿Intolerancias alimentarias? (lactosa, gluten, fructosa)
- **d8_59** ¿Quién prepara sus alimentos habitualmente? (yo, un familiar, restaurante, cafetería)

**Probablemente NO la necesitan** (escalas, sí/no, o frecuencias cerradas y exhaustivas): d3_27 (calidad de sueño), d3_28 (ronca), d3_31 (frecuencia de alcohol), d4_32 (número de comidas), d4_33 (desayuna), d5_37 (toma medicamentos para la presión), d5_41 (fue amamantado), d7_57 (sed), d7_58 (color de orina), d8_60 (frecuencia de comer fuera).

**Nota interna (no para Gildardo):** de las candidatas, **d2_21, d5_38** están acopladas al motor (lista roja). Agregarles "Otro" es un `option_text` NUEVO que no altera las cadenas ancladas (el motor no matchea "Otro"), pero al tocar esas preguntas hay que re-correr `survey-engine-coupling.test.ts` con BD real. Las demás candidatas están fuera de la lista roja.
