"
Subpestaña 1: Diagnóstico funcional:
a) Colores: el html utiliza el verde para algo bueno/optimo, luego el naraja para algo leve/intermedio y luego el rojo para algo malo/elevado (si es malo). Considero que la paleta "semáforo" es mas sencilla de utilizar, ya que un azul genera un contraste importante, aunque yo logo entender que el azul en atlas lo utilizamos para algo super bueno/optimo/mejor. Entonces adoptamos semaforo? me parece mas intuitivo y facil de entender.
b) En la card "celular-electrico" del DFI aparece esto en el html: "IFC 6,98 (Alto — corte H: <4,12 bajo · 4,12–6,68 normal · >6,68 alto)
IRC 1,62 (Bajo — corte H: <1,68 bajo · 1,68–2,11 normal · >2,11 alto)
PABU 1,2 k=0,78 (H) → Desviación por exceso · desviación de φ +0,42
IEHH 0,89 (Leve)" mientras que en Atlas web aparece solo esto: "IFC 6,98 (Alto)
IRC 1,62 (Bajo)
IEHH 0,81 (Leve)"
c)  En la card "metabolico-estructural" aparece este valor en el html: "SCM-BIS -1,75 (Bajo)" mientras que en Atlas web aparece: "ISCM-BIS -5,09 (Bajo)"
d) Radar funcional: no coincide el color del html, de hecho Atlas web vuelve los colores mas transparentes y coloca un sombreado. Incluso, me gustaria que fuera el radar identico a la imagen: "radar-antiguo.png" (no el radar actual del html porque se ve feo), por los colores (blanco, azul, verde, amarillo y rojo) que significaban: excepcional, muy bien, en la norma, a vigilar y a tratar respectivamente con los colores. Sin embargo, ahora quedaron bajo, leve, moderado, alto (adjunto imagen de los 3 radares y a CC tambien 3-radares.png). Entonces no se, funcionalmente puede que sea mejor ya como está, pero anteriormente me parecia mucho mejor. Que piensa CC? Otra opción, seria habilitar una función para ver el radar, pero desde 2 vistas distintas, por ejemplo, un boton que diga, ver sombreado, y otro color que diga, ver sólido. Entonces si le da "ver sombreado" que aparezca el radar tal cual está. Pero si le doy "ver sólido" que aparezca el radar bonito. Así poder alternar entre ambos.
e) Muy buena idea la de juntar el mapa de la Diana y el radar en un solo contenedor. Pero hay un problema y es que la Diana ocupa casi todo el espacio y el radar que pequeño, como desplazado a un rincon. Ademas hay otro problema, y es que  el html tiene la Diana separada en un contenedor aparte, donde uno desliza para abajo dentro de ese contendedor y aparece todo lo referente al estado EFR y la diana. Mientras que Atlas web separó ese detalle del estado EFR en una sección mas abajo. De hecho cuando en Atlas web le damos al botón explorar otros estados, me gusta que se abra un apartado nuevo donde se explique ese nuevo estado. El problema es lo visual, ya que el html cuando se visualiza otro estado, simplemente el mismo contenedor que está con la Diana se renderiza (a pesar de que sobrescriba los resultados del paciente), me parece mejor que se abra otro contenedor al lado para comparar. Pero el diseño del html me sigue pareciendo superior, ya que es mas vertical, le da mas espacio a la Diana y permite mejorar la exploración de otros estados.
f) Dicha sección del Estado EFR que acabé de mencionar, de hecho le faltan algunos datos y difieren del html en los siguiente:
- El html tiene esto como subtitulo de la Diana:
"Mapa Estructura-Funcion-Riesgo Celular: 9 anillos (IFC x IRC) x 9 sectores (FFMI x FMI) = 81 estados"

