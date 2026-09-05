Observaciones etapa por etapa y actualizo /cotejo-visual con las capturas correspondientes de Atlas y del html. En caso de que necesites, puedes utilizar el localhost que tiene las mismas acciones realizadas en atlas web.


Notas importantes: 
a. No voy a subir las capturas de las 4 etapas completas, ya que durante mi revisión me di cuenta que ya hay varias cosas bien hechas que no necesitan ser movidas, por ejemplo, la subpestaña "diagnostico encuesta" está perfecta y no necesita cotejo. Dicho esto, si te paso las capturas que realmente requieren revisión (comparar atlas y html) o aquellas que realmente le faltan algo o quiero señalar algo.
b. Los puntos ##URGENTE son para corregir primero, máxima prioridad. También tu puedes catalogar como ##urgente el que consideres (que yo no marqué o si encuentras otro que se me pasó). Pueden ser aquellos que vayan a cambiar el motor o algo muy importante que requiera bump o afecte la funcionalidad en general. La idea es que apenas corrijamos todos los ##URGENTE le pasó atlas web a Gildardo para que el revise a fondo, por eso es la prisa en corregirlos primero y despues mientras Gildardo revisa corregimos los otros que no tienen la etiqueta ##URGENTE..

**Evaluación**: 
- Observaciones externas:
1. **CERRADO (2026-09-05)**   ·   Era `align-items: stretch`: el `main` es un flex en fila con `min-h-svh`, así que la tarjeta se estiraba a la altura de la pantalla. Con el formulario largo no se notaba; solo en los mensajes cortos. Arreglado con `items-start` **en las dos páginas públicas de encuesta**, no solo en la que tenía captura. Candado en `survey-completeness.test.ts`.
   Encuesta: Una vez completo la encuesta y quiero devolverme al enlace para retomarla, te adjunto la imagen de lo que aparece: "retomar-encuesta-habiendola-completado". Basicamente es un contenedor muy grande, para el mensaje pequeño que solo ocupa la parte superior.
2. Que pasa si un paciente se equivoca diligenciando los datos personales, nombre, celular, ciudad u otros datos como ascendencia, estrato, motivo de consulta, etc.? a dia de hoy no hay forma de corregir esto, se tiene que volver a llenar la enceusta para volver a mandarlos. Solo tenemos habilitado de momento para corregir las preguntas de los dominios de la encuesta.
3. ## URGENTE   ·   **CERRADO (2026-09-05)**: el default de la pestaña deja de estar clavado en el componente y lo decide la página, que es quien sabe si hay diagnóstico. Sin diagnóstico abre en Evaluación; con diagnóstico, en Diagnóstico. Y de paso salió una trampa: el parseo excluía `diagnostico` de la lista válida y lo dejaba caer al default, que casualmente era el mismo, así que con el default configurable `?etapa=diagnostico` habría aterrizado en Evaluación. Candado en `evaluation-tabs.test.ts` y `preservar-scroll.test.ts`.

Cuando estoy en /pacientes/(id) y en la tabla de evaluaciones le doy a "Ver resultados" me lleva a /evaluaciones/(id) y siempre me abre en la pestaña diagnostico. Mi sugerencia seria que si el paciente no tiene diagnostico generado que me lleve siempre primero a la pestaña "Evaluación", pero que si ya está generado el diagnóstico, que me lleve siempre primero a la pestaña "Diagnóstico" como lo tenemos.

- Subpestaña encuesta:
4. Como puedes observar en "vista-completa-2" al final de las condiciones se toman el peso meta del paciente y la fuerza prensil. Pero en el html esto pasa en la subpestaña Antropometria y Bis. La pregunta es, las dejamos acá o en la otra subpestaña?
5. ## URGENTE   ·   **CERRADO (2026-09-05)**: era el 3, como sospechabas. El enlace ponía `?ev=antropometria` y **no** `?etapa`, así que la página caía a su default y aterrizabas en Diagnóstico con la subpestaña correcta seleccionada donde no podías verla. Ahora lleva `?etapa=evaluacion&ev=antropometria`, explícito aunque el default ya esté bien: un enlace que depende de un default se rompe en silencio la próxima vez que alguien lo mueva. Barrido: no hay más enlaces con esa forma.

