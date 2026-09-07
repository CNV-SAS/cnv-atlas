Observaciones etapa por etapa y actualizo /cotejo-visual con las capturas correspondientes de Atlas y del html. En caso de que necesites, puedes utilizar el localhost que tiene las mismas acciones realizadas en atlas web.


Notas importantes: 
a. No voy a subir las capturas de las 4 etapas completas, ya que durante mi revisión me di cuenta que ya hay varias cosas bien hechas que no necesitan ser movidas, por ejemplo, la subpestaña "diagnostico encuesta" está perfecta y no necesita cotejo. Dicho esto, si te paso las capturas que realmente requieren revisión (comparar atlas y html) o aquellas que realmente le faltan algo o quiero señalar algo.
b. Los puntos ##URGENTE son para corregir primero, máxima prioridad. También tu puedes catalogar como ##urgente el que consideres (que yo no marqué o si encuentras otro que se me pasó). Pueden ser aquellos que vayan a cambiar el motor o algo muy importante que requiera bump o afecte la funcionalidad en general. La idea es que apenas corrijamos todos los ##URGENTE le pasó atlas web a Gildardo para que el revise a fondo, por eso es la prisa en corregirlos primero y despues mientras Gildardo revisa corregimos los otros que no tienen la etiqueta ##URGENTE..

**Evaluación**: 
- Observaciones externas:
1. **CERRADO (2026-09-05)**   ·   Era `align-items: stretch`: el `main` es un flex en fila con `min-h-svh`, así que la tarjeta se estiraba a la altura de la pantalla. Con el formulario largo no se notaba; solo en los mensajes cortos. Arreglado con `items-start` **en las dos páginas públicas de encuesta**, no solo en la que tenía captura. Candado en `survey-completeness.test.ts`.
   Encuesta: Una vez completo la encuesta y quiero devolverme al enlace para retomarla, te adjunto la imagen de lo que aparece: "retomar-encuesta-habiendola-completado". Basicamente es un contenedor muy grande, para el mensaje pequeño que solo ocupa la parte superior.
2. ## PENDIENTE (2026-09-05)   ·   **Verificado que no existe el camino** y que el reinicio de la evaluación NO lo cierra: nombre, documento, celular y ciudad **no pasan por la encuesta**, viven en el registro del paciente. Es bloque propio, no un formulario: corregir identidad toca la resolución de identidad, la auditoría clínica y, si cambia el documento, el consentimiento firmado. Antes de construirlo hay que decidir **quién puede corregir qué** y **qué queda registrado del valor anterior**. Detalle en `BACKLOG.md`.
   Que pasa si un paciente se equivoca diligenciando los datos personales, nombre, celular, ciudad u otros datos como ascendencia, estrato, motivo de consulta, etc.? a dia de hoy no hay forma de corregir esto, se tiene que volver a llenar la enceusta para volver a mandarlos. Solo tenemos habilitado de momento para corregir las preguntas de los dominios de la encuesta.
3. ## URGENTE   ·   **CERRADO (2026-09-05)**: el default de la pestaña deja de estar clavado en el componente y lo decide la página, que es quien sabe si hay diagnóstico. Sin diagnóstico abre en Evaluación; con diagnóstico, en Diagnóstico. Y de paso salió una trampa: el parseo excluía `diagnostico` de la lista válida y lo dejaba caer al default, que casualmente era el mismo, así que con el default configurable `?etapa=diagnostico` habría aterrizado en Evaluación. Candado en `evaluation-tabs.test.ts` y `preservar-scroll.test.ts`.

Cuando estoy en /pacientes/(id) y en la tabla de evaluaciones le doy a "Ver resultados" me lleva a /evaluaciones/(id) y siempre me abre en la pestaña diagnostico. Mi sugerencia seria que si el paciente no tiene diagnostico generado que me lleve siempre primero a la pestaña "Evaluación", pero que si ya está generado el diagnóstico, que me lleve siempre primero a la pestaña "Diagnóstico" como lo tenemos.

- Subpestaña encuesta:
4. Como puedes observar en "vista-completa-2" al final de las condiciones se toman el peso meta del paciente y la fuerza prensil. Pero en el html esto pasa en la subpestaña Antropometria y Bis. La pregunta es, las dejamos acá o en la otra subpestaña?
5. ## URGENTE   ·   **CERRADO (2026-09-05)**: era el 3, como sospechabas. El enlace ponía `?ev=antropometria` y **no** `?etapa`, así que la página caía a su default y aterrizabas en Diagnóstico con la subpestaña correcta seleccionada donde no podías verla. Ahora lleva `?etapa=evaluacion&ev=antropometria`, explícito aunque el default ya esté bien: un enlace que depende de un default se rompe en silencio la próxima vez que alguien lo mueva. Barrido: no hay más enlaces con esa forma.

Al darle click en "importar la medición en Antropometría y BIS" que aparece apenas guardo las condiciones de la toma BIS como observar en la captura "vista-completa-2" de esta subpestaña, en vez de llevarme a la otra subpestaña antropometria y bis, me lleva a la pestaña de diagnostico. Me imagino que está relacionado con el compartamiento del punto 3.

- Subpestaña antropometría y bis:
6. **CERRADO EL CASO FRECUENTE (2026-09-05)** con el guard: mientras no haya diagnóstico se puede volver a importar y la medición anterior se reemplaza. **## PENDIENTE (2026-09-05)** la otra mitad: corregir medición, condiciones, peso o estatura **después** de generar. Hoy no hay salida, y la diseñada es el reinicio de la evaluación, medido y sin construir (ver `BACKLOG.md`: escritor propio, ~medio día, y la fila que puede crecer es qué pasa con el tratamiento y el reporte de la evaluación vieja).
   A día de hoy no hay forma de corregir o volver a subir otro BIS xlsx por si el profesional se equivoca de import (por ejemplo el de otro paciente). Del mismo modo, apenas genero el diagnostico no hay forma de corregir las condiciones bis, ni peso meta, ni peso, ni estatura, etc. Lo que si tenemos es regenerar una nueva evaluación por si requeria modificar la encuesta, pero entonces para el resto de variables hacemos lo mismo?
7. ## URGENTE   ·   **CERRADO (2026-09-05)**: el botón nativo era `bg-transparent` y sin borde por el default de shadcn, así que "Seleccionar archivo" y el nombre se leían como un texto corrido. Ahora se ve como botón (secundario, para no competir con el de enviar) y cambia el cursor. Y debajo sale **"Archivo seleccionado: <nombre>"**, aparte y en verde. **Arreglado en el primitivo `Input`**, no en este formulario: el otro input de archivo de la app (el RUT del profesional) tenía el mismo defecto y nadie lo había reportado. Candado en `bis-import.test.ts`.

A pesar de ser una mejora de estilo, es crítica en este momento ya que ha confundido a Gildado. Mirar imagen "archivo-seleccionado". Como ves, no se entiende casi el botón de seleccionar archivo para importar BIS. Deberia aparecer de otro color y al hacer hover que cambie el icono del mouse. Luego una vez que lo suba, que diga "archivo seleccionado" o "archivo que vas a subir". Para que se sepa que ya se escogió uno, y el nombre del archivo que se escogió hacerlo mas evidente, ya que ahi como está se lee casi como si todo fuera un texto de corrido.
8. Te dejo la vista completa de la tabla de wang y lo de Sarcopenia para que cotejes contra el html esta subpestaña.

**Diagnóstico**: 

9. **HECHO (2026-09-05). Cotejo fila por fila de las dos subpestañas contra sus capturas. Salieron cuatro cosas, y una era un defecto nuestro de verdad.**
    **(a) EL SIGNO DE LA DESVIACIÓN DE φ. CERRADO.** Su chip del PABU dice *"desviación de φ +0,42"* y el nuestro decía **−0,42**, con el mismo PABU (1,2). Y en la MISMA pantalla, la fila ICA-BIS de la tabla decía 0,42: **dos signos para el mismo concepto**. La causa era una omisión nuestra, no su matemática: `computeDFIFromData` hace `num("ICA_BIS","icaBis") || (pabu − 1.618)`, o sea que **si el dato no viene en la fila lo recalcula CON SIGNO**; su aplicación llena ese campo y la nuestra no. Se le entrega el insumo, con el mismo valor que el motor ya sella. **Sube `ENGINE_VERSION` a 1.3.1** (patch: cambia un texto sellado, ninguna cifra, severidad, riesgo ni ruta). **El golden no podía verlo**: su donante tiene PABU 1,9925, por encima de φ, donde el valor con signo y el absoluto coinciden. Candado en `ica-bis-signo-del-chip.test.ts`.
    **(b) EL PUNTO 17, CORREGIDO.** Este cotejo fue el que destapó que su archivo tiene DOS reglas para la fila ICA-BIS, una por superficie. Ver el punto 17.
    **(c) LOS DECIMALES DE PABU e ICA-BIS. CERRADO.** Su tabla dice 1.2023 y 0.4157; la nuestra decía 1,20 y 0,42. En estas dos filas no es cosmético: a dos decimales el mismo renglón mostraba **0,42 en el valor y 0,4157 en la Δ**, que son la misma cifra. Van a cuatro, como la suya.
    **(d) DOS DIVERGENCIAS QUE NO TOCO, Y UNA VA PARA GILDARDO.**
    · **La referencia del IFC de su tabla usa el corte HISTÓRICO 3,5–6,0** (Δ 3,48), y **su propio prompt de IA lo prohíbe con todas las letras**: *"Está prohibido usar los cortes históricos únicos (IFC 3,5/6,0 · IRC 2,0/3,4 · PABU con k=0,9): fueron reemplazados porque desplazaban sistemáticamente la lectura de las mujeres"*. Nosotros usamos el corte por sexo (> 6,68 para hombres, Δ 0,30). **Estamos bien y su tabla quedó stale; va a la ronda.**
    · **La etiqueta de la fila PABU:** su tabla usa un clasificador local (`dPABU`, "PABU bajo") y nosotros el congelado `cPABU` ("Desviación por exceso"). **El color coincide (ámbar los dos).** Mantengo `cPABU` porque es el clasificador del motor y él mismo dijo *"cPABU: pórtenlo tal cual"*, pero queda declarado.
    **(e) TODO LO DEMÁS COINCIDE**, cifra por cifra: IFC 6,98 · IRC 1,62 · PABU 1,2023 · ICA-BIS 0,4157 · ISCM −5,09 · IEHH 0,805 · EB-BIS 33,1 · IAE +11,1 · AF 6,7 · IR 0,759, y las cinco tarjetas del DFI con sus severidades, el riesgo integrado (ALTO 20) y la ruta (R4). La tabla de Wang de esta subpestaña es la misma que ya se cotejó celda por celda en el punto 8.
9b. Tu petición original: Te dejo el recorrido completo de las subpestañas Diagnostico Funcional y Composición corporal para que compares datos con el html. Por otro lado, la subpestaña "Diagnostico Encuesta" está perfecta! y no necesita cotejo. Pero las otras 2 subpestañas si necesitan cotejo.

- Subpestaña Diagnostico Funcional:
10. ## PENDIENTE (2026-09-05)   ·   **Verificado que el formulario SÍ usa el helper** (`useFormToast` llama a `preservarScroll`), así que no quedó fuera. Y en el smoke del reemplazo apareció **un segundo formulario con el mismo síntoma y que también lo usa**: son dos ocurrencias, o sea un hueco del guard, no un cableado que falte. Necesita navegador para diagnosticarse; van juntos.
    El boton de agregar criterio en Criterio del profesional me vuelve a hacer scroll hacia arriba. Pensé que ya estaban solucionados todos los botones de este comportamiento.
11. **CERRADO (2026-09-05)**, y tu intuición del título estaba bien pero la conclusión era otra. **Verifiqué su archivo: "Diagnóstico Integrado ANI BIS-E" encabeza un panel de SOLO LECTURA con el texto que escribe la IA. No tiene campo para que el profesional escriba.** El nuestro es donde el profesional escribe. Así que ponerle SU título al nuestro diría que lo redactó la máquina, que es lo contrario de para lo que existe el bloque. **Van los dos**: el suyo de antetítulo (es el nombre de la sección en su modelo) y "Criterio del profesional" de título, con una insignia *"Lo escribes tú"*.
    **Y el diseño: el problema era el borde discontinuo.** El bloque iba con borde punteado de 2px sobre fondo teñido, y en el resto de la app un borde discontinuo significa *"aquí no hay nada todavía"*: se leía como zona de arrastre o maqueta sin terminar (tu "muy simple y extraño"). Ahora es una card de verdad, con franja de encabezado teñida (que es donde va la distinción respecto de la evidencia del motor, dicha con palabras y no con un borde que significa otra cosa), el historial **numerado** ("Criterio 1 de 2") y el compositor separado por una línea. Candado en `criterio-bloque.test.ts`.
