# Re-sincronización del motor contra ATLAS_v8.html del 18

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 2026-08-19

Re-sincronizamos el motor contra tu archivo del 18, con golden tests. Va corto y con los datos.

## Los diez puntos del delta: solo tres necesitaron porte

Verificamos los diez uno por uno. **Siete ya estaban alineados** (los confirmamos, no los asumimos):

| Punto | Estado |
|---|---|
| Vocabulario de severidad [Bajo/Leve/Moderado/Alto] | Ya alineado |
| Radar de cuatro zonas (fuera "Excepcional") | Ya alineado |
| R1-R9 → E1-E9 (traducción al mostrar) | Ya alineado |
| Salvaguarda TCA avisa-no-bloquea | Ya aplicado (ver nota abajo) |
| Hábitos moderados con el óptimo en el medio | Ya alineado (calcLE8 idéntico) |
| Bandera del ICEC en false | Ya alineado (calcLE8 idéntico) |
| REF_POB revisado (12-ago) | Ya hecho |
| §0 orden de derivación (aguas sin grasa) | Ya alineado (fórmulas canónicas) |

**Tres requirieron porte:**
- **PABU al Dominio 1:** portado. La PABU entra al Dominio 1 con su dirección respecto de φ, la k del sexo y la desviación del ICA-BIS, más las anotaciones de corte por sexo en IFC/IRC.
- **Objetivo calórico a 0 (punto 6):** portado. Se retiran los cinco déficits por fenotipo; el déficit queda en 0 y la orientación pasa a texto sin cifra en el campo perfil.
- (El tercero son las tres correcciones que aplicaste al 18, abajo.)

## Las tres correcciones del 18, portadas

- **cMMEM** unificado en EWGSOP2 (H<7,0 · M<5,5). Sigue dormido (dormant): el clasificador de sarcopenia que corre es cASMI; cablear cMMEM duplicaría la señal, así que lo dejamos correcto pero sin cablear.
- **Fila FMI** con la banda 3-6 / 5-9 y el Δ contra 6 / 9.
- **Fila SMM/W** con el borde femenino 22 (ver nota del display abajo).

## Hallazgos fuera de los diez puntos

Aplicamos un criterio simple: si tiene procedencia clara (fecha y motivo), se porta y se registra; si es material, se reporta. Aparecieron tres:

1. **Banda "Alto SS" femenina del FMI (9-12), del 2026-07-28.** Es anterior a la base del 05-ago, por eso no estaba en los diez puntos. Solo afina el rótulo de una mujer con FMI 9-12 (antes saltaba de "Normal" a "Alto CS"); no mueve el estado ni el diagnóstico. **Portada**, por ser tu ciencia vigente con procedencia clara.
2. **DFI redactado como párrafo + metas terapéuticas por profesión** (spec ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional v1.0, que no tenemos). Viven en la misma función computeDFI. **Las dejamos para cuando construyamos Tratamiento**, donde se cablean y se muestran; traerlas ahora las dejaría computadas sin que nadie las mire. Te pediremos la spec cuando lleguemos a esa etapa.
3. **Un desliz de display en tu archivo:** el clasificador cSMM usa 22 y tu propia corrección dice 22, pero una etiqueta de referencia del display (L15079) todavía muestra `M:≥24%`. No nos afecta (nuestra referencia ya está en 22), lo señalamos por si quieres cerrarlo en tu archivo.

## Ningún paciente cambia de estado EFR

Lo verificamos sobre los fixtures y lo garantiza la estructura: el swap **no movió ninguna frontera k**. Como el estado EFR se decide por los k de IFC, IRC, FFMI y FMI, ningún paciente puede caer en otra de las 81 celdas por este re-port. No hay caso que revisar.

## Nota sobre la salvaguarda de TCA (CA-2)

Tu archivo del 18 **todavía trae el texto que bloquea** ("Salvaguarda activa: el módulo nutricional PAUSA la restricción calórica automática"). Nosotros corremos la versión que **avisa y no bloquea**, según tu instrucción del 9 de agosto (D-002): el plan no se pausa, se marca remisión y el peso meta acordado sigue gobernando el cálculo. No nos adelantamos: es que esa corrección no ha llegado a tu archivo. La mantenemos por tu instrucción escrita.

## Una pregunta que surgió al portar (SMM/W)

Al portar encontramos dos umbrales distintos para el SMM/W en mujeres, en tu v7 y en el 18: el clasificador `cSMM` usa mujer < 22 (sarcopenia), pero el gate de sarcopenia del fenotipo (obesidad sarcopénica, `motorDiagnostico`) usa mujer < 24. Una mujer con SMM/W entre 22 y 24 sale "Normal" por `cSMM` y "sarcopénica" por el fenotipo. No lo tocamos, porque seríamos infieles a tu archivo (ambos usan lo que usan). ¿El gate del fenotipo debe ser 22 como `cSMM`, o el 24 es deliberado? Tu §3 del 18 dijo que el 24 "no salía de ningún clasificador", pero este gate lo usa. No bloquea nada; lo dejamos como está hasta que nos digas.

## Reproducción independiente del §0 (agua extracelular)

Ya te confirmamos que reproducimos tus tres pruebas sobre la cohorte de 5.885 registros (Node, sin dependencias):
- **Distribución idéntica:** mediana AEC/ACT mujeres 42,10%, hombres 38,88%.
- **El cociente casi no tiene contenido bioeléctrico:** R² de Re/R∞ 0,032 (M) / 0,006 (H), idénticos a los tuyos; la edad univariada explica ~0,33, diez veces más, y con signo negativo.
- **La decisiva:** mujeres con la misma Re/R∞ (±0,005), <35 dan 42,65% y >55 dan 40,55%, diferencia 2,10 puntos (los tuyos, 2,1), con los 97 casos <35 exactos. Robustez: 9 de 9 bandas centrales en la misma dirección.

Da lo mismo. Puedes escribir sobre la AEC sabiendo que una reproducción independiente coincide, incluida la comparación de mujeres que más te pesaba. El 42% sigue marcado en validación.

## Constelación de versiones

ENGINE_VERSION 1.0.0 → 1.1.0; PROTOCOL 2026-08-03 → 2026-08-19. Golden tests verdes. Los diagnósticos ya emitidos quedan con su versión anterior (inmutabilidad); un seguimiento que cruce versiones lo avisa de forma discreta.