Al darle click en "importar la medición en Antropometría y BIS" que aparece apenas guardo las condiciones de la toma BIS como observar en la captura "vista-completa-2" de esta subpestaña, en vez de llevarme a la otra subpestaña antropometria y bis, me lleva a la pestaña de diagnostico. Me imagino que está relacionado con el compartamiento del punto 3.

- Subpestaña antropometría y bis:
6. A día de hoy no hay forma de corregir o volver a subir otro BIS xlsx por si el profesional se equivoca de import (por ejemplo el de otro paciente). Del mismo modo, apenas genero el diagnostico no hay forma de corregir las condiciones bis, ni peso meta, ni peso, ni estatura, etc. Lo que si tenemos es regenerar una nueva evaluación por si requeria modificar la encuesta, pero entonces para el resto de variables hacemos lo mismo?
7. ## URGENTE   ·   **CERRADO (2026-09-05)**: el botón nativo era `bg-transparent` y sin borde por el default de shadcn, así que "Seleccionar archivo" y el nombre se leían como un texto corrido. Ahora se ve como botón (secundario, para no competir con el de enviar) y cambia el cursor. Y debajo sale **"Archivo seleccionado: <nombre>"**, aparte y en verde. **Arreglado en el primitivo `Input`**, no en este formulario: el otro input de archivo de la app (el RUT del profesional) tenía el mismo defecto y nadie lo había reportado. Candado en `bis-import.test.ts`.

A pesar de ser una mejora de estilo, es crítica en este momento ya que ha confundido a Gildado. Mirar imagen "archivo-seleccionado". Como ves, no se entiende casi el botón de seleccionar archivo para importar BIS. Deberia aparecer de otro color y al hacer hover que cambie el icono del mouse. Luego una vez que lo suba, que diga "archivo seleccionado" o "archivo que vas a subir". Para que se sepa que ya se escogió uno, y el nombre del archivo que se escogió hacerlo mas evidente, ya que ahi como está se lee casi como si todo fuera un texto de corrido.
8. Te dejo la vista completa de la tabla de wang y lo de Sarcopenia para que cotejes contra el html esta subpestaña.

**Diagnóstico**: 

9. Te dejo el recorrido completo de las subpestañas Diagnostico Funcional y Composición corporal para que compares datos con el html. Por otro lado, la subpestaña "Diagnostico Encuesta" está perfecta! y no necesita cotejo. Pero las otras 2 subpestañas si necesitan cotejo.

- Subpestaña Diagnostico Funcional:
10. El boton de agregar criterio en Criterio del profesional me vuelve a hacer scroll hacia arriba. Pensé que ya estaban solucionados todos los botones de este comportamiento.
11. El diseño del bloque Criterio del Profesional está muy simple y extraño. Fijate las capturas de /Diseño objetivo a ver si podemos mejorarlo. Además pienso que debemos cambiarle el nombre al titulo o ponerlo de subtitulo, porque el html lo titula: "Diagnóstico Integrado ANI BIS-E"
12. ## URGENTE
Revisión de la funcionalidad "Generar borrador con IA". ¿Cual tiene razón, el html o Atlas?, Ya que en el html me lanza este diagnóstico largo y completo:
"El paciente Nico Smoke Final, un hombre de 22.0 años de edad, presenta una evaluación clínica que configura un riesgo funcional integrado de nivel alto con un índice de 20 sobre 100, lo que exige una estrategia de intervención activa priorizada a pesar de conservar un perfil estructural e histológico aparentemente preservado.