y tiene esto como la card/contenedor interactivo que se renderiza según el estado y que me parece mucho mejor presentarlo asi de bonito:
Estado seleccionado
#40
Anillo A5 (Funcion alta con inflamacion) | Radio E4 (FFMI Normal / FMI Normal)
IFC
Alto
IRC
Bajo
Anillo (funcion-riesgo)
Optimo celular
FFMI
Normal
FMI
Normal
Fenotipo
FFMI Normal / FMI Normal
Estado EFR
#4 de 81
Diagnostico del estado
Las tarjetas de enfermedades, mecanismos, biomarcadores, riesgos, nutraceuticos y abordaje por profesion se muestran en el panel inferior, fijadas al estado del paciente.
Escala de riesgo
Optimo
Moderado
Riesgo maximo
Lectura de la diana
9 Anillos
IFC x IRC
Funcion y riesgo celular (primario)
9 Sectores
FFMI x FMI
Estructura corporal (secundario)
Centro #1
Optimo
Funcion alta / riesgo bajo
Periferia #81
Riesgo maximo
Disfuncion / estructura comprometida
"

Luego mas abajo el html tiene estas cards:

"📍 Estado del paciente: Anillo A1 · Radio E4 · #4 de 81 — Explorar otras celdas no cambia este diagnóstico
1. 🔬 Enfermedades / Complicaciones probables
Composición y función óptimas, baja inflamación → estado celular ideal
2. ⚙️ Mecanismos bioquímicos / Disfunción celular
—
3. 🧪 Biomarcadores clave
—
4. ⚠️ Riesgos clínicos
Mantener
5. 💊 VITACELLEBIS — Nutraceúticos indicados para este estado
MULTI-CELL BASE
OMEGA COMPLEX
6. 🧭 Abordaje por profesión
Nutricionista: dieta de mantenimiento equilibrada, sin restricciones."


Mientras que Atlas web, solo tiene en la parte del mapa de la diana: "Diana EFR BIS · 81 estados
 // Óptimo
Moderado
Riesgo máximo//
Mapa Estructura-Función-Riesgo Celular · 81 estados
Estado 4 de 81 · anillo A1 Estado celular óptimo · sector E4 Composición corporal saludable
Anillos A1-A9: IFC x IRC (función y riesgo celular, primario). Sectores E1-E9: FFMI x FMI (estructura corporal, secundario). Centro #1 óptimo, periferia #81 riesgo máximo.
Explorar otras celdas no cambia este diagnóstico.
"
 Me parece que mucha información ahi metida.

Y luego el card que no es interactivo de detalles EFR: 
"etalle del estado EFR
Estado EFR: 4 de 81

Fenotipo estructural (FMI × FFMI): F8 · Normopeso

Estado funcional bioeléctrico (IFC × IRC): Estado celular óptimo

El estado EFR combina el sector funcional (IFC × IRC) y el componente estructural (FFMI × FMI): Composición corporal saludable.

Enfermedades / Complicaciones probables
Composición y función óptimas, baja inflamación → estado celular ideal

Mecanismos bioquímicos / Disfunción celular
—

Biomarcadores clave
—

Riesgos clínicos
Mantener

Nutracéuticos sugeridos
MULTI-CELL BASE, OMEGA COMPLEX

Abordaje por profesión
Abordaje para: Nutricionista
Nutricionista: dieta de mantenimiento equilibrada, sin restricciones.

Orientación para ti; no se imprime en el reporte del paciente."

y otro card plano cuando visualizo un estado diferente:
"Explorando la Diana. Ver otras celdas no cambia el diagnóstico del paciente: es solo referencia del modelo. Vuelve al estado del paciente para salir de la exploración.

Estado 59 de 81
Referencia, no es el diagnóstico del paciente
Masa magra alta pero IFC bajo → myosteatosis silenciosa

Mecanismos bioquímicos / Disfunción celular: Calidad muscular pobre pese a cantidad

Biomarcadores clave: Ángulo de fase↓, marcadores oxidativos↑

Riesgos clínicos: Riesgo lesión y disfunción metabólica

Nutracéuticos sugeridos: BERBERINA METABO, MITO-Q10 PLUS, OMEGA COMPLEX, MULTI-CELL BASE"

En conclusión, revisar si adoptamos la card interactiva del html, revisar tambien los datos que se muestran en ambos para que coincidan con el html y si separamos el radar y la Diana.