11b. Tu reporte original: El diseño del bloque Criterio del Profesional está muy simple y extraño. Fijate las capturas de /Diseño objetivo a ver si podemos mejorarlo. Además pienso que debemos cambiarle el nombre al titulo o ponerlo de subtitulo, porque el html lo titula: "Diagnóstico Integrado ANI BIS-E"
12. ## URGENTE   ·   **RESPONDIDO, NO CONSTRUIDO (2026-09-05). Tiene razón el HTML, y no es discutible: Regla 0.** La diferencia no es de calidad del modelo, es que le pedimos cosas distintas. Nuestro prompt de sistema dice *"extensión máxima 120 palabras, uno o dos párrafos"* y le entrega un RESUMEN (estado EFR, lista de indicadores alterados, dominios, rutas): sin una sola cifra. El suyo le entrega el **esqueleto del DFI** (riesgo integrado, los 5 dominios con su severidad, su lectura y su evidencia), los indicadores **con sus cortes por sexo**, la composición completa y las respuestas crudas de la encuesta, y le exige **un párrafo por dominio, en orden fijo**, con reglas clínicas propias (la PABU se lee por DIRECCIÓN respecto de φ; si el IFC y el ángulo de fase discrepan prevalece el IFC; prohibido usar los cortes históricos únicos). Con esa entrada cualquier modelo escribe el texto largo; con la nuestra ninguno puede.
    **Por qué no lo porté de una, y qué decisión te queda en la mano:** son tres canales, no uno.
    (a) El **prompt de sistema** hay que versionarlo (regla dura 9) y además vive en BD (`ai_prompts`, editable desde /admin/ia), así que llevarlo a la nube pide **migración**, no `db:seed` (el seed no se corre contra la nube). Es el mismo bump de dos canales del LE8.
    (b) El **mensaje de usuario** pasa de 9 líneas a unas 60 variables que hoy no viajan: hay que traerlas del `enc` (respuestas de encuesta) y del crudo BIS, dos lectores que `generate-criterion` hoy no toca.
    (c) **Y hay una decisión que es tuya, no mía.** Su bloque abre con `Nombre: ...` y sigue con `Ocupación`, `Estado civil` y `Estrato`. **El nombre no va, sin discusión** (reglas duras 9 y 15: identificador directo, nunca al LLM), y su EJEMPLO dentro del prompt trae el nombre de un paciente real, así que ese ejemplo tampoco se porta tal cual. Ocupación, estado civil y estrato son **cuasi-identificadores**, y `DATA_GOVERNANCE` los admite *"solo si tienen valor clínico"*: en su modelo lo tienen, son la evidencia del dominio Epigenético-Contextual. **Mi recomendación: van, y se declara la divergencia del nombre.** Pero es tu llamada.
    **Tamaño: una tanda propia**, no un rato. No lo meto a medias dentro de esta etapa porque a medias es peor que como está: un prompt que pide cinco párrafos sin los datos para escribirlos produce cinco párrafos inventados.
    Tu pregunta original:
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

13. **CONTESTADO, con media construcción (2026-09-05).** Las dos preguntas por separado:
    **(a) ¿Puede borrar o corregir antes de aprobar? Hoy no, y es deliberado: el criterio es append-only** (cada uno se agrega, ninguno se reescribe), que es como se comporta un registro clínico. **Lo que sí era defecto es que eso estaba dicho a media pantalla del botón**, en el párrafo de arriba, y tu pregunta es la prueba de que ahí no se lee. Ahora lo dice **junto al botón**, que es donde se decide: *"Queda registrado y no se puede borrar. Si te equivocas, agrega uno nuevo: el último es el vigente."* Y el historial va numerado para que se vea que es una secuencia y cuál vino después. **Si aun así quieres poder borrar mientras no esté confirmado el diagnóstico, es una decisión tuya y la construyo**: pide un escritor propio y su registro de auditoría, no es una línea.
    **(b) ¿Queda interno o va a un reporte? Verificado en el código: es interno.** Los criterios solo los lee esta pantalla y el lector de auditoría de notas. **No van al reporte del paciente y no van al PDF.** La pantalla ya lo decía y es cierto.
    **Pero encontré algo que no preguntaste y creo que hay que decidir: tampoco van a la HISTORIA CLÍNICA.** La HC es el documento clínico (Resolución 1995) y hoy no lleva el criterio del profesional, o sea el único texto que el profesional escribe sobre el diagnóstico. **No lo agregué por mi cuenta** porque cambia qué contiene un documento clínico, y eso no lo decido yo. Va a tu mesa.
13b. Tu reporte original: Actualmente apenas le damos al botón "agregar criterio" nos genera guarda el criterio que pusimos. Pero que pasa si el profesional quier eliminar alguno antes de aprobar el diagnostico? que pasa si se equivocó y desea corregirlo? deberia de poder hacerlo si no se ha generado el diagnostico? por otro lado, que se hace con este criterio o diagnostico que coloca el profesional? queda como algo interno/privado en la propia evaluación y solo lo ve el profesional o es para mostrar en un reporte?

14. **CERRADO (2026-09-05): se queda, y se le quitaron dos tercios del texto.**
    **Por qué se queda:** son dos MOMENTOS distintos, no una repetición. En la subpestaña de la encuesta el profesional está mirando las respuestas y ve la equivocada; aquí está leyendo el diagnóstico y se da cuenta de que un dato no cuadra. Quitarlo obligaría a ir a buscarlo justo cuando surge la necesidad. Además está emparejado con confirmar, y esa card se llama *"Cierre del diagnóstico: dos caminos"*: quitar uno de los dos deja la card diciendo dos y mostrando uno.
    **Lo que sí sobraba era el texto.** Iban tres párrafos y dos eran la explicación del ALCANCE, que está **verbatim** en la pantalla de corrección, o sea a un clic de distancia. **Y uno era peor que redundante: explicaba que la medición se puede volver a importar "mientras no haya diagnóstico", y este bloque SOLO se muestra cuando ya lo hay**, así que describía un camino cerrado en el momento exacto de leerlo. Quedan dos líneas y el botón. Candado en `criterio-bloque.test.ts`, y el de `bis-import.test.ts` ajustó su ALCANCE (no su aserción) con la razón escrita al lado y una aserción nueva para que sacar un archivo de la lista no sea la puerta de atrás.
14b. Tu reporte original: Al final tenemos este bloque: "¿Un dato de la encuesta quedó mal?
Corrige la respuesta equivocada. Se genera una versión nueva del diagnóstico, el tratamiento y el reporte con el dato corregido; la versión actual no se borra, queda registrada como reemplazada.

Aquí corriges las respuestas de la encuesta. La medición del equipo (Biody) y la identidad del paciente no se corrigen aquí. Si importaste la medición del paciente equivocado, esa evaluación debe cerrarse y hacerse de nuevo con el archivo correcto; esa opción todavía no está disponible, escríbele a soporte.
Botón: "Corregir la evaluación"
" 
Hace sentido dejarlo o quitarlo? ya que esta misma opción está habilitada cuando voy a evaluación -> ver editar encuesta, y me aparece corregir encuesta. Entonces hace mucho sentido que esté aquí, pero si vale la pena dejarlo al final de la subpestaña diagnostico funcional?

15. ## URGENTE   ·   **CERRADO (2026-09-05)**, y eran dos cosas distintas.
    **(a) El tamaño y los rótulos borrosos.** El par de bandas de cada sector iba a cuerpo 6 con salto de línea 6, o sea **sin interlineado**: los dos renglones se tocaban y se leían como una palabra, que es exactamente lo que transcribiste ("FMI BajoFFMI Bajo"). Ahora el cuerpo sube a 8 y el salto a 9 y 11, el lienzo gana un margen propio (`PAD`) para que los tres renglones no queden a ras del borde, y el gráfico pasa de 44rem a **60rem**, que es el espacio que le da su archivo. La geometría **no** se toca: el `viewBox` conserva el sistema de coordenadas, así que ninguna celda ni el marcador cambian de sitio (el candado de geometría lo comprueba comparando coordenadas absolutas, y pasó sin tocarlo).
    **(b) La saturación, que era información REPETIDA de verdad.** Dentro de la misma card, el panel del estado del paciente traía los cinco textos del estado (enfermedades, mecanismos, biomarcadores, riesgos, nutracéuticos) y **dos centímetros más abajo estaban otra vez** en las seis tarjetas. Y la rejilla de tres líneas repetía otras dos filas de la tabla de siete: "Estado EFR N de 81" es su fila *Estado EFR*, y "Estado funcional bioeléctrico (IFC × IRC)" es su fila *Anillo (función-riesgo)*.
    **El reparto que queda**, que es la regla y no un recorte: el **panel** lleva la DEFINICIÓN del estado (número, ejes y la tabla de siete, todo derivable para cualquier celda) y las **tarjetas** llevan el CONTENIDO. La narrativa vuelve al panel solo cuando es una **referencia explorada**, porque de esa celda no hay tarjetas y es justo lo que se compara al explorar.
    **Lo que NO quité, y por qué:** el fenotipo MCCB (responde otra pregunta y no está en la tabla) y la línea del componente estructural sellado (es lo que quedó en `phenotype_id` de todos los diagnósticos emitidos; si desaparece, hay un dato en el registro que nadie puede ver). Esa línea sí se acortó: explicaba además cómo se compone el estado, que es lo que dicen las dos primeras filas de "Lectura de la Diana" a media pantalla.
    Candado en `diana-bloque-sin-repetir.test.ts` (6 casos). **No fija el ancho en rem**: una magnitud arbitraria se afloja el día que estorbe, así que lo que fija es la relación que estaba rota (el salto entre renglones tiene que superar el cuerpo de la letra).
    Tu reporte original:
Mejorar DIANA: Se ven algunas partes de textos como "FMI BajoFFMI Bajo E7" difuminados, ademas de que se ven muy pequeños y la DIANA tambien se ve pequeña. En el html ocupa mucho mas espacio. Entonces seria como aumentarle tamaño al grafico y a los textos de la diana. 
Por otro lado, veo ese bloque de la Diana muy saturado de información, revisa que información de esa se repite para ver si podemos eliminar. Ya que primero está la lectura de la diana. Luego el estado del paciente. Luego como indicadores sueltos. Luego las cards que dicen: "Enfermedades / Complicaciones probables", "Biomarcadores clave", etc.

16. **CERRADO (2026-09-05)**: eran seis cajas **idénticas** (mismo borde, mismo rótulo en versalitas, mismo cuerpo), y seis objetos iguales en rejilla no tienen jerarquía: se leían como una lista larga. Ahora cada una lleva **su propio icono** (corazón, ADN, matraz, alerta, píldora, fonendo), el rótulo va en su fila separada del cuerpo **por aire y no por otro borde** (anidar bordes es lo que hace que una caja signifique "es una caja"), el cuerpo lleva interlineado suelto porque son párrafos clínicos de varias líneas, y el "sin dato" va en cursiva apagada para que no compita con el texto que sí hay.
    **Y la sexta va en otra superficie** (fondo apagado, borde discontinuo): "Abordaje por profesión" es la única de las seis que no describe al paciente sino lo que **tú** haces con él. Superficie apagada y no color clínico, porque el color clínico significa un veredicto sobre una persona.
    Tu reporte original:
16b. Mejorar diseño de las cards del bloque de la Diana que dicen: "Enfermedades / Complicaciones probables", "Biomarcadores clave", etc.

- Subpestaña Composición corporal:

17. ## URGENTE (subido por Claude)   ·   **CERRADO (2026-09-05), en dos pasadas, y la primera estaba mal. Lo digo de frente porque importa cómo se llegó.**
    **La corrección:** tu diagnóstico era el bueno. **El defecto era el COLOR, no la graduación.** Su archivo SÍ gradúa la desviación en esa tabla, y su escalón "Desviación leve" va en **ámbar (#f59e0b)**; el nuestro tenía severidad 0, o sea **verde**. Eso es exactamente lo que reportaste. Ahora el color sale del hexadecimal de su archivo por el mismo camino que los quince clasificadores congelados, así que "leve" es ámbar y no se puede volver a elegir a mano.
    **Lo que hice mal en la primera pasada, y por qué:** encontré en su archivo la línea `icaBisClf = cPABU(t_pabu)` con la nota *"cICABIS eliminado, usar cPABU global"* al lado, la leí como "retiró el clasificador" y **retiré el nuestro**. El problema es que esa línea es de la **HISTORIA CLÍNICA** (L15425), no de la pantalla que tú estabas mirando. **Su archivo tiene DOS reglas, una por superficie:**
    · **Diagnóstico → Composición Corporal** (L14623): la fila usa `dICA`, un clasificador de MAGNITUD propio de esa tabla, con cinco escalones. Al lado, la fila PABU usa `dPABU` ("PABU bajo", también ámbar).
    · **Reporte / Historia Clínica** (L15425): ahí sí toma la del PABU, con su nota.
    Lo encontré haciendo el punto 9, con sus capturas al lado: en su captura de Composición Corporal se lee **"Desviación leve"** en ámbar, con todas las letras. **Un hallazgo sólido en el archivo equivocado se siente igual que uno correcto**, y el candado que escribí certificaba mi lectura en vez de su archivo. El de ahora cita la línea de donde sale cada regla y tiene un caso por superficie.
    **Lo que SÍ se queda de la primera pasada, porque era un hallazgo aparte y real:** la fila ICA-BIS del bloque de índices de la **historia clínica** no podía aparecer nunca, ni desviada ni no, porque el snapshot sella `classifications["ICA-BIS"] = null` y las severidades no emiten esa clave. Ahí sí manda la regla del PABU (L15425) y ahí sigue aplicada. Candado en `ica-bis-dos-reglas-por-superficie.test.ts` (8 casos).
    Tu observación original:  "ICA-BIS · Índice de Coherencia Áurea (BIS)	0,42	0 (coherencia)	0,4157	
Desviación leve" Ahi pone desviación leve con color verde, mientras que la PABU es color amarillo (practicamente ambos indicadores dicen lo mismo, por eso es raro que uno de color amarillo y otro verde), ademas el html lo pinta amarillo.

**Tratamiento**: 

18. **HECHO (2026-09-06). Cotejo bloque por bloque de las dos subpestañas contra sus capturas.** De aquí salieron los puntos 21, 22.3, 23, 24 y 25, que ya están cerrados arriba. Lo que queda es el inventario, para que sepas qué está y qué no.

    **Subpestaña "Rutas de atención derivadas del DFI" · su archivo tiene TRES secciones:**

    | Su bloque | Atlas |
    | --- | --- |
    | SECCIÓN 1 · Rutas de atención activadas (con Nutricional / Ejercicio / Seguimiento por ruta) | Está |
    | SECCIÓN 2 · Vitacellebis recomendado, con "Registrar despacho" | Está |
    | SECCIÓN 2b · **OTROS PRODUCTOS (LUVIA)** | **No está** (punto 20: construcción diferida, no hueco) |
    | SECCIÓN 3 · Remisiones, con su chip de obligatoria/recomendada | Está |
    | *(no lo tiene)* | **Resumen del diagnóstico**, que es nuestro (punto 19) |

    **Subpestaña Nutricionista · su archivo, en orden:**

    | Su bloque | Atlas |
    | --- | --- |
    | A · Resumen clínico | Está |
    | Meta terapéutica | Está |
    | Objetivo del tratamiento nutricional **+ los 4 campos** | Está, y los 4 campos **subieron aquí** (punto 21) |
    | Validación del plan · % cubrimiento e ICN | Está, **entre el objetivo y la fórmula**, como el suyo |
    | D · **Fórmula sintética** (12 campos) | Está, con su nombre (punto 23) y **los doce campos** (punto 22.4) |
    | Paneles de referencia de proteína y grasa | Está, con su forma (punto 22.3) |
    | Lista de intercambio U de A · ICBF 2025, con "Distribuir porciones" | Está, con su TOTAL completo (punto 24) |
    | Distribución por tiempos, con "Sugerir distribución" y el cuadre por fila | Está, con la columna de cuadre |
    | Tiempos de comida activos (6, con Merienda) | Está, los seis |
    | F · Menú semanal (opcional), con "Generar menú con IA" | Está la rejilla; **la IA hace otra cosa a propósito** (ver abajo) |

    **Lo que cambié de paso:** los dos botones de recálculo se llamaban *"Recalcular desde el objetivo"* y *"Recalcular desde el intercambio"*, que describen el **mecanismo**. Los suyos se llaman *"Distribuir porciones"* y *"Sugerir distribución"*, que dicen **qué pasa**. Adopto los suyos **conservando el "desde X"**, porque sin eso dos botones que recalculan cosas distintas se leen igual.

    **Las tres divergencias vivas, todas ya declaradas y ninguna nueva:**
    · **La IA del menú.** Él tiene *"Generar menú con IA"* (compone la semana); nosotros *"Proponer otra semana"* (determinista, del ciclo) + *"Adaptar a las restricciones"* (IA). **Es su propio cambio de contrato del 29 de agosto**: *"la IA ya no COMPONE menús, ADAPTA el ciclo"*. Lo nuestro sigue esa instrucción, no la contradice.
    · **Los tiempos activos van ANTES de la distribución**; él los pone después. Gobiernan el reparto, así que ponerlos después obliga a subir a corregir. Ya declarada.
    · **El "Resumen del diagnóstico" de rutas es nuestro** (punto 19).
18b. Tu petición original: De las pestañas que mas trabajo nos costó, adjunto las capturas del recorrido completo de ambas subpestañas.

- Subpestaña rutas de atención
19. **CONTESTADO (2026-09-06): es NUESTRO.** Verifiqué su subpestaña completa. Su "Rutas de atención derivadas del DFI" tiene **tres secciones y ninguna es un resumen del diagnóstico**: SECCIÓN 1 Rutas de atención activadas, SECCIÓN 2 Vitacellebis recomendado (con "Otros productos" al final) y SECCIÓN 3 Remisiones.
    **Lo que sí tiene es "A — RESUMEN CLÍNICO", pero en la OTRA subpestaña** (Nutricionista), encabezándola, y ahí Atlas también lo tiene. Así que en rutas es una adición nuestra. **No la retiro por iniciativa propia**: a diferencia de las guías dietarias, aquí el profesional llega desde otra pestaña y el resumen le ahorra volver. Queda declarado por si prefieres quitarlo; es retirar un componente.
19b. Tu pregunta original: nosotros tenemos "Resumen del diagnóstico" aquí porque fue una mejora de nosotros o de Gildardo?

20. **NO ES UN HUECO DEL COTEJO: es construcción diferida, y estaba declarado así antes de este cotejo** (`LANZAMIENTO.md`: *"Lo que NO es parte de este gate: LUVIA y los otros productos"*, y el plan completo en `PLAN_CONSIGNACION_TERCEROS.md`).
    **Cómo se ve en su archivo**, para que sepamos qué es lo que falta: bajo SECCIÓN 2, después de "Registrar despacho", un bloque **OTROS PRODUCTOS** con la nota *"No se indican por diagnóstico: el profesional los ofrece por criterio clínico. Se despachan con el mismo registro"*, y una tarjeta de LUVIA con casilla, dosis (*"1 scoop (15 g) en un vaso con agua · Polvo · 600 g"*), descripción, **alérgenos** (*"Contiene avena (gluten)"*) y su registro INVIMA y laboratorio.
    **Por qué no lo porto como display y ya:** la casilla participa del **despacho**, y ahí deja de ser pantalla. LUVIA viene **en consignación de un tercero** (Centro de Nutrición Integral Katherine Ruiz, 60 unidades, PVP 90.000), no de CNV. Despachar un producto ajeno sin el modelo de consignación crea inventario que **no concilia con el consignante**, y el reparto de la venta hoy se calcula UNA VEZ POR TRANSACCIÓN, no por producto. Además el contable exige **inventario por LOTE con vencimiento** (LUVIA lleva probióticos).
    **Es dinero y son tres partes**, todas en `PLAN_CONSIGNACION_TERCEROS.md`. Si quieres el bloque **solo informativo, sin casilla y sin despacho**, eso sí es chico y lo hago cuando digas: pero entonces hay que decidir de dónde sale la ficha del producto (hoy no hay catálogo donde ponerla).
20b. Tu reporte original: Nos falta el bloque de OTROS productos (LUVIA)

- Subpestaña Nutricionista
21. ## URGENTE   ·   **CERRADO (2026-09-06). Tenías razón, y la razón que diste es la buena.**
    Verifiqué su pantalla: los cuatro campos (objetivo, actividad, déficit y peso meta) están **dentro** del bloque "Objetivo del tratamiento nutricional", o sea **justo encima** de la validación, y en Atlas quedaban debajo de ella. Tu frase lo dice exacto: *"estos 4 campos cambian inmediatamente la tabla de abajo... si los dejamos donde están, se ignora casi por completo que esto afecta la funcionalidad de la tabla"*.
    **Y no hizo falta el botón de guardado aparte que ofreciste.** El problema no era el guardado, era el orden de la página: la tabla de validación **es de solo lectura** (se deriva en vivo, no persiste), así que se le pasa a la cadena y se renderiza **entre sus dos bloques**. Queda el orden de su archivo (objetivo con sus cuatro campos → validación → fórmula sintética) y **el formulario sigue siendo uno, con un solo botón**, que es lo que protege que los seis ajustes se escriban de golpe.
    Un cuidado que sí revisé: la tabla va **fuera** del `fieldset`, no dentro. Si fuera dentro, al sellar la prescripción se apagaría visualmente justo cuando más se consulta.
    Candados en `orden-plan-nutricional.test.ts` (ahora mide dónde se RENDERIZA, no dónde se llama) y `cadena-dos-bloques.test.ts`.
21b. Tu reporte original: Divergencia importante por parte de nosotros en Atlas:
Por qué no metemos el bloque "objetivo del plan" con los 4 campos: "Peso meta (kg), objetivo (kcal), PAL (factor) y Deficit (kcal) en el mismo bloque o junto a "Objetivo del tratamiento nutricional" asi como lo hace el html? asi tengamos que ponerle un botón de guardado solo para estos 4 campos, pero ese fue el orden que le dio Gildardo en el html, y la verdad hace mucho sentido, ya que estos 4 campos cambian inmediatamente la tabla de abajo que se llama: "Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)". Ya que si dejamos "objetivo del plan" con los 4 campos donde está, se ignora casi por completo que esto afecta la funcionalidad de la tabla.