En el dominio celular-eléctrico, el paciente se encuentra en un estado óptimo, caracterizado por membranas celulares íntegras y un microambiente fisiológico bien equilibrado. El índice de función celular se ubica en 6.98, superando el umbral masculino de función óptima situado en 6.68, lo que confirma una alta integridad biológica de las membranas que prevalece conceptualmente sobre la lectura de su ángulo de fase de 6.7 grados. Esta reserva bioeléctrica se consolida con un índice de riesgo celular de 1.62, el cual se sitúa por debajo del límite masculino de bajo riesgo de 1.70, descartando procesos inflamatorios celulares de relevancia. La propiedad de acoplamiento bioeléctrico de la unidad celular, evaluada mediante una constante masculina k de 0.78, arroja un valor de 1.20, lo que representa una desviación por debajo del número áureo de 1.618 asociada a la distribución de su componente graso y a la reserva bioeléctrica actual, mientras que el índice de equilibrio hídrico e hidrostático de 0.81 refleja apenas un desequilibrio leve en la distribución de fluidos extracelulares.

En el dominio metabólico-estructural, el estado del paciente se clasifica como óptimo, registrando un índice de susceptibilidad cardiometabólica bajo de -5.09 y una tipificación dentro del mapa de composición corporal correspondiente al fenotipo normopeso o normal-normal. Sus indicadores antropométricos y de composición corporal respaldan esta condición, con un índice de masa corporal de 25.66 kg/m², un índice cintura-cadera de 0.79 y un índice cintura-talla de 0.48, manteniéndose en rangos de bajo riesgo cardiometabólico. La evaluación tisular evidencia un índice de masa grasa de 5.76 kg/m² frente a un índice de masa libre de grasa de 19.90 kg/m² y un índice de masa muscular apendicular de 8.03 kg/m², confirmando una masa muscular esquelética adecuada de 33.12 kg equivalente al 41.2% del peso corporal, sin criterios de sarcopenia ni compromiso de la masa celular activa que alcanza los 39.62 kg.

En el dominio de envejecimiento, el paciente presenta un estado crítico caracterizado por un ritmo biológico marcadamente acelerado. A pesar de su corta edad cronológica de 22.0 años, la estimación de su edad biológica alcanza los 33.1 años, lo que se traduce en un índice de aceleración del envejecimiento de 11.1 años por encima de lo esperado. Esta discrepancia severa de más de una década refleja un desgaste funcional prematuro que contrasta con la salud celular y estructural detectada en la bioimpedancia, señalando una sobrecarga fisiológica latente que compromete su longevidad saludable si no se corrige a tiempo.

En el dominio conductual-perceptual, el paciente se encuentra en una condición óptima, manifestando una autopercepción corporal congruente con su fenotipo real y una postura neutral respecto a su peso. La relación con la comida no exhibe distorsiones relevantes ni alertas severas, reportando una pérdida de control al comer sumamente rara. No obstante, en sus hábitos de vida se observa un sedentarismo absoluto con cero minutos de ejercicio a la semana, una calidad de sueño regular de 6 a 7 horas por noche y un nivel de estrés percibido de 6 sobre 10, acompañados de síntomas digestivos ocasionales como gases, diarrea y reflujo, en el marco de una dieta sin gluten autogestionada con un patrón alimentario caracterizado por una baja frecuencia de verduras, frutas y cereales integrales, y un consumo diario de huevos y harinas refinadas.

En el dominio epigenético-contextual, el paciente se clasifica en nivel de vigilancia, determinado por una carga ambiental y de estilo de vida intermedia reflejada en un puntaje de 71 en la métrica contextual y de salud. Reside en un entorno urbano de estrato 2 con exposición a contaminación del aire y reporta antecedentes familiares de cáncer en primer grado de consanguinidad. A pesar de contar con seguridad alimentaria, acceso garantizado a alimentos y apoyo familiar en la preparación de las comidas, los determinantes de estilo de vida como la ausencia de actividad física, la hidratación inadecuada evidenciada por la tonalidad de la orina y la ingesta insuficiente de fibra actúan como factores epigenéticos modificables que influyen negativamente en su ritmo de envejecimiento.

Como resultado del diagnóstico funcional integrado, la prioridad de intervención se concentra en la ruta de atención enfocada en la desaceleración del envejecimiento. La estrategia clínica debe priorizar la implementación progresiva de un plan de ejercicio estructurado para revertir el sedentarismo, la optimización de los patrones de descanso y manejo del estrés, y la reestructuración del patrón alimentario para aumentar el aporte de antioxidantes y fibra, neutralizando así el sesgo de envejecimiento biológico acelerado sin descuidar la preservación de su óptima salud celular y estructural."