g) Indicadores ANI-BIS-E. Para empezar, no coinciden valores de la tabla del html con Atlas.
- html:
"ÍNDICES BIOELÉCTRICOS INTEGRADOS · ANI BIS-E
IFC — Índice de función celular	6.98	3.5–6.0	3.48	Función óptima
IRC — Índice de riesgo celular (×10)	16.222	2.0–2.8 (×10)	14.222	Alto riesgo celular
PABU — Distancia a la proporción áurea φ	1.2023	φ = 1.618	-0.4157	PABU bajo
ICA-BIS (PABU − φ)	0.4157	φ = 1.618	0.4157	Desviación leve
EB-BIS — Edad biológica (a)	34.3	22.0	12.3	Envejecimiento acelerado
IAE — Índice de aceleración del envejecimiento (a)	12.3	−5 a +5 años	12.3	Envejecimiento acelerado
ISCM-BIS — Score de susceptibilidad multicomponente	-1.75	≤−1	-1.75	ISCM-1 Bajo riesgo"

- Atlas web:
"Indicador	Valor	Referencia	Δ	Clasificación
IFC · Índice de Función Celular	6.98	> 6.68	0.30	
Función óptima
IRC · Índice de Riesgo Celular	1.62	< 1.68	-0.06	
Bajo riesgo
PABU · Proporción Áurea Bioeléctrica de Uribe	1.20	φ = 1.618	-0.4157	
Reserva bioeléctrica superior
ICA-BIS · Índice de Coherencia Áurea (BIS)	0.42	0 (coherencia)	0.4157	
N/D
ISCM · Índice de Susceptibilidad Cardiometabólica	-5.09	≤−1	-4.09	
ISCM-1 Bajo riesgo
IEHH · Índice del Estado de Hidratación Humana	0.81	≤0	0.805	
Leve
IAE · Índice de Aceleración del Envejecimientoprovisional	12.30	−5 a +5 años	12.3	
Acelerado
EB · Edad Bioeléctrica (EB-BIS)provisional	34.30	—	-	
N/D
FMI · Índice de Masa Grasa	5.76	3–6	1.26	
Normal
FFMI · Índice de Masa Libre de Grasa	19.90	17–25	-1.10	
Normal
AF · Ángulo de Fase a 50 kHz	6.7	6.5–7.0°	-0.0	
Normal
IR · Radio de impedancia	0.76	<0.78	-0.021	
Óptimo"

Este si es muy delicado

h) Falta el botón de la IA al lado del criterio del profesional, si no lo vamos a dejar funcional todavia está bien, pero al menos coloquemolo como estetico. Del mismo modo, el campo de texto deberia ser un poco mas grande por defecto. Ya que la IA siempre lo llena un poco mas.

i) Siguen separados los bloques de confirmar diagnostico y corregir la evaluación. Me gustaria juntarlos. Aunque pensandolo bien, para corregir la evaluación, revisemos si lo dejamos acá o lo movemos a la subpestaña de la encuesta (ya que allá el profesional se entera si hay que corregir la evaluación) o dejarlo en ambos lugares. Quizá aqui como un boton o explicacion corta, mientras que en evaluacion una explicacion mas larga.