22. ## URGENTE   ·   **22.1 y 22.2 CERRADOS (2026-09-05, en dos pasadas)**: eran UNO, y el fondo no era el rótulo sino el PLACEHOLDER. El campo del objetivo estaba vacío diciendo `modelo: 2377` y, dejándolo vacío, salía 2408: prometía una cifra y entregaba otra. Ahora el placeholder dice lo que de verdad se usa (2408 y 1751), la pantalla vuelve a tener UNA cifra por concepto como el HTML, y la distinción calculado/ajustado se conserva en el rótulo (*"recalculado con tus ajustes"* / *"fijado por ti"*), que no cuesta un segundo número. Candado en `cadena-dos-bloques.test.ts`. Detalle: El objetivo ahora dice de dónde sale mirando las cinco entradas que lo mueven (objetivo, déficit, PAL, GEB y peso meta), y cuando no coincide con el del modelo dice cuál era: *"2408 kcal · recalculado con tus ajustes · el modelo sugirió 2.377"*. Igual el GEB: *"1751 kcal (Mifflin · el modelo: 1729)"*. Y la vista previa deja de llamar "Objetivo del modelo" a una cifra que lleva los ajustes. Candado en `cadena-dos-bloques.test.ts`. **22.3 y 22.4 siguen abiertos**, van al final con el 23.
Diferencias que noté en cálculos/formas:
22. 1.  En el bloque "objetivo del plan" aparece esto: "2408 kcal sugeridos por el modelo" basciamente es lo mismo que aparece en el html. Pero lo que me causa intigra es por qué en campo "objetivo (kcal)" aparece como placeholder: "modelo: 2377", no deberia aparecer "modelo: 2408"?
22. 2. El GEB de Atlas segun el modelo es de: 1729 y del html: 1751 . Yo creo que es el mismo error del campo que pasó con kcal, ya que en el campo editable dice 1729 en Atlas, pero en la vista previa si dice 1751 como el html.
22. 3. **CERRADO (2026-09-06).** Tenías razón, y las dos formas en que lo dijiste (*"más completas y bonitas"* aquí, *"se ven como raras abajo"* en el 23) son **la misma queja**: el contenido no cabía. Iba como una cajita apretada debajo de un campo de un cuarto de ancho, con el porqué y la fuente exprimidos.
    **Ahora es el panel suyo**: ancho completo, con el nombre del macro, **lo prescrito junto a lo sugerido en la misma línea** (*"prescrito: 0.8 g/kg · sugerido 0.8–0.8 g/kg"*, que es la comparación que se viene a hacer y antes había que hacer de memoria), y cada condición en su renglón con su porqué y su fuente legibles.
    **Dos cosas suyas que NO porté, y las declaro:** (a) él pinta la proteína de morado y la grasa de verde azulado; dos tonos elegidos por macro es color decorativo en una pantalla clínica, donde el color significa un veredicto, así que los dos usan el acento de marca; (b) conservo **nuestro** aviso de "la cifra escrita queda fuera del rango", que su panel no tiene: informa sin corregir, que es lo único que su §5 del 27 de agosto permite.
22. 3b. Tu reporte original: El html marca las referencias de proteina y grasa mucho mejor que atlas
22. 4. **CERRADO SIN CONSTRUIR (2026-09-06): los doce campos suyos YA ESTÁN, todos. Lo que cambia es la disposición, no el contenido.** Los cotejé uno por uno:

    | Su campo | Dónde está en Atlas |
    | --- | --- |
    | GEB (kcal/día) | Campo editable "GEB (kcal)" + fila *Gasto energético basal (GEB)* |
    | Factor actividad (PAL) | Desplegable, arriba y en la fila *× Nivel de actividad física (PAL)* |
    | GET (kcal/día) | Fila *= Gasto energético total (GET)* |
    | Objetivo calórico (kcal/día) | Campo "Objetivo (kcal)" + fila *= Objetivo calórico* |
    | Peso de cálculo (kg) | Fila *Peso efectivo* (mismo dato, otro rótulo) |
    | Proteína g/kg | Campo "Proteína (g/kg)" + detalle de la fila de proteína |
    | Proteína total (g/día) | Fila *+ Proteína · N g* |
    | Proteína (kcal) | Detalle de esa fila |
    | Grasas (%) | Campo "Grasa (%)" + detalle |
    | Grasas (g/día) | Fila *+ Grasa · N g* |
    | CHO por diferencia (g/día) | Fila *+ Carbohidratos · N g*, con la etiqueta "calculado (residuo)" |
    | CHO (kcal) | Detalle de esa fila |

    **No falta ninguno. Y tenemos cuatro cosas que su lista no tiene:** el déficit como eslabón visible de la cuenta, la distinción entre el objetivo de la cadena y el que fija el profesional, la suma de los tres macros contra el objetivo (el cuadre), y el aviso cuando proteína y grasa se comen el objetivo entero.
    **Así que no adoptamos su lista: adoptamos su NOMBRE (punto 23) y conservamos nuestra disposición**, que es la que tú mismo dijiste que te parecía "muy brutal". Su tabla es una lista plana de doce filas; la nuestra es la misma información leída como una cuenta (peso → GEB → × PAL → = GET → − déficit → = objetivo → reparto → suma). La única diferencia real es "Peso de cálculo" vs "Peso efectivo", y ahí me quedo con el nuestro porque en Atlas ese peso puede ser el meta que fijó el profesional, y "de cálculo" sugiere que lo calculó el sistema.
22. 4b. Tu reporte original: La formula sintetica del html tiene estos campos (algunos editables y otros de visualización):

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


23. ## URGENTE   ·   **CERRADO (2026-09-06). Las tres cosas que pediste, y una no hizo falta construirla.**
    **(a) El título es el suyo.** El bloque se llama **"Fórmula sintética"**, como en el HTML, y *"Cómo se llega a ese objetivo"* baja a subtítulo en negrita. No se pierde: el nombre propio dice qué es, el subtítulo dice qué hace.
    **(b) "Adoptar los dos diseños": ya estaban los dos.** La *Cadena efectiva (vista previa)* **ES** su secuencia (GEB → × PAL → = GET → − déficit → = objetivo → reparto), leída como una cuenta en vez de como una lista. Lo verifiqué campo por campo en el 22.4: **sus doce campos están todos ahí**. Así que no había dos diseños que combinar, había uno con su nombre puesto.
    **(c) Las referencias de proteína y grasa: van abajo, no al lado, y te explico por qué no te hago caso en eso.** El porqué y la fuente de cada condición son dos líneas de texto; al lado de un campo numérico estrecho vuelven a no caber, que es exactamente el problema del que veníamos (*"se ven como raras abajo"* era el síntoma de que estaban apretadas, no de que estuvieran abajo). **Su archivo también las pone abajo, a ancho completo**, y ahí sí respiran. El cable entre el campo y su referencia deja de ser la cercanía y pasa a ser una frase debajo del campo: *"Tu decisión; la referencia va abajo"*, que es lo que hace su archivo. **Si al verlo prefieres el lado, se cambia**: es mover un componente.
23b. Tu reporte original: El bloque que se llama: "Cómo se llega a ese objetivo" Pienso que es mejor ponerle de titulo "Formula sintetica" como el html. Y el "como se llega a ese objetivo" que quede como subtitulo o rotulo marcado asi como el diseño de contratik tiene algunas cosas. 
Del mismo modo, me parece mucho mas facil de entender como lo presenta el html (GEB, PAL,GET, etc.), pero tambien me gustaria conservar "Cadena efectiva (vista previa)" como lo tiene Atlas, me parece muy brutal el diseño de previsualización de la calculadora. Hay forma de adoptar ambos diseños? inclusive de poner al lado de proteina y grasa las referencias? ya que se ven como raras abajo.

24. **CERRADO (2026-09-06).** Las tres cosas:
    **(a) Totales sin decimales**, como su tabla (él: TOTAL 30 · 2211 · 113 · 302 · 68). Las **filas** conservan su decimal, que es donde se aprecia el reparto de un alimento; el decimal en una suma de veinte términos solo añade ruido.
    **(b) El total de la columna "Porciones", que faltaba.** Iba dentro del `colSpan` del rótulo "Total", así que **la única columna sin suma era justo la que el profesional edita**. Ahora dice el tamaño del plan de un vistazo (30 porciones repartidas).
    **(c) El botón "Recalcular desde el objetivo".** Iba en `ghost`, o sea sin borde ni fondo, al lado de un "Guardar" con contorno: se leía como texto suelto. **Es el mismo defecto del selector de archivo del punto 7.** Ahora lleva contorno como todos los guardados del panel, y lo que lo distingue es un **icono** (flecha circular), no la ausencia de forma. El paso de confirmación cuando hay ajustes manuales no se toca.
24b. Tu reporte original: En la tabla: "Lista de intercambio U de A · ICBF 2025" el html pone los totales sin decimales y pone el total tambien de la columna "porciones". Del mismo modo, decoremos el botón "recalcular desde el objetivo" que se ve raro.

25. **HECHO A MEDIAS A PROPÓSITO (2026-09-06), y la mitad que no hice es la que importa.**
    **Lo que sí:** el **botón** sube al bloque de restricciones, como pediste, y dice *"Adaptar el menú a estas restricciones con IA"*. La acción es sobre lo que el profesional acaba de escribir, así que ahí pertenece.
    **Lo que no, y por qué:** la **lista de propuestas** se queda abajo. Los dos bloques no son del mismo tipo: el de restricciones es de **decisión** (lo que tú escribes) y el de propuestas es **derivado** (lo que el sistema produce), y esos dos niveles son con los que toda la app dice quién decidió qué. Meterlos en una caja haría que esa caja significara las dos cosas. Además las propuestas se leen al lado de la grilla que modifican. El bloque de abajo se renombra a **"Propuestas de la IA para el menú"**, que es lo que quedó siendo, y dice que el botón está arriba.
    **Y acercar el botón abrió un hazard que tuve que cerrar en el mismo cambio.** `generateMenuAction` lee las restricciones **de la base, no del formulario**. Con el botón a media pantalla, la distancia hacía de guarda; pegado al campo, escribes *"sin lactosa"*, pulsas adaptar, y la adaptación **ignora lo que acabas de escribir sin decírtelo**. Es la familia de "dos partes de la pantalla que leen fuentes distintas". Así que el botón **se apaga** mientras haya cambios sin guardar (incluida una restricción tecleada y todavía sin agregar) y dice por qué. Candado en `adaptar-menu-junto-a-restricciones.test.ts`.
25b. Tu propuesta original: Propuesta de que unifiquemos este bloque: "Adaptar el menú a las restricciones (IA)" al de "Restricciones alimentarias del profesional". Ya sea simplificando mucho colocando un botón al lado que diga "adaptar las restricciones al menú con ayuda de IA". Incluso creo que estos 2 bloques se podrian unir a un solo bloque del menú.

26. **HECHO (2026-09-06), con un cuidado que añadí.** Verifiqué las dos cosas antes de tocarlo: su archivo **no tiene** notas de tratamiento, y en Atlas esas notas **no viajan al reporte ni a la historia clínica** (solo las leen esta pantalla y los lectores de auditoría). Así que el campo se retira.
    **Lo que NO hice es quitar el bloque entero, y la razón importa:** hay profesionales que ya escribieron notas ahí. Si se retira la sección completa, ese texto **deja de existir para quien lo escribió** y solo queda alcanzable por un grant de administrador. Así que: **con notas guardadas** el bloque aparece en solo lectura y dice que ya no admite nuevas; **sin notas** (el caso normal, y el que vas a ver) no aparece nada.
    **La tabla, el servicio y la acción no se tocan**: devolver el campo es volver a montar un formulario. Misma disciplina con la que se retiraron las guías dietarias. La acción quedó declarada en `check-cables` con su razón, para que no se lea como un cable olvidado.
    **Tu idea grande (notas globales que se clasifiquen por la pestaña donde se escriben, y elegir en el reporte cuáles enviar) no la construí aquí**: es un bloque propio, con su decisión de qué se envía al paciente. Va al backlog.
    Un efecto lateral que vale la pena que sepas: el aviso *"no se editan ni se borran"* vivía en ese campo. Como el campo se fue, la garantía **se mudó** al criterio del profesional, que sigue siendo append-only y ahora lo dice junto a su botón (punto 13). El candado que la vigilaba apunta ahora ahí.
26b. Tu reporte original: Eliminar el bloque de notas de tratamiento. El html no lo tiene, y pienso que no sirve mucho. Yo sigo insistiendo en que debemos hacer el apartado de notas globales y que las mismas notas sean quienes clasifiquen si es una nota de tratamiento, de diagnostico, etc. (segun la pestaña en que el profesional colocó la nota) y que al final, en reportes, se pueda elegir si mandar o no. Pero de momento yo quitaria este bloque denotas de tratamiento.


**Seguimiento**: 