Mientras que Atlas lanza esto (mas corto):
Diagnostico en Atlas web:
"El perfil indica composición corporal saludable y función celular óptima, con inflamación baja y un estado de hidratación leve. No obstante, el índice de aceleración del envejecimiento y la desviación de la proporción áurea bioeléctrica sugieren un proceso de envejecimiento acelerado, corroborado por el dominio de envejecimiento con IAE +11,1 años. El riesgo celular permanece bajo, pero el dominio celular‑eléctrico muestra un alto índice de función celular con bajo riesgo de insuficiencia renal, indicando una carga eléctrica favorable. El riesgo integrado se sitúa en alto, orientando la atención a la desaceleración del envejecimiento como prioridad. Se recomienda enfocar la intervención en estrategias que modulen la señalización celular y el envejecimiento, manteniendo la composición y la función óptimas."

Diagnostico en Atlas local:
"Los indicadores revelan un estado de composición y función corporal óptimo, con inflamación baja y biomarcadores dentro del rango esperado, lo que sugiere una homeostasis celular y metabólica conservada. No obstante, el índice de aceleración del envejecimiento indica un proceso de envejecimiento acelerado, corroborado por el dominio de riesgo Envejecimiento con un incremento de 11,1 años. La desviación por exceso en la Proporción Áurea Bioeléctrica de Uribe y el alto índice de fase a 50 kHz sugieren una ligera alteración en la distribución de la carga eléctrica celular, aunque el radio de impedancia permanece óptimo. El riesgo integrado se sitúa en ALTO, con un score de 20, y la ruta de atención priorizada es la desaceleración del envejecimiento, orientando la intervención a estrategias que mitiguen la aceleración biológica observada."

13. Actualmente apenas le damos al botón "agregar criterio" nos genera guarda el criterio que pusimos. Pero que pasa si el profesional quier eliminar alguno antes de aprobar el diagnostico? que pasa si se equivocó y desea corregirlo? deberia de poder hacerlo si no se ha generado el diagnostico? por otro lado, que se hace con este criterio o diagnostico que coloca el profesional? queda como algo interno/privado en la propia evaluación y solo lo ve el profesional o es para mostrar en un reporte?

14. Al final tenemos este bloque: "¿Un dato de la encuesta quedó mal?
Corrige la respuesta equivocada. Se genera una versión nueva del diagnóstico, el tratamiento y el reporte con el dato corregido; la versión actual no se borra, queda registrada como reemplazada.

Aquí corriges las respuestas de la encuesta. La medición del equipo (Biody) y la identidad del paciente no se corrigen aquí. Si importaste la medición del paciente equivocado, esa evaluación debe cerrarse y hacerse de nuevo con el archivo correcto; esa opción todavía no está disponible, escríbele a soporte.
Botón: "Corregir la evaluación"
" 
Hace sentido dejarlo o quitarlo? ya que esta misma opción está habilitada cuando voy a evaluación -> ver editar encuesta, y me aparece corregir encuesta. Entonces hace mucho sentido que esté aquí, pero si vale la pena dejarlo al final de la subpestaña diagnostico funcional?

15. ## URGENTE
Mejorar DIANA: Se ven algunas partes de textos como "FMI BajoFFMI Bajo E7" difuminados, ademas de que se ven muy pequeños y la DIANA tambien se ve pequeña. En el html ocupa mucho mas espacio. Entonces seria como aumentarle tamaño al grafico y a los textos de la diana. 
Por otro lado, veo ese bloque de la Diana muy saturado de información, revisa que información de esa se repite para ver si podemos eliminar. Ya que primero está la lectura de la diana. Luego el estado del paciente. Luego como indicadores sueltos. Luego las cards que dicen: "Enfermedades / Complicaciones probables", "Biomarcadores clave", etc.

16. Mejorar diseño de las cards del bloque de la Diana que dicen: "Enfermedades / Complicaciones probables", "Biomarcadores clave", etc.

- Subpestaña Composición corporal:

17. Compara bien la tabla de atlas vs la del html, pero yo si vi algo raro y es "ICA-BIS · Índice de Coherencia Áurea (BIS)	0,42	0 (coherencia)	0,4157	
Desviación leve" Ahi pone desviación leve con color verde, mientras que la PABU es color amarillo (practicamente ambos indicadores dicen lo mismo, por eso es raro que uno de color amarillo y otro verde), ademas el html lo pinta amarillo.

**Tratamiento**: 

18. De las pestañas que mas trabajo nos costó, adjunto las capturas del recorrido completo de ambas subpestañas para que cotejes contra el html de forma completa y profunda.

- Subpestaña rutas de atención
19. Solo para confirmar, nosotros tenemos "Resumen del diagnóstico" aquí porque fue una mejora de nosotros o de Gildardo?

20. Nos falta el bloque de OTROS productos (LUVIA)

- Subpestaña Nutricionista
21. ## URGENTE
Divergencia importante por parte de nosotros en Atlas:
Por qué no metemos el bloque "objetivo del plan" con los 4 campos: "Peso meta (kg), objetivo (kcal), PAL (factor) y Deficit (kcal) en el mismo bloque o junto a "Objetivo del tratamiento nutricional" asi como lo hace el html? asi tengamos que ponerle un botón de guardado solo para estos 4 campos, pero ese fue el orden que le dio Gildardo en el html, y la verdad hace mucho sentido, ya que estos 4 campos cambian inmediatamente la tabla de abajo que se llama: "Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)". Ya que si dejamos "objetivo del plan" con los 4 campos donde está, se ignora casi por completo que esto afecta la funcionalidad de la tabla.

22. ## URGENTE   ·   **22.1 y 22.2 CERRADOS (2026-09-05, en dos pasadas)**: eran UNO, y el fondo no era el rótulo sino el PLACEHOLDER. El campo del objetivo estaba vacío diciendo `modelo: 2377` y, dejándolo vacío, salía 2408: prometía una cifra y entregaba otra. Ahora el placeholder dice lo que de verdad se usa (2408 y 1751), la pantalla vuelve a tener UNA cifra por concepto como el HTML, y la distinción calculado/ajustado se conserva en el rótulo (*"recalculado con tus ajustes"* / *"fijado por ti"*), que no cuesta un segundo número. Candado en `cadena-dos-bloques.test.ts`. Detalle: El objetivo ahora dice de dónde sale mirando las cinco entradas que lo mueven (objetivo, déficit, PAL, GEB y peso meta), y cuando no coincide con el del modelo dice cuál era: *"2408 kcal · recalculado con tus ajustes · el modelo sugirió 2.377"*. Igual el GEB: *"1751 kcal (Mifflin · el modelo: 1729)"*. Y la vista previa deja de llamar "Objetivo del modelo" a una cifra que lleva los ajustes. Candado en `cadena-dos-bloques.test.ts`. **22.3 y 22.4 siguen abiertos**, van al final con el 23.
Diferencias que noté en cálculos/formas:
22. 1.  En el bloque "objetivo del plan" aparece esto: "2408 kcal sugeridos por el modelo" basciamente es lo mismo que aparece en el html. Pero lo que me causa intigra es por qué en campo "objetivo (kcal)" aparece como placeholder: "modelo: 2377", no deberia aparecer "modelo: 2408"?
22. 2. El GEB de Atlas segun el modelo es de: 1729 y del html: 1751 . Yo creo que es el mismo error del campo que pasó con kcal, ya que en el campo editable dice 1729 en Atlas, pero en la vista previa si dice 1751 como el html.
22. 3. El html marca las referencias de proteina y grasa mucho mejor que atlas (el html las pone mas completas y bonitas)
22. 4. La formula sintetica del html tiene estos campos (algunos editables y otros de visualización):

GEB (kcal/día)
Factor actividad (PAL)	
GET (kcal/día)
Objetivo calórico (kcal/día)
Peso de cálculo (kg)
Proteína g/kg
Proteína total (g/día)
Proteína (kcal)
Grasas (%)
Grasas (g/día)
CHO por diferencia (g/día)
CHO (kcal)


Mientras que los de Atlas tienen estos (algunos editables y otros de visualización):