subpestaña 2: Composicion corporal.
j) Sigo viendo diferencias de ambas tablas:
- html:
"Indicador	Valor obtenido	Referencia	Δ	Diagnóstico
NIVEL V — CUERPO ENTERO
IMC (kg/m²)	25.7	18.5–24.9	0.8	Sobrepeso
Circunferencia de cintura (cm)	84.0	<94 cm	-10.0	Normal
Clasificación IMC + cintura (NHLBI)	Sobrepeso	IMC 18.5–24.9 · CC ≤102 cm	CC normal	Sobrepeso · riesgo aumentado
ICC (cintura/cadera)	0.792	<0.90	-0.108	Normal
ICT (cintura/talla)	0.475	<0.50	-0.025	Normal
NIVEL IV — TEJIDOS Y SISTEMAS
FFMI — Índice de masa libre de grasa (kg/m²)	19.90	17–25	2.90	Normal
FMI — Índice de masa grasa (kg/m²)	5.76	6–9	-3.24	Bajo en grasa
ASMI — Índice de masa muscular apendicular (kg/m²)	8.03	≥7.0	1.03	Normal
SMM/W — Radio músculo/peso (%)	41.2	≥27%	14.2	Normal
Fenotipo MCCB (FFMI×FMI)	Composición corporal saludable	—	—	Composición corporal saludable
NIVEL III — CELULAR
MCA — Masa celular activa (kg)	—	—	—	Sin dato
Sólidos extracelulares (kg) — matriz colágena	—	—	—	Sin dato
Masa seca sin grasa (kg) — ganancia real magra	—	—	—	Sin dato
AEC/MCA — Radio extracelular/celular	—	<0.45	—	Sin dato
AEC con grasa (L)	—	—	—	Sin dato
AEC con grasa (% de ACT)	—	35–40%	—	Sin dato
AEC sin grasa (L)	—	—	—	Sin dato
AEC sin grasa (% de MLG)	—	35–40%	—	Sin dato
AIC con grasa (L)	—	—	—	Sin dato
AIC con grasa (% de ACT)	—	60–65%	—	Sin dato
AIC sin grasa (L)	—	—	—	Sin dato
AIC sin grasa (% de MLG)	—	60–65%	—	Sin dato
E/I con grasa (AEC/AIC)	—	0.35–0.40	—	Sin dato
E/I sin grasa (AEC_sg/AIC_sg)	—	0.35–0.40	—	Sin dato
AF — Ángulo de fase (°)	6.7	6.5–7.0°	0.2	Normal
IR — Radio de impedancia	0.759	<0.78	-0.021	Óptimo
Mapa AFxIR (PSC)	IR Normal · AF Normal	—	—	Perfil de Salud Celular adecuado
NIVEL II — MOLECULAR
ACT — Agua corporal total (L)	44.66	—	—	Sin dato
FFW — Agua libre de grasa (L)	44.66	—	—	Sin dato
Hidratación sin grasa (%) — deshidratación	—	≥73% (normohidrat.)	—	Sin dato
ACT/MLG — Hidratación masa sin grasa (%)	—	71–74%	—	Sin dato
IEHH — Índice de equilibrio hídrico	0.885	≤0	0.885	Desequilibrio leve
Grasa corporal total (%) — Lípidos Wang	22.4	10–22%	0.4	Sobrepeso adiposo
CMO — diagnóstico óseo (kg)	2.90	—	—	Sin dato
Masa proteica total (kg) — Proteínas Wang	—	—	—	Sin dato
Masa proteica metabólica (kg)	—	—	—	Sin dato"

- Atlas web:
"Composición corporal - Niveles de Wang
Variable	Valor	Referencia	Δ	Diagnóstico
Nivel V · Cuerpo entero
Peso (kg)	80.4	-	-	-
Estatura (cm)	177	-	-	-
IMC (kg/m²)	25.7	-	-	Sobrepeso
Cintura (cm)	84	-	-	Sin riesgo CV
Metabolismo basal (GEB) (kcal)	1849.8	1675.7	+174.1	-
Gasto energético total (GET) (kcal)	2589.8	-	-	-
Nivel IV · Tejidos y sistemas
Masa grasa (kg)	18.0	13.6	+4.4	-
Masa grasa (%)	22.4	17.0	+5.5	-
Masa libre de grasa (kg)	62.4	-	-	-
Masa muscular esqueletica (kg)	33.1	30.5	+2.6	-
Masa muscular de miembros (kg)	25.2	23.2	+2.0	-
Indice de masa libre de grasa (FFMI) (kg/m²)	19.9	17	+2.9	Normal
Nivel III · Celular
Masa celular activa (kg)	39.6	34.8	+4.9	-
Solidos extracelulares (kg)	5.2	-	-	-
Masa seca sin grasa (kg)	17.7	16.9	+0.8	-
AEC/MCA - Radio extracelular/celular	0.437	<0.45	-0.013	Óptimo
Agua extracelular (L)	17.3	-	-	-
Agua intracelular (L)	27.3	-	-	-
Nivel II · Molecular
Agua corporal total (L)	44.7	-	-	-
Hidratación sin grasa (%)	70.3	73.2	-2.9	-
Proteína total (kg)	14.1	-	-	-
Proteína metabólica activa (kg)	11.8	-	-	-
Contenido mineral oseo (kg)	2.9	2.6	+0.3	-
Mineral no oseo (kg)	0.6	-	-	-
Bioelectrico (Cole-Cole)
Resistencia extracelular (Re) (Ω)	627.3	-	-	-
Resistencia intracelular (Ri) (Ω)	1306.4	-	-	-
Resistencia infinita (R∞) (Ω)	423.8	-	-	-
Capacitancia de membrana (C) (nF)	3.0	-	-	-
Angulo de fase 50 kHz (°)	6.7	-	-	Normal
Algunos valores de composición se reconstruyen a partir de la medición cuando el equipo no los exporta, siguiendo el modelo ANI-BIS-E. Por eso puedes ver variables que no aparecían en la pantalla del equipo.