27. **VERIFICADO Y PROPUESTO, NO CONSTRUIDO (2026-09-06). Dos cosas, y la primera era la que me preocupaba.**
    **(a) La FECHA no es una divergencia: es el mismo cálculo.** Comparé los dos: él hace *"última medición + días de la frecuencia"*, y nosotros exactamente igual. La diferencia de las capturas es del dato, no de la fórmula: su Nico tiene la medición del **2026-09-04** (04/09 + 90 = 03/12, y muestra 04/12 por su zona horaria) y el nuestro la tiene del **2026-07-13** (13/07 + 90 = **11/10**). **Nuestro número es correcto.**
    Lo que sí quedó anotado de paso: si el profesional importa una medición tomada semanas antes, la fecha sugerida sale contada desde la toma y puede quedar **demasiado pronto**. Es de él y de nosotros por igual, y no lo cambio por mi cuenta: va a la ronda.
    **(b) Lo que SÍ nos falta son dos campos suyos, y son un cambio de esquema.** Su bloque tiene, además de la fecha: **"Frecuencia de seguimiento"** (texto editable, prellenado con la de la ruta) y **"Observaciones"** (textarea). Los dos se **persisten** en su lado (`frecuencia_seguimiento`, `notas_profesional`). En Atlas la frecuencia se **muestra** pero no se edita, y observaciones no existe.
    **No lo construyo sin tu visto bueno porque es una migración** sobre `treatments`, que es tabla ya migrada, y eso es un punto de parada del proceso. **Lo que costaría:** dos columnas nullables, dos campos en el bloque de próximo control y el guardado que ya existe para la fecha. **La pregunta que va contigo:** ¿la frecuencia editable **reemplaza** a la de la ruta para el paciente, o es solo una nota? Si reemplaza, hay que decidir si la fecha sugerida se recalcula con ella.
27b. Tu reporte original: Nosotros en la primera evaluación solo tenemos esto: "Próximo control
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

28. **HECHO EN PARTE, y separé lo que se podía de lo que no (2026-09-06).**
    **La tarjeta de capacitancia ahora aparece con UNA sola medición**, y tu párrafo es el argumento: **esa tarjeta no vive de la trayectoria, vive de la comparación contra la referencia poblacional** por sexo y década. Con una medición ya dice dónde está el paciente. Estaba escondida detrás del mismo gate que el radar, y eso era el defecto contrario al que solemos vigilar: no mostrar media información, sino no mostrar ninguna teniendo una lectura completa.
    **Y ahora escribe la fila entera, como la suya**: *"Referencia hombres 18-29 (n=503): P25 2,06 · mediana 2,40 · P75 2,82 nF. Última medición: 2,960 nF · Alta (P75-P95)"*. Antes solo decía la mediana; la mediana dice hacia dónde, los percentiles dicen cuánto margen hay, y el **n** es lo que separa una referencia de una cifra afirmada.
    **Lo que NO se muestra con una sola medición, y es correcto: la gráfica.** Una línea de un punto no traza nada. Se dice, en vez de dibujar un gráfico vacío.
    **Y el radar inicial-vs-última sigue esperando la segunda.** Su archivo lo dibuja igual, pero ahí compara la medición **contra sí misma**: el polígono sale idéntico en las dos capas y no informa de nada. Ese sí es un caso donde su pantalla muestra algo que no dice nada, y prefiero decir que falta la segunda. Queda declarado. Candado en `capacitancia.test.ts`.
28b. Tu reporte original: El html a pesar de ser la primera evaluación muestra un mapa de capacitancia y un radar y 2 mapas de adicionales. Nosotros solo mostramos esos mapas cuando hay otra evaluación. Algo para rescatar del html es este parrafo inicial que explica por qué tenerlo incluso en la primera evaluación: "⚡ Capacitancia de membrana (C) — parámetro de seguimiento
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

---

# ETAPA EVALUACIÓN · CERRADA (2026-09-05)

## Lo que quedó construido

| # | Qué se hizo |
| --- | --- |
| **3 + 5** | Eran uno. El default de pestaña lo decide la página: sin diagnóstico abre en Evaluación, con diagnóstico en Diagnóstico. Y el enlace de importar lleva `?etapa=evaluacion&ev=antropometria` explícito |
| **7** | El botón de archivo se ve (perfilado en azul de marca, con cursor) y debajo sale **"Archivo seleccionado: nombre"**. Arreglado en el primitivo `Input`: el otro input de archivo de la app tenía el mismo defecto |
| **1** | El contenedor gigante era `align-items: stretch`. Arreglado en las dos páginas públicas de encuesta |
| **8 · hidratación** | El corte pasa de 73 a **73,2**, que es su cifra. Ver abajo |

## Lo que NO se construyó, y por qué

### 2 · Corregir los datos personales del paciente

**Verificado: no existe el camino, tienes razón.** La caracterización (ascendencia, estrato, motivo) se
escribe **solo** por `intake-writer`, o sea únicamente cuando el paciente envía la encuesta. Y no hay
formulario de edición del paciente: `modules/patients/components` solo tiene la lista.

**No lo construyo ahora y no es por tamaño.** Corregir identidad (nombre, documento, celular) toca la
resolución de identidad, la auditoría clínica y, si cambia el documento, la relación con el
consentimiento firmado. Es un bloque con su propia decisión, no un formulario. **Va al backlog con esa
nota**, y conviene decidir dos cosas antes de construirlo: quién puede corregir qué, y qué queda
registrado del valor anterior.

### 4 · El peso meta y la fuerza prensil: SU archivo los tiene en Antropometría

**Verificado en su código, y lo dice él mismo:**

> *"Lo que el profesional escribe a mano en **Antropometría** (cintura, cadera, **dinamometría y peso
> meta**) se guarda por paciente en cuanto lo teclea."*

Y `pesoMeta` vive dentro de su `ModAntropometria`. Así que la respuesta a tu pregunta es: **allá**, con
la cintura y la cadera, que en Atlas ya están en esa subpestaña.

**Y nuestro propio comentario dejó la decisión para este momento:** *"dónde vive el campo en la interfaz
se decide en el cotejo visual, con su pantalla al lado"*.

**No es un movimiento gratis, y por eso no lo hice de paso.** Los dos campos comparten formulario y
**camino de guardado** con las condiciones de la toma (`bis-intake`). Moverlos exige un segundo escritor
contra la misma fila, con el cuidado de concurrencia que eso pide. Es del tamaño de una tanda, no de un
rato, y hacerlo a medias es justo el hazard documentado: **un campo que deja de viajar**.

**Mi recomendación: hacerlo, en su propia tanda.** Su sitio natural es Antropometría y él ya lo decidió.

### 6 · Re-subir el BIS o corregir las condiciones tras generar

**El criterio ya está decidido y es suyo:** el Biody del paciente equivocado **se cierra y se rehace**,
no se corrige. La pantalla ya lo dice con todas las letras y remite a soporte, y está en el BACKLOG como
bloque propio.

**Lo que sí queda abierto y no es lo mismo** es tu segunda mitad: corregir **peso, estatura o
condiciones** después de generar, que no implica un archivo equivocado sino un dato mal tecleado. Hoy la
única salida es la misma (cerrar y rehacer), y para un decimal de la cintura eso es desproporcionado.
**Va al backlog junto con el 2**: son la misma pregunta (qué se puede corregir después de sellar) sobre
dos datos distintos.

### 8 · El cotejo de Wang y Sarcopenia

**Los datos coinciden byte a byte.** Comparé las dos capturas fila por fila: ACT 44,66 · FFW 41,95 ·
hidratación 70,33 · proteína total 14,06 · PMA 11,85 · CMO 2,90 · mineral no óseo 0,61 · Re 627,30 ·
Ri 1306,40 · R inf 423,80 · C 2,96 · Fo 27,84 · Z5 594 · Z50 501 · Z200 451. **Todos idénticos.**

Tres diferencias, y las tres importan:

**(a) La hidratación tenía DOS referencias nuestras, y la de pantalla no era la suya. ARREGLADO.**
Su archivo muestra `73.20` con delta `-2.87`; el nuestro decía `73%` con delta `-2.67`. Y las dos cifras
estaban en casa: `hidSG_ref = 73.2` en el dato derivado y `cut: 73` en el display. Su respuesta del
17 de agosto lo cierra: *"la hidratación de 73,2 %... 73,2 + 19,4 + 5,6 + 1,2 = 99,4 %. Cítenlas como
reparto de Wang, no como constantes independientes"*. **El 73,2 no es redondeable: pertenece a un
conjunto que tiene que cerrar.** Un candado fijaba el 73 citando "§2/§3"; se corrigió con su fuente al
lado, no se relajó.

**(b) FALTA EL VEREDICTO DE SARCOPENIA, y es lo más serio de este punto.**
Su archivo cierra el bloque con un banner: **"Sin sarcopenia · Fuerza y masa muscular normales."**
Atlas muestra las tres tarjetas (fuerza prensil, ASMI, ángulo de fase) con sus etiquetas y **no muestra
la conclusión**. Es el criterio de "lo que él tiene y nosotros no": el profesional ve tres datos y tiene
que concluir él. **Lo subiría a la etapa de Diagnóstico como accionable.**

**(c) Le ponemos referencia al FFW y él no.**
Nosotros mostramos `48,55` con delta `-6,60`; su archivo pone un guion. Y esa referencia es **la misma
del ACT**, reutilizada (`FFW_ref = tbwR`). Puede ser defendible fisiológicamente, pero es nuestra y
produce un déficit de -6,60 que su archivo no afirma. Es "lo que tenemos y él no": **se defiende o se
retira**, y como es clínico, no lo decido yo.

---

## El recorrido del smoke de esta etapa

**Recorrido A · La pestaña que abre (3 y 5).**

1. Entra a un paciente **sin diagnóstico** desde `/pacientes/(id)` con "Ver resultados". **Tiene que
   abrir en Evaluación.**
2. Entra a uno **con diagnóstico**. **Tiene que abrir en Diagnóstico.**
3. Con `?etapa=diagnostico` en la URL, tiene que ir a Diagnóstico (esta es la trampa que apareció).
4. Guarda las condiciones del BIS y pulsa **"importar la medición en Antropometría y BIS"**. **Tiene que
   llevarte a Evaluación, subpestaña Antropometría y BIS**, no a Diagnóstico.

**Sería defecto si:** abre en Diagnóstico un paciente sin diagnóstico, o el enlace de importar sigue
aterrizando en Diagnóstico.

**Recorrido B · El selector de archivo (7).**

1. Ve a Antropometría y BIS de una evaluación sin medición.
2. Mira el botón **antes** de pulsarlo: tiene que verse como un botón (perfilado azul) y **cambiar el
   cursor** al pasar por encima.
3. Elige un archivo. Debajo tiene que salir **"Archivo seleccionado: nombre"**, con el nombre en negrita.

**Sería defecto si:** el botón sigue leyéndose como texto corrido, o el nombre no se distingue.

**Recorrido C · El mensaje corto de la encuesta (1).**

1. Completa una encuesta y **vuelve a abrir el mismo enlace**.
2. Tiene que salir "Encuesta completada" en una tarjeta **del tamaño del mensaje**, no en un recuadro
   vacío de una pantalla de alto.
3. Y con un enlace inválido, lo mismo.

**Recorrido D · La hidratación (8a).**

1. Antropometría y BIS, tabla de Wang, fila **"Hidratación sin grasa"**.
2. La referencia tiene que decir **73,2** y el delta **-2,87** para Nico (valor 70,33), igual que su
   archivo.

**Sería defecto si:** sigue diciendo 73 o -2,67.

---

# ETAPA DIAGNÓSTICO · CERRADA (2026-09-05)

Cerrados: **17** (en dos pasadas, la primera estaba mal), **15**, **16**, **11**, **13**, **14**, **9**.
Contestado sin construir: **12** (te queda una decisión). Sigue **PENDIENTE**: **10** (necesita navegador).

## El recorrido del smoke de esta etapa

**Recorrido A · La fila ICA-BIS (17).** Diagnóstico → Composición Corporal → tabla "Indicadores
ANI-BIS-E", fila **ICA-BIS**. El punto de color tiene que ser **ámbar**, no verde, y la etiqueta seguir
diciendo "Desviación leve". La fila **PABU** de arriba, también ámbar. **Sería defecto si** el punto de
ICA-BIS sigue verde, o si la etiqueta desapareció.

**Recorrido B · Los decimales y el signo (9).**
1. En esa misma tabla, **PABU** tiene que decir **1,2023** y **ICA-BIS 0,4157** (cuatro decimales, como
   su tabla). Antes decían 1,20 y 0,42.
2. Sube a Diagnóstico Funcional, tarjeta **Celular-Eléctrico**, chip del PABU. Tiene que decir
   **"desviación de φ +0,42"**, con signo **más**. Antes decía −0,42, contradiciendo a la tabla de abajo.