Peso efectivo
Gasto energético basal (GEB)
x Nivel de actividad física (PAL)
= Gasto energético total (GET)
- Déficit del modelo
= Objetivo del modelo
Objetivo del plan
+ Proteína
+ Grasa
+ Carbohidratos

Hay que revisar por que diferimos y si mejor adoptamos los del html o nos quedamos con los nuestros o una combinación de ambos.


23. ## URGENTE
El bloque que se llama: "Cómo se llega a ese objetivo" Pienso que es mejor ponerle de titulo "Formula sintetica" como el html. Y el "como se llega a ese objetivo" que quede como subtitulo o rotulo marcado asi como el diseño de contratik tiene algunas cosas. 
Del mismo modo, me parece mucho mas facil de entender como lo presenta el html (GEB, PAL,GET, etc.), pero tambien me gustaria conservar "Cadena efectiva (vista previa)" como lo tiene Atlas, me parece muy brutal el diseño de previsualización de la calculadora. Hay forma de adoptar ambos diseños? inclusive de poner al lado de proteina y grasa las referencias? ya que se ven como raras abajo.

24. En la tabla: "Lista de intercambio U de A · ICBF 2025" el html pone los totales sin decimales y pone el total tambien de la columna "porciones". Del mismo modo, decoremos el botón "recalcular desde el objetivo" que se ve raro.

25. Propuesta de que unifiquemos este bloque: "Adaptar el menú a las restricciones (IA)" al de "Restricciones alimentarias del profesional". Ya sea simplificando mucho colocando un botón al lado que diga "adaptar las restricciones al menú con ayuda de IA". Incluso creo que estos 2 bloques se podrian unir a un solo bloque del menú.

26. Eliminar el bloque de notas de tratamiento. El html no lo tiene, y pienso que no sirve mucho. Yo sigo insistiendo en que debemos hacer el apartado de notas globales y que las mismas notas sean quienes clasifiquen si es una nota de tratamiento, de diagnostico, etc. (segun la pestaña en que el profesional colocó la nota) y que al final, en reportes, se pueda elegir si mandar o no. Pero de momento yo quitaria este bloque denotas de tratamiento.


**Seguimiento**: 

27. Nosotros en la primera evaluación solo tenemos esto: "Próximo control
Ruta primaria activa: R4 · Desaceleración del Envejecimiento. Frecuencia recomendada: Cada 90 días.
Criterio de egreso (DFI): IAE < 5 años y FFMI en rango normal sostenido

Fecha del próximo control (el modelo sugiere una según la frecuencia de la ruta)

11/10/2026
Esta fecha todavía es una sugerencia: el paciente aún no tiene cita agendada hasta que la confirmes. (botón de agendar próximo control)"

Mientras que el html tiene todo esto: "📅 Próximo control — según protocolo del DFI
Ruta primaria activa: R4 · Desaceleración del Envejecimiento. Frecuencia recomendada: Cada 90 días.
🎯 Criterio de egreso (DFI): IAE < 5 años y FFMI en rango normal sostenido
Fecha próximo control (sugerida por protocolo)

04/12/2026
Frecuencia de seguimiento
Cada 90 días
Observaciones".

28. El html a pesar de ser la primera evaluación muestra un mapa de capacitancia y un radar y 2 mapas de adicionales. Nosotros solo mostramos esos mapas cuando hay otra evaluación. Algo para rescatar del html es este parrafo inicial que explica por qué tenerlo incluso en la primera evaluación: "⚡ Capacitancia de membrana (C) — parámetro de seguimiento
Según protocolo, C es el parámetro a seguir. Mejorar es ACERCARSE a la mediana de su grupo por sexo y edad; alejarse, en cualquiera de las dos direcciones, no lo es. Verde = se acerca · rojo = se aleja. Por encima del P95, seguir subiendo es una señal, no una mejoría: la capacitancia también sube con el IMC.
Referencia hombres 18-29 anos (n=503): P25 2.06 · mediana 2.40 · P75 2.82 nF
Ultima medicion: 2.960 nF — Alta (P75-P95)"


**Reporte/HC**:

29. ## URGENTE 
En Atlas web aparece: "Objetivo del tratamiento
No se registró" mientras que en html si aparece: "OBJETIVO DEL TRATAMIENTO
Dieta Normocalórica de 2408 kcal/día"

30. Revisar punto por punto de esta pestaña de Atlas vs HTML ya que si hay algunas divergencias importantes.
---

# LECTURA DE LOS URGENTES (Claude, 2026-09-05, antes de construir)

**Nada construido todavía.** Esto es lo que verifiqué de cada urgente, en el orden en que conviene
hacerlos. Se marca `CERRADO` a medida.

## Lo primero de todo: el 22.1 y el 22.2 son UN solo defecto, y no es de cálculo

**Las dos cifras salen bien. Lo que está mal es un rótulo.** La aritmética lo cierra sin ambigüedad:

| | GEB | por PAL 1,375 | objetivo |
| --- | --- | --- | --- |
| Con el **peso calculado** (72,79 kg) | **1729** | | **2377** |
| Con el **peso meta** que fijaste (75 kg) | **1751** | | **2408** |

O sea que **1729 y 2377 son la misma cadena, y 1751 y 2408 son la otra**. Verificado contra la base: el
snapshot sellado trae `geb 1729`, `kcalObj 2377`, fórmula Mifflin, y su `mtn.geb` también dice 1729, así
que Atlas es coherente consigo mismo. La diferencia aparece porque **la cadena efectiva re-corre con el
peso meta que fijó el profesional**, que es justo para lo que existe.