Varias variables de composición aún no tienen clasificación del motor (se muestran con un guion en Diagnóstico); disponibles próximamente."

Tambien sigo por entender por que no se muestra cadera.

- Revisar si es relevante estos valores que aparecen como indicadores principales encima de la tabla en atlas web:
"Clasificación antropométrica
IMC 25.7
Sobrepeso
Cintura 84 cm
Sin riesgo CV
Índice cintura-talla 0.47
Saludable
Umbrales de referencia médica estándar (OMS): IMC, circunferencia de cintura e índice cintura-talla. Son referencia clínica general, no un resultado del motor ANI-BIS-E."
O utilizamos otros indicadores? no importa que se repitan en la tabla. Antes mejor que se repitan y no que falten? para saber realmente en que clasificación de Nivel (wang) están esos indicadores que estamos mostrando.

Subpestaña 3: encuesta:

k: D1, todo muy bien, mismos datos, pero los colores no son los mismos. En algunos cards, el html pone en verde: "Cereales integrales y otros
Nunca, Carnes blancas
1–2d/sem"

Mientras que Atlas esas mismas cards las pone rojo. No son solo esas que te dije, hay mas donde los colores difieren. Necesitamos asegurarnos aqui quien manda, Atlas o HTML?

Incluso en el html aparece: ⚖️ Moderados
Adecuado - (color verde), mientras que en atlas aparece: "⚖️ Moderados
Bajo - (color rojo)
" 
Por qué esa diferencia, quien tiene razón aqui?
L) la pregunta 52 de la encuesta:¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo? de hecho va despues de la pregunta 44: ¿Intolerancias alimentarias?, pero en Atlas web aparece debajo de nauseas (no hace mucho sentido ya que ahi pregunta por cada cuanto le da ese sintoma).

M) En D8, el html pone al final:
"Contexto sociodemográfico
Etnia
Mestizo/a
Educación
Universitario completo
Estrato socioeconómico
2
Estado civil
Divorciado/a
Ocupación
Empresario(a) / Emprendedor(a)"

Mientras que Atlas no lo pone (lo pone es en el perfil del paciente), pero esto pude variar, me gustaria que tambien estuviera en D8. Ya que si cada encuesta varia esto y ponen una etnia diferente o una ocupación que puede cambiar, es mejor capturarlo tambien como parte de la encuesta, no?

"
---

## RESPUESTAS DE CC (2026-08-14) — punto por punto

**(a) Semáforo vs azul.** Estado: **DECISION (Santiago), voto CC = conservar el AZUL** (coincide con el 4o opinante). Con CUATRO bandas (Bajo/Leve/Moderado/Alto) un semaforo de 3 no distingue el mejor estado de "leve": los dos quedarian verdes. El azul le da al mejor su propio color. Contradice (d), que pedia el radar antiguo CON azul; el voto azul cierra las dos. Ya alinee badges de dominio + radar + composicion al azul (fuente unica risk-severity), asi que el mismo "Bajo" ya no es verde en un lado y azul en otro.

**(b) Card celular: faltan cortes inline y PABU.** Estado: **ABIERTO, verificar el frozen.** Los items del DFI se portan del frozen engine.dfi; los nuestros son solo el rotulo ("IFC 6.98 (Alto)"), sin el "corte H: <4,12..." ni la linea PABU. Hay que ver si el engine.dfi del 13-ago trae los items con cortes + PABU; si si, re-portarlos (modificacion autorizada, no a mano). El IEHH 0,89 vs 0,81 es el hilo FFW de P-22.