3. Al pie de la pantalla, la constelación tiene que decir **Motor anibise-1.3.1**. *(Era la versión de ese día; desde el 2026-09-06 el motor es `anibise-1.4.0`. Este recorrido queda como registro de un smoke ya pasado, no para repetirlo con la cifra vieja.)*

**Sería defecto si:** el chip y la fila siguen diciendo signos distintos, o el motor sigue en 1.3.0.

**Recorrido C · La Diana (15).**
1. Diagnóstico Funcional → bloque "Diana EFR BIS y detalle del estado". El gráfico tiene que verse
   **notablemente más grande** y los rótulos de sector (E1..E9) legibles: **"FMI Normal" y "FFMI Normal"
   en dos renglones separados**, no pegados.
2. Debajo del gráfico: escala de riesgo, "Lectura de la Diana" y la card **"Estado del paciente"**. Esa
   card tiene que traer el **#4**, los ejes y la **tabla de siete filas**, y **ya no** los párrafos de
   mecanismos, biomarcadores, riesgos ni nutracéuticos (esos están abajo, en las tarjetas).
3. Pulsa **"Explorar otros estados"** y haz clic en una celda. El panel de **referencia** que abre al lado
   **sí** tiene que traer esos párrafos: de esa celda no hay tarjetas.
4. Ya no debe aparecer la rejilla de tres líneas con "Estado EFR 4 de 81" y "Estado funcional
   bioeléctrico": eso ya está en la tabla de siete. **Sí** se queda el fenotipo MCCB.

**Recorrido D · Las seis tarjetas (16).** Debajo, las seis tarjetas tienen que verse **numeradas del 1 al
6**, cada una con **su propio icono**, y la sexta ("Abordaje por profesión") sobre **fondo apagado con
borde discontinuo**: es la única que no habla del paciente sino de lo que haces tú.

**Recorrido E · El criterio del profesional (11 y 13).**
1. Baja al bloque del criterio. Arriba, en pequeño, tiene que decir **"DIAGNÓSTICO INTEGRADO ANI BIS-E"**,
   debajo el título **"Criterio del profesional"** y a la derecha la insignia **"Lo escribes tú"**. Ya no
   tiene borde punteado.
2. Si ya hay criterios registrados, tienen que salir numerados (**"Criterio 1 de 2"**) con su fecha.
3. Junto al botón **"Agregar criterio"** tiene que leerse: *"Queda registrado y no se puede borrar. Si te
   equivocas, agrega uno nuevo: el último es el vigente."*

**Recorrido F · La entrada a corregir (14).** Al final de Diagnóstico Funcional, card "Cierre del
diagnóstico". El bloque "¿Un dato de la encuesta quedó mal?" tiene que tener **dos líneas y el botón**,
no tres párrafos, y **ya no** debe decir que la medición se puede reimportar (ese camino está cerrado
cuando ya hay diagnóstico, que es cuando aparece este bloque).

**Recorrido G · El aviso verde de la medición.** Evaluación → Antropometría y BIS, con medición
importada. El aviso **"Medición BIS importada"** tiene que verse **neutro** (gris), no verde: que un
archivo se haya importado es un estado de proceso, y el verde clínico significa un veredicto sobre el
paciente.

---

# ETAPA TRATAMIENTO · CERRADA (2026-09-06)

Cerrados: **18**, **19**, **20**, **21**, **22.3**, **22.4**, **23**, **24**, **25**, **26**, **28**.
**27 queda propuesto**: son dos columnas nuevas y una pregunta tuya (abajo).

## El recorrido del smoke de esta etapa

**Recorrido A · El orden de la pantalla del nutricionista (21 y 23).** Tratamiento → subpestaña de tu
profesión. De arriba abajo tiene que quedar así:

1. Resumen clínico y meta terapéutica.
2. **Objetivo del tratamiento nutricional.**
3. **"Objetivo del plan"** con los cuatro campos: peso meta, objetivo (kcal), PAL y déficit.
4. **"Validación del plan · % de cubrimiento e ICN"** (la tabla).
5. **"Fórmula sintética"**, y debajo del título, en negrita, *"Cómo se llega a ese objetivo"*.

**Sería defecto si:** la tabla de validación sigue **encima** de los cuatro campos, o si el bloque sigue
llamándose "Cómo se llega a ese objetivo" como título.

**Recorrido B · Que el guardado siga siendo uno (21).** Cambia el objetivo y el PAL, baja hasta el final
de la fórmula sintética y pulsa **"Guardar ajustes"**. **Tiene que guardar los dos**, aunque la tabla de
validación esté en medio. Es lo único que me preocupaba de mover el orden.

**Recorrido C · Las referencias de proteína y grasa (22.3).** En la fórmula sintética, debajo de la
*"Cadena efectiva (vista previa)"*, tienen que salir **dos paneles de ancho completo**: "PROTEÍNA ·
referencia según el diagnóstico" y "GRASA · ...", cada uno con **"prescrito: X"** y una insignia
**"sugerido A–B"** en la misma línea, y cada condición en su renglón con su porqué y su fuente. Los
campos de arriba tienen que decir *"Tu decisión; la referencia va abajo"*.

**Recorrido D · La tabla de intercambio (24).** Fila **TOTAL**: tiene que traer **el total de porciones**
(la columna que editas) y los macros **sin decimales**. Las filas de arriba **sí** conservan su decimal. Y
el botón **"Distribuir porciones desde el objetivo"** tiene que verse como botón, con su icono.

**Recorrido E · El botón de adaptar (25).** En **"Restricciones alimentarias del profesional"**, debajo
del botón de guardar, tiene que estar **"Adaptar el menú a estas restricciones con IA"**.
1. Escribe una restricción y **no la guardes**: el botón tiene que quedar **apagado**, con el aviso
   *"Guarda las restricciones primero: la IA lee las guardadas"*.
2. Guarda: el botón se enciende.
3. Las **propuestas** siguen saliendo más abajo, en **"Propuestas de la IA para el menú"**.

**Sería defecto si:** el botón se puede pulsar con cambios sin guardar (la adaptación ignoraría lo que
acabas de escribir, sin decirlo).

**Recorrido F · Las notas del tratamiento (26).** En un paciente **sin** notas, el bloque **no debe
aparecer**. En uno **con** notas (si lo hay), tiene que salir **"Notas del tratamiento (histórico)"**, con
lo escrito visible y **sin campo** para agregar.

**Recorrido G · La capacitancia en la primera consulta (28).** Un paciente con **una sola medición** →
pestaña Seguimiento. Ahora tiene que salir la tarjeta **"Capacitancia de membrana (C)"** con la línea
*"Referencia hombres 18-29 (n=503): P25 ... · mediana ... · P75 ... nF. Última medición: ... nF · ..."*,
**sin gráfica**, y debajo el aviso de que la comparación aparece con la segunda medición.

**Sería defecto si:** la tarjeta sigue sin aparecer, o si aparece una gráfica de un solo punto.

## Lo que necesito de ti para cerrar el 27

Su bloque de próximo control tiene **dos campos que no tenemos** y que él persiste: **"Frecuencia de
seguimiento"** (editable) y **"Observaciones"**. Son **dos columnas nuevas** en `treatments`, que es tabla
ya migrada, así que no las hago sin tu visto bueno. **La pregunta:** ¿la frecuencia editable **reemplaza**
a la de la ruta para ese paciente, o es solo una nota? Si reemplaza, hay que decidir si la fecha sugerida
se recalcula con ella.

---

# REAPERTURAS DEL SMOKE DE DIAGNÓSTICO (2026-09-06)

## 9 · Las cinco letras

**(a) El carácter de φ:** hecho, la referencia del PABU dice **φ = 1,618**.

**(b) y 17 · ¿"leve" es siempre ámbar? No, y la respuesta importa.** El color **no lo elige Atlas: sale
del hexadecimal que Gildardo escribió** en cada clasificador, y se traduce a la escala clínica por el
mismo camino para los quince. Así que depende del clasificador:

| Dónde | Qué dice | Color |
| --- | --- | --- |
| **ICA-BIS**, escalón *"Desviación leve"* | `#f59e0b` en su archivo | **Ámbar** |
| **IEHH**, escalón *"Leve"* | ámbar en su archivo | **Ámbar** |
| Cualquier escalón *"Zona φ"*, *"Normal"*, *"Óptimo"* | verde | **Verde** |

**La regla, que es la que hay que recordar: "leve" no es una palabra con color propio.** Un escalón se
pinta por el hex que él le puso, no por su etiqueta. Por eso el defecto del 17 era grave: nuestro
"Desviación leve" llevaba severidad **0** escrita a mano (verde), o sea que alguien había elegido el
color en vez de leerlo. Ahora sale del hex y no se puede volver a elegir.

**(c) Los decimales: tienes razón, revertido.** Volví a **dos**, y tu argumento es el bueno: su archivo
no tiene una regla de decimales, tiene la que quedó en cada sitio (2 en unos, 3 en otros, 4 en otros), y
copiarla importa su desorden. **Lo que sí era un defecto real y sigue cerrado** es que el mismo renglón
dijera 0,42 en el valor y 0,4157 en la Δ: se resolvió por el otro lado, bajando también la Δ a dos.
**Y te dejo lo que queda a la vista:** el IR y el IEHH tienen su Δ en **tres** decimales, y son
anteriores a este cotejo. No los toqué porque bajar el IR a dos convierte su Δ de 0,018 en **0,02**
contra un corte de 0,78, y eso es una decisión de display sobre una cifra clínica. **¿Los unifico?**

**(d) El corte por sexo: tienes razón y es más fuerte de lo que parecía.** No es que él nos autorizara a
divergir: **su propio clasificador congelado `cIFC` YA trae los cortes por sexo** (H 4,12/6,68 · M
2,08/3,28), y Atlas lo que hace es llamarlo. El 3,5-6,0 solo vive en su **tabla de display**, que no
llama a su propio clasificador. Así que **no hay divergencia nuestra** y el aviso sale del mensaje.

**Y el barrido que pediste está hecho: son SIETE, y el patrón es uno solo.** Está en `DIVERGENCIAS.md`,
sección *"NO SON DIVERGENCIAS"*. El patrón: **su archivo va por detrás de sus propias instrucciones.**
Tu memoria era buena, era la **hidratación**: su pantalla dice 73 y su instrucción del 17 de agosto dice
**73,2**, *"cítenlas como reparto de Wang"*, que no es redondeable porque el conjunto tiene que cerrar en
99,4 %. Los otros seis: el SMM/W de mujeres (22 y no 24, error de transcripción suyo), el FFW y el IEHH
(un defecto de su archivo que él corrigió y donde nuestros valores eran los buenos), el cPABU direccional,
la salvaguarda de TCA (su archivo todavía BLOQUEA y su instrucción dice avisar) y el interruptor del LE8.
**La señal para la próxima: cuando Atlas y el HTML no coincidan, la primera pregunta no es "¿en qué
divergimos?" sino "¿nos dijo él algo sobre esto?".**

**(e) El FFW: NO es un error portado, y lo verifiqué corriéndolo.** Candado nuevo
(`ffw-referencia-del-equipo.test.ts`) con los dos casos:
· **Con la columna del equipo** (`FFW_dif`, que el Biody sí exporta), la fila **sigue trayendo su
referencia medida**: en el donante de prueba, 47,125. Esa cifra es del equipo, no nuestra, y no se tocó.
· **Sin esa columna**, la celda queda vacía. **Lo que se retiró es la reserva que la rellenaba con la
referencia del AGUA CORPORAL TOTAL**, que es otra cantidad: para Nico daba 48,55 contra un FFW de 41,95,
o sea un déficit de **-6,60 que nadie mide**.
**O sea: la celda vacía no es una copia de su pantalla, es lo que queda cuando dejamos de escribir un
número que no existía.** Nico no trae esa columna; un paciente que la traiga verá su referencia.

## 10 · Por qué estaba pendiente, y qué hice ahora

**Estaba pendiente porque no sabía la causa**, y escribir un arreglo sin causa habría sido adivinar. Lo
que sí sabía: el formulario **sí** usa el helper (lo verifiqué), así que no era un cable que faltara.