**El defecto está en la línea que rotula el objetivo** (`treatment-panel.tsx`, bloque "Objetivo del
plan"): decide entre *"fijado por ti"* y *"sugerido por el modelo"* mirando **solo** `adj.kcalObj`. Pero
el objetivo efectivo también se mueve cuando el profesional ajusta el **peso meta**, el GEB, el PAL o el
déficit, porque los cuatro caen en cascada sobre él. Con el peso meta fijado, la pantalla muestra **2408 y
lo rotula "sugerido por el modelo"**, mientras el campo de abajo dice correctamente que el modelo sugirió
2377. **Dos cifras del mismo concepto, y una miente sobre su procedencia.**

**Y no es cierto que el placeholder lea lo que no debe:** `modelo: 2377` es exactamente lo que el modelo
sugirió. El que se equivoca es el rótulo de arriba.

**Por qué el HTML dice 2408 en los dos sitios:** su cadena no distingue sellado de efectivo. Lee
`_mtn.geb` recalculado sobre el peso meta vigente, así que para él "el modelo" siempre es la re-corrida.
Nosotros conservamos la distinción a propósito (DIV-12), y **eso está bien**: lo que falta es decirlo.

**El arreglo es el rótulo, no las cifras.** Que diga de dónde sale el objetivo mirando la cascada entera,
y no un solo campo.

> **Y esto ordena la lista:** el **21** (juntar los cuatro campos con el objetivo) **pone las dos cifras a
> centímetros una de otra**, así que hacerlo antes de arreglar el rótulo hace la contradicción MÁS
> visible, no menos. Y el **29** imprime ese mismo título en la historia clínica, así que arreglarlo antes
> del rótulo metería la cifra mal rotulada en un documento clínico. **El 22 va primero de los tres.**

## 21 · Por qué quedó a medias, verificado

**Portamos el título, no los campos.** Hay dos secciones distintas y en componentes distintos:

- **"Objetivo del plan"** (`treatment-panel.tsx:553`), con los cuatro campos, dentro de la cadena
  calórica.
- **"Objetivo del tratamiento nutricional"** (`:1737`), el texto libre, que se renderiza en otro sitio.

Lo que se hizo fue que el segundo mostrara el objetivo efectivo en su título (*"Dieta normocalórica de
2408 kcal/día"*). Esa fue la mitad que se hizo, y es la que hace pensar que estaba resuelto. **Los cuatro
campos nunca se movieron.**

## 10 · La hipótesis es falsa: ese formulario SÍ usa el helper

Verificado: `professional-criterion.tsx` importa `enviarSinReset` y llama a `useFormToast`, que llama a
`preservarScroll()`. **No quedó fuera.**

Así que la causa es otra y no la puedo nombrar sin reproducirlo en un navegador. La sospecha razonable: el
guard se **cancela** con `wheel`, `touchstart`, `keydown` o `mousedown`, y este bloque es de los pocos
donde el profesional está **escribiendo** justo antes de enviar. Se diagnostica en la etapa de
Diagnóstico, con el navegador delante. **No es una línea.**

## 29 · Causa encontrada, y es chica

La historia lee `objetivoTratamiento: protocol?.objetivoTexto ?? null`, o sea **solo el texto libre** que
escribe el profesional. Si no escribió nada, dice "No se registró".

Su archivo, en cambio, imprime el objetivo **derivado**: *"Dieta Normocalórica de 2408 kcal/día"*, que es
el mismo título que Atlas ya muestra en el panel. **Falta la caída**: si no hay texto libre, que imprima
el derivado. Depende del 22 (ver arriba).

## Los otros cinco urgentes

| # | Lectura |
| --- | --- |
| **3 y 5** | **Son el mismo**, como sospechabas: la pestaña por defecto. Tu regla (sin diagnóstico va a Evaluación; con diagnóstico va a Diagnóstico) es correcta y el 5 se cae solo al arreglarla. Van juntos, y son de Evaluación, así que abren la primera etapa |
| **7** | Aplica, es de estilo y es barato. Y tiene razón de urgencia propia: confundió a Gildardo |
| **12** | Aplica, pero **no es del motor**: es el prompt. El de él produce un informe por dominios y el nuestro un párrafo. **Ninguno de los dos está mal**, son dos prompts distintos; hay que decidir cuál queremos. Lo dejaría urgente porque es lo que Gildardo va a mirar primero, pero anotando que no toca ciencia ni necesita bump |
| **15** | Aplica. La Diana pequeña con texto difuminado y el bloque repetido. Es de Diagnóstico |
| **23** | **Lo bajaría de urgente**, y con razón: es un rediseño de bloque, y el **22.4** (la lista de campos) es la misma discusión. Los dos son presentación y se enredan con el pase de diseño. Hacerlos ahora es hacerlos dos veces. **Propongo: 22.1/22.2 y 21 ahora; 22.3, 22.4 y 23 juntos, después, como una sola decisión de forma** |

## Y uno que NO marcaste y creo que SÍ es urgente: el 17

Lo marcaste como observación normal. **Verificado, y es un veredicto clínico ablandado en dos sitios.**

Nuestro `clasificarIcaBis` tiene un escalón **"Desviación leve" con severidad 0 (verde)**. Su clasificador
**no tiene ese escalón**: en el frozen vigente las dos ramas de desviación del PABU salen en **ámbar**
(`#e6a817`), sin grado intermedio. Por eso su archivo lo pinta ámbar y nosotros verde, que es lo que
viste.

**Y hay una segunda consecuencia que no se ve en la pantalla:** la lista de "índices alterados" de la
historia clínica filtra con `sev < 1`. Con severidad 0, **el ICA-BIS desviado no aparece en el documento
clínico**. O sea que no es solo un color: es un indicador que su archivo señala y el nuestro omite del
registro.

**Y el comentario que lo defiende cita líneas que ya no dicen eso:** apunta a
`engine.core.derived.js:73-77` como "la rama de desviación del PABU", y hoy esas líneas son `cIRC`. El
archivo se movió con el swap del 18 de agosto (el PABU pasó a direccional, Q27) y la cita se quedó.

Es exactamente la familia que venimos cerrando: un color que afirma menos de lo que dice el clasificador,
sostenido por una cita vencida. **Lo subiría a urgente y lo pondría en la etapa de Diagnóstico.**

## Orden propuesto

**Evaluación:** 3+5 (uno solo), luego 7.

**Diagnóstico:** 17 (el nuevo), luego 12, luego 15, luego 10 (con navegador).

**Tratamiento:** **22.1/22.2 primero de todos**, luego 21, luego 29.

**Después, y juntos:** 22.3, 22.4 y 23, como una sola decisión de forma.