**(c) ISCM -1,75 vs -5,09.** Estado: **P-22, EN COLA.** La MCA derivada entra a nuestro ISCM y no al suyo (su export corto no la trae y su parseo la deja "—"); misma CLASE (ISCM-1 Bajo riesgo) en los dos. Analizado en el cotejo de numeros.

**(d) Radar sombreado/solido + colores.** Colores = (a): **azul, ya alineado.** Sombreado vs solido: **voto CC = elegir UNO, no un toggle** (un boton mas en una pantalla ya cargada; el remedio se vuelve problema). Con las 3 capturas enfrente reporto cual se lee mejor en la fase de diseno grafico. Estado: **decision (Santiago) + reporte de CC en diseno.**

**(e) Diana + radar juntos: Diana ocupa todo, radar arrinconado.** Estado: **DISENO GRAFICO, no estructura -> fase de diseno.** Voto CC: arreglar el layout Diana/radar ahi. Su idea de que explorar otro estado abra un contenedor AL LADO para comparar (en vez de sobrescribir) es buena; la card interactiva vertical del HTML tambien; se evaluan en diseno.

**(f) Card interactiva del estado + subtitulo de la Diana + datos que difieren.** Estado: **ABIERTO (contenido + diseno).** Regla del cotejo: el HTML manda en QUE se muestra. Portar el subtitulo ("9 anillos IFCxIRC x 9 sectores FFMIxFMI = 81 estados") y los campos del estado seleccionado que falten. Va con (e).

**(g) Tabla de indicadores.** Estado: **CERRADO en lo estructural; ISCM/IEHH en P-22.** Las referencias (>6.68, <1.68), los deltas (0.30, -0.06) y la clasif IRC salen del CLASIFICADOR DEL MOTOR por instruccion explicita de Gildardo (2026-08-02): "corrijan la tabla contra el motor para IFC/IRC/FMI, no al reves". Su tabla del 13-ago quedo STALE (con la vieja "3.5-6.0", el x10 y "Alto riesgo celular"), como el _SEVTXT. El nuestro manda. La clasif IRC del motor ("Bajo riesgo") ademas alimenta el fenotipo -> ningun cambio en los 81 estados. **No hay defecto nuevo.**

**(h) Boton IA + textarea mas grande.** Estado: **HECHO (2026-08-15).** Boton "Generar borrador con IA" en el criterio del profesional (reusa el pipeline del menu, prompt versionado propio, barrera PII), textarea agrandado (rows 8), procedencia en ai_criterion_suggestions + flag ai_assisted. Verificable.

**(i) Confirmar + corregir juntos.** Estado: **CERRADA (Santiago, 2026-08-15).** El bloque de corregir vive en FUNCIONAL (con el de confirmar); y en ENCUESTA un ENLACE CORTO por si descubre el error leyendo las respuestas. A construir en la fase de diseno grafico (el contenido ya esta; es donde se coloca).

**(j) Tabla de composicion (Wang) difiere.** Estado: **HECHO (2026-08-15).** Cotejo campo por campo: se agregaron TODAS las filas que faltaban (Cadera, MG hidratacion constante, desglose de agua con/sin grasa L y %, FFW, Fo, impedancias). Para la legibilidad (44 filas) el detalle fino va en dos desplegables (agua / bioelectrico crudo, colapso en la URL). 2 decimales. Impedancias consolidadas en el bloque bioelectrico (DIV-8). Candado del mapeo extendido. Verificable.

**(k) D1 colores.** Estado: **CERRADO.** Era porte pendiente: la correccion de carnes rojas (grupo 15 a Moderados) + la logica de color propia de Moderados (medio=verde, mucho=rojo), del 12-ago. Portado verbatim del 13-ago. Commit hecho.

**(l) Pregunta 52 (cirugias, d6_qx) en orden equivocado.** Estado: **ABIERTO, porte de orden.** En el HTML va despues de d6_44 (intolerancias); en Atlas aparece tras nauseas. Es el orderIndex del seed. Corregir (bump de encuesta, va con el bloque de encuesta).

