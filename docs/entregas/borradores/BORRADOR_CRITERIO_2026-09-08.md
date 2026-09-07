# Borrador de criterio generado de verdad (2026-09-08)

**Para la reunión.** Es la salida REAL del porte del punto 8: prompt de sistema v3 activo en base, paciente
de la base local (sin nombre ni documento), modelo `openai/gpt-oss-20b` con los mismos parámetros que usa
la app.

**Qué comprobar al leerlo, que es para lo que sirve:**

- Los **cinco dominios** en el orden de su archivo, cada uno con la severidad que le dio el motor.
- Los **cortes por sexo** citados (IFC >6,68 en hombres), no los históricos.
- La **dirección de la PABU** nombrada ("desviación por exceso"), no leída como que más es peor.
- **Ningún marcador de laboratorio.**
- **Sin nombre del paciente** y sin markdown.
- Y la **edad correcta** (22), que es lo que dos generaciones anteriores traían mal.

---

    prompt de sistema activo: v3

    === MENSAJE DE USUARIO (5436 caracteres) ===

    Escribe el diagnóstico integral ESTRUCTURADO POR LOS 5 DOMINIOS DEL DFI (ver bloque DFI).
    Sigue el esqueleto del DFI; usa los datos crudos solo como evidencia de respaldo.

    DIAGNÓSTICO FUNCIONAL INTEGRADO (DFI) — ESQUELETO OBLIGATORIO DEL DIAGNÓSTICO:
    Riesgo funcional integrado: ALTO · índice 20/100
    Dominio 1 · Celular-Eléctrico [Óptimo]: IFC Alto · IRC Bajo. Homeostasis celular: membranas íntegras y microambiente equilibrado. Evidencia: IFC 6,98 (Alto — corte H: <4,12 bajo · 4,12–6,68 normal · >6,68 alto) · IRC 1,62 (Bajo — corte H: <1,7 bajo · 1,7–2,1 normal · >2,1 alto) · PABU 1,2 k=0,78 (H) → Desviación por exceso · desviación de φ -0,42 · IEHH 0,81 (Leve)
    Dominio 2 · Metabólico-Estructural [Óptimo]: ISCM Bajo · Fenotipo Normal/Normal. Perfil metabólico-estructural favorable. Evidencia: ISCM-BIS -5,09 (Bajo) · Fenotipo: Fenotipo Normal/Normal · FMI 5,76 · FFMI 19,9
    Dominio 3 · Envejecimiento [Crítico]: IAE +11,1 años · Acelerado. Envejecimiento biológico marcadamente acelerado. Evidencia: EB-BIS 33,1 años · Edad cronológica 22 años · IAE +11,1 años
    Dominio 4 · Conductual-Perceptual [Óptimo]: Sin distorsión. Relación con el cuerpo y la comida sin alertas. Evidencia: Percepción congruente con el fenotipo real
    Dominio 5 · Epigenético-Contextual [Vigilancia]: ICEC 71 · Intermedio. Carga contextual moderada y modificable. Evidencia: ICEC/LE8 71 (Intermedio) · Antecedentes familiares: 1 · Sin barreras estructurales mayores
    Rutas de Atención derivadas: R4 · Desaceleración Envejecimiento

    === DATOS CRUDOS DEL PACIENTE (evidencia de respaldo) ===

    IDENTIFICACIÓN CLÍNICA:
    Sexo: Masculino | Edad: 22 años
    Peso: — | Estatura: — | Cintura: — | Cadera: —
    Ocupación: Empresario(a) / Emprendedor(a) | Estado civil: Unión libre | Estrato: 2

    ANTECEDENTES:
    ¿Familiares cercanos con estas enfermedades?: Cáncer
    ¿Tiene alguno de estos diagnósticos personales?: Ninguna
    ¿Qué medicamentos toma actualmente?: Ninguno
    ¿Le han diagnosticado hipertensión arterial?: No
    ¿Toma medicamentos para la presión arterial?: No
    ¿Fue amamantado/a en su infancia?: Sí, 6 meses o más
    ¿Exposición habitual a contaminantes?: Contaminación del aire

    CONTEXTO SOCIAL:
    ¿Quién prepara sus alimentos habitualmente?: Un familiar
    ¿Con qué frecuencia come fuera de casa?: 1–2 veces/semana
    ¿Tiene acceso fácil a alimentos frescos y saludables?: Sí, siempre
    ¿Hay momentos en que no tiene suficiente comida en el hogar?: No, nunca

    HÁBITOS ALIMENTARIOS:
    ¿Cuántas comidas hace al día?: 3 comidas
    ¿Desayuna regularmente?: Siempre
    ¿Sigue algún patrón alimentario?: Otra: no como pan, Sin gluten
    ¿Qué suplementos toma actualmente?: Ninguno

    FRECUENCIA DE CONSUMO POR GRUPOS:
    Verduras y hortalizas (frecuencia de consumo): 1–2 días
    Frutas enteras (frecuencia de consumo): 1–2 días
    Leguminosas (frecuencia de consumo): 1–2 días
    Pescado y mariscos (frecuencia de consumo): 1–2 días
    Grasas saludables (frecuencia de consumo): 1–2 días
    Lácteos y fermentados (frecuencia de consumo): 3–4 días
    Huevos (frecuencia de consumo): Todos los días
    Cereales integrales y otros (frecuencia de consumo): Nunca
    Raíces, tubérculos y plátanos (frecuencia de consumo): 3–4 días
    Carnes blancas (frecuencia de consumo): 1–2 días
    Cereales refinados y harinas blancas (frecuencia de consumo): Todos los días
    Carnes procesadas y embutidos (frecuencia de consumo): 1–2 días
    Azúcares añadidos y bebidas azucaradas (frecuencia de consumo): 1–2 días
    Ultraprocesados (PCBU) (frecuencia de consumo): 1–2 días
    Carnes rojas (frecuencia de consumo): 5–6 días
    ¿Con qué frecuencia añade sal extra a la comida ya servida?: Nunca
    ¿Desayuna regularmente (antes de las 10 am)?: Sí, todos los días
    ¿A qué hora suele cenar?: Entre 8 y 9 pm

    CONDUCTUAL Y PERCEPTUAL:
    ¿Cómo percibe su cuerpo actualmente?: Normal
    ¿Qué tan satisfecho/a está con su peso?: Neutral
    ¿Qué métodos ha usado para cambiar su peso?: Dieta propia
    ¿Con qué frecuencia pierde el control al comer?: Rara vez

    DETERMINANTES DE LA SALUD:
    ¿Cuántos días/semana hace actividad física?: No hago ejercicio
    ¿Cuánto dura cada sesión?: 0 minutos a la semana
    ¿Qué tipo de actividad realiza?: Ninguna
    ¿Cuántas horas duerme por noche?: 6–7 horas
    ¿Cómo califica la calidad de su sueño?: Regular
    ¿Ronca durante el sueño?: No
    Nivel de estrés en el último mes (1 = sin estrés, 10 = máximo): 6
    ¿Su relación con el tabaco / nicotina?: Nunca he fumado
    ¿Con qué frecuencia consume alcohol?: 1–2 veces al mes

    DIGESTIVO:
    ¿Alergias alimentarias diagnosticadas?: Otra: mantequilla
    ¿Intolerancias alimentarias?: Ninguna
    Hinchazón abdominal: Nunca
    Gases / flatulencia: A veces
    Dolor abdominal: Nunca
    Diarrea: A veces
    Estreñimiento: Nunca
    Reflujo / acidez: A veces
    Náuseas: Nunca
    ¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo?: Ninguna

    HIDRATACIÓN:
    ¿Color de su orina habitualmente?: Amarillo
    ¿Siente sed con frecuencia?: A veces
    Agua (vasos de 200 ml por día): 6

    ESTADO FUNCIONAL:
    Estado EFR: Composición y función óptimas, baja inflamación → estado celular ideal
    Fenotipo estructural: Composición corporal saludable | Fenotipo MCCB: Normopeso
    Sector funcional (IFC × IRC): Estado celular óptimo
    Mecanismo del estado: —
    Riesgos del estado: —

    INDICADORES DEL MODELO:
    AF: — (Normal)
    IR: — (Óptimo)
    FMI: — (Normal)
    IAE: 11.1 (Acelerado)
    IFC: 6.9844101358892505 (Función óptima)
    IRC: 1.6222112345045594 (Bajo riesgo)
    FFMI: — (Normal)
    IEHH: 0.805 (Leve)
    ISCM: -5.094 (ISCM-1 Bajo riesgo)
    PABU: 1.2023475194279418 (Desviación por exceso)


    === BORRADOR GENERADO (openai/gpt-oss-20b) ===

    El paciente, un hombre de 22 años, presenta un riesgo funcional integrado alto, con un índice de 20 sobre 100.  

    En el dominio Celular‑Eléctrico, la función celular se muestra óptima, con un IFC de 6,98, superior al corte alto de 6,68, y un IRC de 1,62, por debajo del rango normal, indicando una baja resistencia interna. La PABU de 1,20, con k = 0,78, señala una desviación por exceso, lo que sugiere un mayor aporte de grasa en relación con la masa magra, aunque el IFC dominante indica membranas celulares intactas y un microambiente equilibrado. El IEHH de 0,81 se sitúa en el rango leve, sin alteraciones significativas.  

    En el dominio Metabólico‑Estructural, la composición corporal es favorable. El ISCM‑BIS de –5,09 indica un riesgo metabólico bajo, y el fenotipo se clasifica como Normal/Normal. El FMI de 5,76 y el FFMI de 19,9 se encuentran dentro de los límites saludables, lo que refuerza la ausencia de sobrepeso o sarcopenia.  

    El dominio Envejecimiento revela una aceleración biológica crítica. La edad cronológica de 22 años se acompaña de un IAE de +11,1 años, con un EB‑BIS de 33,1 años, lo que indica que el proceso de envejecimiento biológico está adelantado en más de una década respecto a la edad real.  

    En el dominio Conductual‑Perceptual, la percepción corporal y la relación con la comida son óptimas. No se observan distorsiones de imagen ni conductas de riesgo alimentario; la percepción está congruente con el fenotipo real.  

    El dominio Epigenético‑Contextual se sitúa en vigilancia. El ICEC/LE8 de 71 indica una carga contextual intermedia, con un antecedente familiar de cáncer y sin barreras estructurales mayores.  

    Las rutas de atención derivadas del DFI apuntan a la desaceleración del envejecimiento. La prioridad de intervención debe centrarse en estrategias que modifiquen los factores que aceleran el proceso biológico, como la mejora de la calidad del sueño, la reducción del estrés y la incorporación de actividad física regular, sin recurrir a restricciones calóricas. El abordaje psicológico debe incluir la valoración del estrés y la promoción de hábitos de sueño adecuados, complementado con intervenciones de estilo de vida que favorezcan la salud celular y metabólica.