**Ahora encontré algo concreto y lo cambié: el guard cancelaba con CUALQUIER tecla.** Se arma al guardar
y vigila tres segundos; en esos tres segundos cancelaba si el profesional pulsaba una tecla cualquiera.
**Y los dos formularios que siguen saltando son justo los dos donde se escribe justo después de
guardar.** Ahora solo cancelan las teclas que **mueven la página** (PageUp/PageDown, Home/End, flechas,
espacio) y solo con el foco **fuera** de un campo: escribir ya no desarma nada.

**Lo digo como es: es una hipótesis aplicada, no una causa confirmada.** Este defecto solo se ve en un
navegador real. Si tras esto sigue saltando, la causa es otra y el cambio se queda igual, porque
cancelar por teclear nunca fue lo que se quería. Candado en `preservar-scroll.test.ts`, con su control.

## 11 · ANI-BIS-E

**Hecho, en las siete superficies de Atlas.** Las que quedan están **dentro de las cadenas de su código
congelado** (el resumen clínico del protocolo y dos textos del motor nutricional), que no editamos por
la regla 16. Van en el mensaje que se le manda, como punto aparte.

## 13 · a) Manda el último criterio

**Hecho.** El último se rotula **"Criterio vigente"** en vez de deducirse de una lista numerada, y los
anteriores quedan **plegados** en un desplegable. **No los borré, y es la misma razón del punto 26:** son
append-only porque son registro clínico, y quien escribió uno tiene que poder releerlo. Lo que se decide
es cuál **manda**, no cuál **existe**.

## 15 · La Diana

**Encontré por qué "seguía casi igual", y no era el tamaño que puse.** La figura vivía dentro de un
contenedor centrado (`items-center`), y eso, en una columna, deja a los hijos **con el ancho de su
contenido**, no el del padre. Con la figura encogida, el límite de ancho del gráfico **no llegaba a
mandar nunca**: por eso subirlo de 44 a 60rem apenas movió nada. Arreglado en la figura y sus dos
contenedores, y **el límite sube a 76rem**. Ahora sí crece.

**Y el solape de tu captura:** el rótulo iba **centrado** en su punto, así que su mitad interior se metía
encima del anillo exterior, y peor en los sectores casi horizontales (E3 y E7), que son los de texto más
ancho. Ahora **crece hacia afuera**: a la derecha se ancla por la izquierda, a la izquierda por la
derecha, y arriba y abajo se queda centrado. El margen del lienzo sube para darle sitio. La geometría no
se toca. Candado sobre la **regla** (crecer hacia afuera), no sobre una distancia.

---

# SEGUNDO SMOKE (2026-09-06): lo que se reabrió y quedó cerrado

## 21b · La validación se recalcula EN VIVO

**Se hizo la (b), y no hizo falta partir el guardado.** La tabla de validación **no persiste nada**: se
deriva. Así que basta con darle los ajustes que hay **en pantalla** en vez de los guardados. Es una prop.
Sin escritor, sin firma, sin columna nueva, y el formulario sigue siendo uno con un solo botón.

**Y la tabla dice que está validando cifras sin guardar**, en un aviso de la capa de atención. La
distinción con el botón del punto 25 es la que dijiste: **aquel ACTÚA** (manda las restricciones
guardadas a la IA, y con las de pantalla mentiría) **y ésta PREVISUALIZA**. Lo que una previsualización
debe es decir que lo es.

### El hallazgo de `protKgVigente`: el número

**Importa hoy, y bastante.** La tabla llamaba al cálculo **sin** `protKgVigente` y la cadena **con** él.
Esa opción es la que decide, en los snapshots que **no** sellan `mtn.protKg` (anteriores al 3 de
septiembre), si la proteína sale **del motor** o **del mínimo poblacional**.

| Base | Tratamientos con snapshot | Sin `mtn.protKg` (la ventana) | De esos, sin ajuste manual |
| --- | --- | --- | --- |
| **Nube** | 26 | **21** | **19** |
| Local | 60 | 58 | 58 |

**O sea: en 19 de los 26 tratamientos de la nube, la tabla podía estar validando el plan contra una
proteína que el profesional no prescribió** (el mínimo poblacional en vez de la del motor). Es la misma
familia del aviso que la cadena ya trae para `protFuente === protMin`, pero silenciosa. Arreglado en el
mismo cambio: la tabla recibe las **mismas** opciones que la cadena, así que las dos cuentas ya no
pueden salir de fuentes distintas.

## 15 · La Diana, los tres ajustes

**(a)** De 60rem a **52rem**.

**(b) Los rótulos de anillo (A1-A9) se mudan a E9**, y lo **verifiqué en su código antes de moverlos**,
no en la captura: su v8 los dibuja con `x = CX − 4`, `y = CY − rr` y `text-anchor="end"`, o sea pegados
al eje vertical **por su lado izquierdo** y creciendo hacia afuera. Nosotros los poníamos en el centro
del primer sector (20°), que cae a la **derecha**. Tenías razón.

**(c) Los rótulos de sector, más pequeños.** Su archivo los pone a 9,5 y 5,8 sobre un lienzo de **660**
unidades; el nuestro mide **408**, así que en proporción los nuestros iban al doble. Bajan a 8 y 6,5:
legibles sin competir con el dibujo, que es lo que se mira primero.

## 26 · Las notas de prueba, borradas

**Seis en local y tres en la nube.** Las tres de la nube se listaron antes de tocarlas y se borraron una
a una, con verificación de que quedaba cero. Ninguna era real.

## 23 · El subtítulo, como rótulo

Iba pegado a la explicación en el mismo párrafo (*"Cómo se llega a ese objetivo. Ajusta cualquier
eslabón..."*), y así no es un subtítulo, es una frase más. Va **encima** del título, en versalitas.

## El recorrido del smoke de esta tanda

**A · La validación en vivo (21b).** Tratamiento → subpestaña de tu profesión.
1. Cambia el **objetivo (kcal)** en "Objetivo del plan". **La tabla de validación de abajo tiene que
   moverse al instante**, sin bajar a guardar.
2. Y encima de la tabla tiene que salir el aviso ámbar: *"se está recalculando con los valores que
   acabas de escribir, todavía sin guardar"*.
3. Pulsa **Guardar ajustes**: el aviso desaparece y los números se quedan.
**Sería defecto si:** la tabla no se mueve hasta guardar, o si se mueve **sin** avisar.

**B · La Diana (15).** Diagnóstico Funcional → bloque de la Diana.
1. Tiene que verse **más pequeña** que en tu última captura.
2. Los **A1-A9** tienen que estar a la **izquierda** del eje vertical (en E9), no a la derecha.
3. Los rótulos de sector, **más discretos**, y **E5** con aire respecto del anillo.

**C · Los decimales.** Diagnóstico → Composición Corporal, tabla de índices: **PABU con tres** decimales
(1,202), **ICA-BIS con dos** (0,42), **IEHH con dos**. Y en la **historia clínica**, los valores con
**coma**, no con punto.

**D · Las notas.** Tratamiento: el bloque de notas **no debe aparecer** (ya no hay ninguna, ni local ni
en la nube).

---

# ETAPA SEGUIMIENTO · CERRADA (2026-09-06)

Sus dos puntos (**27** y **28**) ya estaban resueltos arriba. Lo que quedaba era el **cotejo bloque por
bloque de la pestaña**, y salió una cosa: **el bloque entero estaba escondido hasta la segunda medición**,
y no todo lo que contiene necesita dos.

## El cotejo, bloque por bloque

| Su bloque | Atlas |
| --- | --- |
| Capacitancia de membrana (C), con su referencia y su gráfica | **Está**, y ahora **desde la primera medición** |
| Diagnóstico Funcional · Inicial vs Última (radar) | Está, **con dos o más** (correcto, ver abajo) |
| φ Convergencia bioeléctrica · PABU e ICA-BIS | **Estaba construido y no se veía**: escondido tras el mismo gate |
| Próximo control, con criterio de egreso y fecha | Está. Le faltan sus dos campos (punto 27) |

## La regla que salió de aquí, y corrige lo que yo mismo escribí el 05

**Un gráfico con LÍNEA DE REFERENCIA dice algo con un solo punto: dónde está el paciente respecto del
objetivo. El radar no, porque allí la referencia es la OTRA medición y con una sola se compara consigo
misma.**

El 5 de septiembre escondí la gráfica de capacitancia con un punto, razonando que *"una línea de un punto
no traza nada"*. **Es verdad de una línea suelta y falso en cuanto hay una referencia**: el punto contra
la mediana de su grupo es exactamente lo que la tarjeta viene a decir. Su archivo la dibuja igual.

**Las tres gráficas de esa pantalla llevan referencia** (la capacitancia contra la mediana de su grupo,
la PABU contra φ = 1,618 y el ICA-BIS contra 0), así que **las tres se dibujan desde la primera
consulta**. El radar sigue esperando la segunda. Y el aviso de que falta la segunda va **debajo** del
bloque, no en su lugar.

**Lo que esto destapa, y es lo de fondo:** el bloque de convergencia estaba **construido, portado y
probado**, y en una primera consulta **no se veía nunca**. Es la familia de la pieza a la que le falta el
último cable, con la diferencia de que aquí el cable estaba puesto y lo tapaba una condición de más.

## El recorrido del smoke de esta etapa

**Un paciente con UNA sola medición** → pestaña Seguimiento. Tienen que salir, en este orden:
1. **Capacitancia de membrana (C)**: el párrafo del protocolo, la línea *"Referencia hombres 18-29
   (n=503): P25 ... · mediana ... · P75 ... nF. Última medición: ... nF · ..."*, **la gráfica con su
   punto y la línea de la mediana**, y debajo *"con una sola medición lo que se lee es la posición"*.
2. **Convergencia bioeléctrica**: los dos gráficos, PABU con su línea en φ = 1,618 e ICA-BIS con la suya
   en 0, cada uno con su punto.
3. **NO** el radar inicial-vs-última.
4. El aviso de que falta la segunda medición, **debajo**, con la fecha que correspondería.
5. **Próximo control**.

**Sería defecto si:** el bloque de convergencia sigue sin aparecer, o si sale el radar comparando la
medición contra sí misma.

**Con DOS o más mediciones** todo lo anterior sigue igual, aparece el radar, y desaparece el aviso.

---

# 30 · El cotejo bloque por bloque de Reporte/HC (2026-09-06)

**Método:** las cuatro capturas de su HTML contra las seis de Atlas, y cada divergencia verificada en su
archivo antes de escribirla. Lo que salió se parte en dos: lo que **cerré** (porte o defecto nuestro, sin
decisión que tomar) y lo que **queda abierto** (cambia el significado del documento, o es pregunta para
Gildardo).

## CERRADO · tres cosas, commit `4d3db95`

**a) La actividad física iba como factor crudo.** Decíamos *"PAL 1.375"*; su HC dice *"FA ligera"* y el
panel donde el profesional lo **elige** dice *"Ligera (1.375)"*. Un documento probatorio registra la
decisión con las palabras con las que se tomó. La escala de cinco niveles pasa del panel al módulo
**neutro**, porque la necesitan el cliente y el servidor.

**b) El sodio ausente decía "No se registró", y no es eso.** El motor solo prescribe límite de sodio
cuando hay condición que lo pida (HTA, ERC, alteración hídrica). *"No se registró"* acusa al profesional
de un olvido que no hubo. Ahora dice **"No aplica"**. Y el **PDF omitía la fila entera** cuando no había
límite: los dos documentos del mismo acto decían cosas distintas.

**c) Los antecedentes cierran con alergias**, como en su archivo. Iban terceras.

**Y una razón escrita que era media verdad.** El comentario del bloque de remisiones decía que los
exámenes solicitados no son sección aparte porque viajan dentro de la frase de la remisión, *"como en su
HC"*. Su HC tiene **las dos cosas**: los estudios en la frase (12b) y un bloque *"EXÁMENES SOLICITADOS"*
aparte (12c). Lo que sí cierra la pregunta es otra cosa: **ese bloque suyo nunca se dibuja.** Su fuente es
`localStorage['atlas:examenes_sel:<doc>']`, que su archivo **lee** en una línea (v8 L15242) y **no escribe
en ninguna**, así que la guarda `> 0` nunca pasa. No falta nada, pero por un motivo distinto del escrito.

## ABIERTO · seis, sin construir