**(m) Etnia/sociodemograficos en D8.** Estado: **ABIERTO + de fondo (versionado). VERIFICADO: se guardan SOLO en el perfil** (writeCharacterization hace UPDATE de patientProfiles), NO por evaluacion. Si cambian entre consultas, se SOBRESCRIBEN y se pierde el historico. Santiago tiene razon: para mostrarlos en D8 con el valor de ESA evaluacion y conservar el historico, hay que VERSIONARLOS (capturarlos por evaluacion). **Tamaño: bloque mediano** (esquema para guardarlos por evaluacion + capturar en el intake + leer/mostrar en D8; el gate de etnia por consentimiento sigue). Bloque propio.

---

## ACTUALIZACION CC 2026-08-14 (segundo cotejo: PABU, EB/ICA, colores, decisiones)

**(g1) PABU "Reserva bioelectrica superior" + azul.** CERRADO como porte fiel, con matiz. `cPABU` es byte-verbatim del frozen de Gildardo: PABU < phi CON IFC > 6 devuelve "Reserva bioelectrica superior" (buen estado, verde oscuro en el frozen). NO esta invertido de nuestro lado. Su HTML TABLA dice "PABU bajo" (etiqueta distinta): es su misma inconsistencia de dos clasificadores (como FMI e IRC), y por su instruccion del 2-ago ("corregir la tabla contra el motor") manda el motor -> "Reserva superior". El AZUL SI era un defecto NUESTRO: mi alineacion previa puso azul en el indice 0, y colorSev mapea todo "optimo/verde" a ese indice, asi que TODO indicador optimo (PABU, IFC, IR) quedaba azul. ARREGLADO: la tabla y la composicion usan OPTIMO_CLS/OPTIMO_DOT (optimo=verde); el azul se reserva al mejor nivel del DFI (Bajo, badges + radar). **Matiz para Gildardo (no urgente):** que "Reserva superior" sea el label optimo para un PABU lejos de phi es contraintuitivo aunque fiel a su frozen; su propia tabla dice "bajo". Se puede preguntar si el label/color le cuadra.

**(g2) EB y ICA-BIS sin clasificacion ("N/D").** ABIERTO, decision de Santiago. Verificado: EB e ICA-BIS NO tienen clasificador en el frozen A PROPOSITO (engine.ts:152, comentario explicito). Por eso "N/D". El IAE si clasifica (cIAE). Su HTML muestra "Envejecimiento acelerado" para la EB = el MISMO veredicto del IAE (EB acelerada = IAE acelerado; IAE = EB - edad cronologica). **Propuesta CC:** mostrar en la fila EB la clasificacion del IAE (comparten el veredicto de envejecimiento) y en ICA-BIS una lectura de desviacion (|PABU - phi|, que cPABU ya sabe clasificar en su rama de desviacion). Es cambio de DISPLAY (no toca la matematica del frozen), pero de la capa de clasificaciones: lo dejo propuesto para tu OK antes de tocarlo. Alternativa: pregunta a Gildardo (queres cEB/cICA propios?).

**(g3) Colores inconsistentes en la tabla.** CERRADO en su parte defectuosa (el azul repartido, ver g1). Queda una variacion INHERENTE al frozen: "Normal" de FMI es verde (bueno) y "Normal" de AF es ambar (medio), porque los clasificadores de Gildardo asignan distinto color a cada "Normal" segun su semantica (FMI normal = bueno; AF normal = intermedio). No es un bug: es su semantica. Los dots ya salen todos de la fuente unica (optimo=verde/alerta=ambar/critico=rojo).

**(a)/(d) Colores + radar.** CERRADO. Confirmado: conservar el AZUL (reservado a lo mas optimo, no repartido; ya corregido en g1/g3). Radar SOLIDO (no toggle): las bandas se separan con borde y el poligono de datos sube a opacidad 0.6, porque el sombreado transparente las difuminaba. Commit hecho.