**1 · El orden de los bloques.** En su HC la **composición corporal va cuarta**, justo tras los
antecedentes y **antes** de los tres párrafos interpretativos; y las **rutas activadas van justo después
del objetivo del tratamiento**, antes del plan. En Atlas la composición va séptima (después de la meta) y
las rutas van al final, tras las remisiones. Su orden tiene una lógica de lectura: el dato objetivo antes
de su interpretación, y la ruta antes del plan que la ruta justifica.

**2 · Las remisiones de la HC salen de sitios distintos, y esta es la importante.** En su archivo se
**derivan de las rutas activas** (`rutasActivas` → `componentes.{medico,psicologico,ejercicio}.remision`),
con su urgencia y sus indicaciones redactadas en una frase. En Atlas la HC lee solo
`listReferralsForTreatment`, o sea **lo que el profesional registró**. Mismo paciente, misma ruta R4
activa: su HC muestra dos remisiones (una marcada **OBLIGATORIA**) y la nuestra dice *"No se registraron
remisiones ni derivaciones en esta consulta"*.

Atlas **sí tiene** la derivación (`buildRemisiones` + `consolidateRemisiones`), pero renderizada en la
pestaña de **Diagnóstico**, que es donde el profesional las registra. Lo que falta es que la historia
clínica diga las dos: **lo que el modelo exigió** (derivado) y **lo que el profesional registró**
(registro). Es justo la doctrina de los tres niveles de bloque. No lo construyo sin tu go porque cambia el
contenido de un documento probatorio.

**3 · La referencia del % de grasa no coincide, y es clínico.** Su tabla de la HC:
`% Grasa · H:8-19.9% / M:21-32.9% · 22.4% · **Límite**`. La nuestra:
`Grasa corporal total - Lípidos Wang (%) · 22,44 · **10-22%** · **Sobrepeso adiposo**`. Mismo valor, otra
referencia y otro veredicto. Su tabla de la HC clasifica con un clasificador **inline** (déficit <8,
normal <20, límite <25, obesidad ≥25 en hombres), no con `cFMI`. Va a la ronda de Gildardo: cuál manda.

**4 · Los decimales del IMC.** Él 25.7 (uno), nosotros 25,66 (dos), contra una referencia escrita
`18,5-24,9`. Por nuestra propia regla (*"los decimales los fija el CORTE"*, BRAND.md) el IMC debería ir a
uno. Hay que revisar que la regla alcance también a la capa de display de la composición, que es otra.

**5 · El PBI.** Su HC imprime, junto al fenotipo, *"PBI: Riesgo celular"*. En Atlas declaramos en B11 que
`F1-F12/PBI/EIEC` son de una versión anterior del modelo y que la taxonomía real manda. Su archivo del 4
de septiembre lo sigue imprimiendo. Pregunta para él, no cosa nuestra.

**6 · Los antecedentes en dos columnas.** Su bloque va en rejilla de dos; el nuestro en una sola, lo que
alarga bastante el documento. Es puro layout.

## Lo que Atlas tiene y él no, y está bien

**Observaciones del profesional**, **autorizaciones bajo las que se recogió la información** (el sello de
consentimiento con su versión: es la mitad legal del derecho de acceso) y **Cerrar la consulta** (que es
operativo, no historia clínica). Y donde su archivo imprime `Otro` a secas, nosotros resolvemos el texto
libre (`Otro: Test Atlas`, `Otra: Mantequilla`), que dice más.

## 30 · Resolución de las seis abiertas (Santiago, 2026-09-06)

**Tres van, tres no.** Commit `b9a6962`.

**1 · Remisiones · CERRADO.** La HC dice ahora **las dos cosas**: *"Lo que el modelo exigió"* (derivado de
las rutas activas, con su urgencia verbatim y un estado **Registrada / Sin registrar**) y *"Lo que el
profesional registró"*. El cruce es **por destinatario** (`referralTarget` contra `referredTo`), que es
como está construido el registro D-009; un cruce por la frase se desincronizaría en cuanto una indicación
cambiara de redacción. Un solo helper puro (`remisionesExigidas`) para la pantalla y el PDF.

**2 · Decimales del IMC · CERRADO.** `RowOpts` gana `decimals` y el IMC declara **1**, que es la
resolución de su corte 18,5-24,9. La regla vivía en `indicator-ranges` (los doce ANI) y esta tabla es la
**otra** capa de display, que no la aplicaba.

**3 · Orden de bloques · CERRADO, y era solo mover.** Ninguno depende de otro: todos se computan antes del
render. La **composición** sube a antes de los tres párrafos; las **rutas** suben a justo después del
objetivo. En la pantalla **y** en el PDF, que además diferían entre sí en las rutas.

**4 · Referencia del % de grasa · a la ronda de Gildardo.** Es su cifra.

**5 · PBI · se queda retirado, y la decisión sigue vigente.** Verificado: está en `CLINICAL_ENGINE.md`,
`DATABASE.md`, `registry-data.ts` y `types.ts`, y `estadoPBI` sólo sobrevive en un fixture de la era stub.
Y hay una **segunda razón independiente**, medida el 2026-08-02: su `estadoPBI` es AF×IR con un **tercer
umbral de AF** (6,80 / 6,30) que **contradice el `cAF` (6,5)** que Atlas ya muestra en Diagnóstico.
**La divergencia no estaba anotada**; queda en `DIVERGENCIAS.md` con las dos razones y con la pregunta de
cuál umbral mandaría si volviera.

**6 · Antecedentes en dos columnas · al pase de diseño de los documentos.**

### Y lo que salió al aplicar la regla de los decimales

Al arreglar el IMC barrí la tabla entera contra sus cortes. **Hay un caso que no es cosmético:** el **AF**
se muestra con **dos** decimales en la tabla de composición, y `indicator-ranges` dice **uno**
(`DECIMALES_INDICADOR.AF = 1`, instrucción suya D-016). Son **nuestras dos capas de display discrepando
sobre el mismo indicador**, no una diferencia con su archivo.

El resto son filas cuyo corte tiene menos decimales que el valor (cintura 94, FFMI 17-25, SMM/W 27,
%grasa 22, ACT/MLG 71-74, AEC% 35-40), pero ahí bajar a la resolución del corte perdería información real
(un FFMI sin decimales no sirve). **La regla del corte pone un techo, no un objetivo**, y conviene decirlo
así en `BRAND.md` antes de aplicarla en bloque. No toqué ninguna: va como pregunta.

---

# El recorrido del smoke de Reporte/HC (2026-09-06)

**Una evaluación con diagnóstico confirmado y tratamiento guardado, pestaña Reporte / HC.**

### A · El orden de los bloques, que es lo que cambió

Baja de arriba abajo y comprueba que van **en este orden**, que es el de su historia clínica:

1. Datos del paciente
2. Motivo de consulta
3. Antecedentes personales
4. **Composición corporal · índices alterados** ← subió: antes iba después de la meta
5. Resumen diagnóstico · Nutricionista
6. Diagnóstico funcional integrado (DFI)
7. Meta terapéutica
8. Objetivo del tratamiento
9. **Rutas de intervención activadas** ← subió: antes iba al final, tras las remisiones
10. Tratamiento · Plan nutricional
11. Recomendaciones
12. Remisiones y derivaciones
13. Observaciones del profesional · Próxima consulta · Autorizaciones · Firma

**Sería defecto si:** la composición sigue debajo de la meta, o las rutas siguen después de las remisiones.

### B · Las remisiones, que es lo grave que se cerró

En **Remisiones y derivaciones** tienen que salir **dos bloques rotulados**:

- **"Lo que el modelo exigió"**, con una tarjeta por destinatario, su **urgencia verbatim** (la
  *OBLIGATORIA* resaltada) y un estado **Registrada** o **Sin registrar**.
- **"Lo que el profesional registró"**, con las tarjetas de siempre (fecha y retorno).

**Comprueba el cruce:** registra una remisión al **médico** desde Diagnóstico y vuelve. La tarjeta del
médico tiene que pasar a **Registrada** y la del entrenador **seguir en Sin registrar**.

**Sería defecto si:** dice *"No se registraron remisiones ni derivaciones"* con una ruta activa que remite,
o si al registrar una se marcan todas.

### C · Los tres arreglos del cotejo

- **Actividad física** dice el **nombre del nivel** (*"Ligera (1.375)"*), no *"PAL 1.375"*.
- **Sodio**, cuando el paciente no tiene HTA ni ERC ni alteración hídrica, dice **"No aplica"** y **no**
  *"No se registró"*.
- **Antecedentes** cierran con **Alergias e intolerancias** (después de quirúrgicos y contaminantes).

### D · Los decimales

- **IMC** con **un** decimal (25,7), no dos.
- **AF** con **un** decimal, **IR** con **tres**, en la tabla de composición **y** en la de índices ANI.
  Los dos sitios tienen que decir lo mismo.

### E · El PDF, que es la otra mitad

Pulsa **"Imprimir o guardar PDF"** y comprueba **sobre el PDF**, no sobre la pantalla:

- El **mismo orden** de A.
- Las **dos listas** de remisiones de B.
- **Sodio: No aplica** (antes la fila desaparecía entera).

**Sería defecto si:** el PDF y la pantalla difieren en cualquiera de los tres. Es el defecto que ya nos
pasó tres veces en este documento.

---

# Estado del cotejo completo (30 puntos, cierre 2026-09-06)

## CERRADO · 24

1, 3, 5, 7, 9 (a-e), 11, 13, 14, 15, 16, 17, 18, 19, 21, 22.1, 22.2, 22.3, 22.4, 23, 24, 26, 27, 29, 30.

Y **cerrados en parte, con la mitad que falta declarada**: **6** (se puede reimportar antes del
diagnóstico; corregir *después* sigue abierto), **25** (el botón se movió; unir los dos bloques no se hizo
y la razón está escrita), **28** (la tarjeta de capacitancia ya sale con una medición; el radar espera la
segunda, que es correcto).

## PENDIENTE · 5, y ninguno es un hueco del cotejo

| # | Qué falta | Por qué no se hizo |
| --- | --- | --- |
| **2** | Corregir los datos personales del paciente | No hay camino y no es un formulario: toca resolución de identidad, auditoría y consentimiento. Hay que decidir **quién corrige qué** y **qué queda del valor anterior** |
| **6** (2ª mitad) | Corregir medición o condiciones **después** de generar | La salida diseñada es el reinicio de la evaluación, medido y sin construir |
| **10** | El scroll que salta | **Necesita navegador.** Verificado que el formulario SÍ usa el helper, y apareció un segundo caso igual: es un hueco del guard, no un cable que falte |
| **12** | El borrador de IA largo | **Respondido, no construido.** Tiene razón el HTML. Va con su tanda, y depende de la respuesta de Gildardo sobre cómo abrir sin el nombre |
| **20** | LUVIA y otros productos | **Construcción diferida declarada antes de este cotejo** (`LANZAMIENTO.md`, `PLAN_CONSIGNACION_TERCEROS.md`) |

## A GILDARDO · 8

El **punto 0** (el nombre de una persona en el ejemplo de su prompt, que viaja al proveedor de IA en cada
llamada) más siete preguntas. Todas redactadas en `GILDARDO_QUERIES.md`, sección *"Mensaje pendiente de
enviar"*, y en la tabla de `PENDIENTES_CIENTIFICOS.md` §6. La que salió del punto 30 es la **7**: su
historia clínica y su tabla de composición clasifican el **% de grasa** con cortes distintos.

---

# El cotejo queda CERRADO (2026-09-06)

Smoke pasado y push hecho.

**Lo que sigue vivo se mudó, para no releer este documento:**

| Qué | Dónde |
| --- | --- |
| Lo que queda **nuestro** (los puntos 2, 6-2ª mitad, 10, 12 y 20) y lo que viene después | `BACKLOG.md`, sección *"Lo que queda nuestro al cerrar el cotejo"* |
| Lo que va **a Gildardo** (el aviso del nombre, catorce preguntas y quince divergencias declaradas) | `PENDIENTES_CIENTIFICOS.md`, que ahora es **el documento único** que él recibe |

**Este archivo queda como registro**: los 30 puntos con lo que se encontró, lo que se decidió y por qué. No se le añade nada nuevo.