**(i) Donde va corregir.** DECIDIDO (Santiago): corregir en FUNCIONAL (con el resto de acciones del profesional que evalua), + un enlace corto desde ENCUESTA (si descubre el error leyendo la encuesta, no tiene que volver). Confirmar+corregir ya estan juntos en Funcional (checkpoint 2); falta agregar el enlace desde la subpestaña Encuesta. Va con el pulido de Diagnostico.

---

## REVISION DE SANTIAGO 2026-08-15 (punto por punto tras el smoke dirigido)

**(a) Badges: REVERTIR al SEMAFORO (nos equivocamos, Santiago tenia razon).** Una cosa es el RADAR (escala visual, donde el azul ancla) y otra CLASIFICAR un indicador. En un badge que dice si algo esta bien o mal, verde-amarillo-rojo se lee sin pensar; el azul obliga a recordar que significa. **Decision:** badges y clasificaciones = semaforo como el HTML (verde/ambar/naranja/rojo, `_DFI_SEVC`); el AZUL queda SOLO en el radar. Esto REVIERTE la alineacion previa (DIV-6 unificaba badge+radar al azul): ahora divergen a proposito, porque el badge se lee distinto que el radar. **Pendiente: construir** (propuesta de color abajo, con (d)).

**(d) Radar = replicar `radar-antiguo.png`.** Pedido 3 veces, sigue distinto. La imagen: 5 anillos concentricos SOLIDOS (sin sombreado ni transparencia), centro->afuera blanco/azul/verde/amarillo/rojo (Excepcional/Muy bien/En la norma/A vigilar/A tratar), poligono del paciente encima con linea oscura + puntos, leyenda + "A menor poligono, mejor estado". Tenemos 4 niveles, no 5. **Propuesta de mapeo (pendiente OK antes de construir):** 4 anillos solidos, centro->afuera AZUL (Bajo) / VERDE (Leve) / AMARILLO (Moderado) / ROJO (Alto); el azul se conserva (aqui es escala, no clasificacion, como pidio Santiago). Style: anillos solidos con separacion clara, poligono oscuro + puntos.

**(g.1) FMI/FFMI en la tabla de indicadores: sacarlos (son composicion).** VERIFICADO: el HTML los pone en Wang (Nivel IV / Tabla diagnostica), NO en el bloque de indices ANI-BIS-E. Alinear = sacarlos de la tabla de indicadores. OJO: FFMI ya esta en Wang; FMI NO esta en nuestra Wang -> sacarlo de indicadores exige agregarlo a Wang, y eso es parte de la decision (j). Se resuelve junto con (j), no suelto.

**(g.2) EB-BIS con referencia/delta/clasificacion: HECHO (2026-08-15).** Referencia = edad cronologica (EB-IAE), delta = IAE, clasificacion = la del IAE. Capa de display, no toca el frozen. Commit hecho.

**(h) Boton de enviar informe al paciente: YA EXISTE, no duplicar.** Esta en la pestaña de REPORTE (`reports/services/send-report.ts`: render -> Storage -> correo -> marca enviado; aprobacion por RLS + policy `can-manage-reports`; UI en `report-card.tsx`). No va en Diagnostico.

**(j) Tabla de Wang: NO copiar a ciegas, ya esta al dia. Comparacion hecha (no se toco la tabla).** Ver el reporte fila por fila en la respuesta CC del 2026-08-15. Resumen: tras el build de (j), tenemos TODAS las filas de datos del HTML; las diferencias son de PLACEMENT (DIV-8: bioelectrico consolidado) y filas que subimos de su tabla diagnostica a composicion (IMC/FFMI/AEC-MCA, registradas). Las referencias (MCA_ref 52,4% / hidSG_ref 73,2%) son su decision del 12 (§9), no numeros stale. NO copiamos su tabla de display (que podria estar stale): construimos del frozen + sus decisiones. Dudoso para la ronda: si mostrar rangos de referencia por fila (estilo su Tabla 2) y si agregar ASMI/SMM-W/E-I ratios (derivados que su tabla diagnostica lista y composicion no).

**(k)/(m)/(l): CERRADOS (Santiago confirma).** (m) lo verificara con un paciente nuevo (las evals viejas no traen las columnas; el mensaje ya distingue "anterior al registro" de "no respondio").
