# Divergencias: qué hace Atlas distinto del prototipo de Gildardo, y por qué

**Qué es.** La lista única de los puntos donde Atlas se aparta DELIBERADAMENTE del archivo prototipo de Gildardo (`ATLAS_v7.html` vigente). Responde la pregunta que se hace muchas veces: "¿por qué Atlas hace esto distinto de su prototipo?". Cada divergencia es intencional y autorizada (por su instrucción escrita o por una regla del proyecto), NO un error de port. Los errores de port se corrigen; las divergencias se conservan y se justifican aquí.

**Cómo se relaciona con el resto.** Cada divergencia apunta a la decisión que la autoriza (`D-NNN` en `DECISIONES_ANIBISE.md`) o a la regla de arquitectura. Este documento es una VISTA (junta lo que en el consolidado vive como campo "Divergencia" por decisión); la autoridad está en la decisión, aquí está la lista para encontrarlas.

---

## Ciencia congelada (frozen)

**DIV-1 · El examen de telómeros/estrés oxidativo se RETIRÓ del listado de exámenes sugeridos.**
- El prototipo lo incluye (cuando IAE > 5); Atlas (el artefacto que corre) no.
- Por qué: instrucción escrita de Gildardo (2026-08-03): no es examen de laboratorio estándar y citaba el propio modelo como referencia. Ver **D-012 / CA-1**.
- Cómo: por el mecanismo de modificaciones autorizadas (el original queda byte-idéntico; el generado lo omite). El manifiesto `frozen/authorized-modifications.js` tiene la instrucción verbatim.

**DIV-2 · RETIRADA el 2026-09-05: el mapeo del ICEC ya está ENCENDIDO y Atlas coincide con su archivo.**
Se conserva el texto porque explica por qué estuvo apagado cinco semanas y qué costó destrabarlo.
- Su archivo del 4 de septiembre trae el interruptor ENCENDIDO (`const LE8_MAPEO_CORREGIDO = true;`, L8104); Atlas lo mantiene apagado.
- Por qué: su propio comentario, en la línea de arriba del interruptor, advierte que para ponerlo en `true` hacen falta las dos cosas a la vez, y que "mientras no exista [la recalibración de μ y σ], esta bandera se queda en false". Es la excepción a la regla de autoridad: el archivo advierte contra su propia línea. Ver **D-006 / P-01**.
- **ACTUALIZADO 2026-09-05: las otras dos razones ya NO aplican.** Cuando se escribió esto, además faltaban C9 (`calcPatron`) y la captura de `d7_agua`; los dos existen hoy (`clinical-engine/patron.ts` y la pregunta de agua en la encuesta). **Así que la divergencia se sostiene sobre una sola pata: la recalibración de μ y σ, que es un cálculo sobre los registros de CNV y solo él puede autorizar.** Si contesta que se enciende, no hay nada más que construir antes.
- **Alcance de lo que mueve el interruptor** (importa para el cotejo, ver `COTEJOS_VISUALES.md` d-bis): ICEC/LE8 total, EB-BIS, IAE, los dominios 3 y 5 del DFI con su severidad, y las rutas R4 y R5.
- **PORTADA (2026-09-05), no solo decidida.** `LE8_MAPEO_CORREGIDO` está en `true` en el generado, por CA-8a/CA-8b del manifiesto; el original sigue byte-idéntico. Ver `PLAN_LE8_ENCENDIDO.md` con las cifras medidas.
- **Contexto de la decisión (2026-09-05).** Contestó que el ICEC *"se activa tal cual se envió"*: la nota del 30 de agosto era prudencial, se escribió sin analizar un caso, y quedó superada por la medición del 2 de septiembre. **Su `true` es la directriz vigente**, así que esto ya no es una decisión nuestra de apartarnos de su archivo: es trabajo nuestro sin hacer. Se queda escrito aquí, y no se borra, hasta que el porte entre. Lo que cuesta y por qué no es una línea: `PENDIENTES_CIENTIFICOS.md` punto 1.

## Presentación y permisos

**DIV-3 · El administrador NO ve las cuatro pestañas de tratamiento por profesión.**
- El prototipo deja al admin verlas en solo-lectura; Atlas no le amplía esa visibilidad sobre contenido clínico.
- Por qué: la fidelidad al prototipo aplica a la FORMA, no a los permisos (separación operativo/clínico). Ver ARCHITECTURE "Regla frente al HTML de Gildardo".

**DIV-4 · El diagnóstico de encuesta (D1-D8) usa COLAPSABLES, no las sub-pestañas del prototipo (C9).**
- El v8 navega los dominios D1-D8 con una sub-barra de pestañas (`encSub`); Atlas los presenta como secciones colapsables (D1 abierta, D2-D8 cerradas).
- Por qué: decisión de UI previa (`survey-diagnosis-section.tsx`), no se rehace la navegación al portar el patrón alimentario. Es una divergencia de CONTENEDOR; la organización INTERNA del patrón (tarjetas de categoría + grilla, colores y etiquetas) sí es fiel al v8. Deliberada, no un descuido.

**DIV-5 · El patrón alimentario NO muestra el puntaje ni el nivel (C9).**
- calcPatron produce un score 0-100 y un nivel (Óptimo/Adecuado/Mejorable/Deficiente), pero ni el v8 ni Atlas los muestran: la pantalla D1 es cualitativa (categorías + grilla de frecuencias).
- Por qué: (a) el v8 no los muestra (fidelidad); (b) hoy el score alimenta el índice contextual (ICEC), que está APAGADO (C1, ver DIV-2), así que mostrar un número que no entra a ningún cálculo sería exponer un dato sin uso. No es que decidamos ocultarlo: el v8 no lo muestra y hoy no significa nada operativo. **Disparador de revisión:** cuando C1 se active y el score empiece a mover la edad bioeléctrica, se revisa con Gildardo si debe verse.

**DIV-6 · El radar funcional usa una escala de 4 colores con ancla azul, no la paleta del HTML al día.**
- El HTML al día (gildardo-2026-08-13) usa una paleta donde la banda mejor ya es verde y de ahí solo se empeora (verde/amarillo/naranja/rojo): sin una zona que comunique "estás bien", todo se lee como advertencia. Atlas usa una escala de 4 colores DISTINTOS con ancla azul: Bajo (azul clínico, "estás bien") / Leve (verde) / Moderado (ámbar) / Alto (rojo).
- Por qué: los COLORES son nuestros (regla "el HTML manda en QUÉ se muestra, no en CÓMO"; `COTEJOS_VISUALES.md` sección d). Gildardo decidió las 4 bandas y sus NOMBRES (Bajo/Leve/Moderado/Alto), no la paleta. Verificado en el cotejo de números (2026-08-14): su radar al día es el de "todo advertencia" que Santiago encontró peor; nuestra ancla azul mejora sobre su propio radar. El vocabulario y las 4 bandas SÍ son fieles.
- Cómo: token de marca dedicado `--clinical-excellent` (sky `#0EA5E9`, distinto del `#205DFD` de acción). Commit `9e80663`. Documentado en `BRAND.md` (la 4a banda clínica). **Que NO reaparezca como hallazgo en el próximo cotejo del radar.**

**DIV-7 · El Diagnóstico abre en la subpestaña FUNCIONAL, no en Encuesta, y lleva una franja de veredicto persistente.**
- El HTML al día navega el Diagnóstico con subpestañas y abre por defecto en "Diagnóstico Encuesta (D1-D8)" (la más a la izquierda); Atlas abre en "Diagnóstico Funcional" y muestra una franja (estado EFR + riesgo integrado + ruta prioritaria) SIEMPRE visible por encima de las subpestañas.
- Por qué: el COMO es nuestro (regla del cotejo, `COTEJOS_VISUALES.md` sección d). Lo primero que se ve hoy y lo que más mira el profesional es el DFI (verificado en el orden actual "conclusión → detalle"); abrir en Encuesta lo escondería, lo contrario de lo que busca la reorganización. La franja resuelve el problema de fondo de meter subpestañas: que lo más mirado no quede detrás de una pestaña. El QUÉ (las capas de Gildardo) sí es fiel; el orden/default y la franja son nuestros. Además los índices bioeléctricos (IFC/IRC/PABU/ISCM/IEHH/EB) van en Funcional (él los pone en su capa funcional, no en Composición); un solo lugar por dato, no se repiten.
- Cómo: `diagnosis-subtabs.tsx` (subpestaña activa en la URL `?sub=`, default funcional) + `verdict-strip.tsx` (la franja). Reorganización 2026-08-14.

**DIV-8 · La tabla de composición consolida lo bioeléctrico crudo en un bloque propio, en vez de repartirlo entre Nivel III y Nivel II.**
- El HTML al día reparte los parámetros bioeléctricos crudos: las impedancias (R50, Z5, Z50, Z200, reactancia) dentro de "Nivel III · Celular" y el Cole-Cole (Re, Ri, R∞, C, Fo) dentro de "Nivel II · Molecular". Atlas los CONSOLIDA todos en un bloque "Bioeléctrico (Cole-Cole)" propio, con el ángulo de fase como fila principal y el resto bajo un desplegable.
- Por qué: el QUÉ es fiel (están TODAS las filas del HTML, cotejo j "van todas"); el CÓMO (el agrupamiento) es nuestro. Reunir lo crudo en un bloque es más coherente que dispersarlo por dos niveles, y es consistente con el nivel "Bioeléctrico" que Atlas ya tenía. El profesional entrenado en su modelo los encuentra juntos, no en Celular/Molecular.
- Cómo: `composition-map.ts` (nivel "Bioeléctrico (Cole-Cole)" con las filas de detalle marcadas `detail: "bioelectrico"`) + `composition-section.tsx` (desplegable). Con el desglose de agua del Nivel III (marcado `detail: "agua"`), la tabla queda en ~28 filas visibles y el detalle fino (16 filas) a un clic, persistido en la URL (`?agua`/`?bio`). Cotejo j, 2026-08-15.

---

*Cuando aparezca una divergencia nueva, entra aquí con su `DIV-N`, apuntando a la decisión que la autoriza. Si una deja de ser divergencia (Gildardo absorbe el cambio en su archivo), se retira con nota.*

**DIV-9 · La tabla de composición conserva GEB (metabolismo basal) y GET (gasto total), que el HTML no lista.**
- El HTML de Gildardo no muestra el metabolismo basal ni el gasto energético total en su tabla de Wang; Atlas los conserva en el Nivel V (Cuerpo entero), con la referencia del equipo Biody para el GEB.
- Por qué: Santiago los quiere (información útil para el profesional) y no contradicen nada del modelo (son medidas del equipo, no un cálculo del motor ANI-BIS-E). El QUÉ del HTML manda en lo clínico; agregar dos medidas del equipo que orientan al profesional es del CÓMO nuestro. Decisión Santiago 2026-08-15.
- Cómo: `composition-map.ts` Nivel V (filas GEB/GET). Cotejo de Wang, 2026-08-15.

**DIV-13 · La distribución por tiempos EXIGE al menos un tiempo de comida activo; el HTML no lo impide.**
- En el v8, si el profesional apaga todos los tiempos, `tiemposVivos` queda vacío, `interSplit` devuelve `[]` y las porciones de cada grupo desaparecen del reparto en silencio (un plan sin ninguna comida). Atlas lo IMPIDE: la validación rechaza `activos` sin ninguno en true, y la UI no deja apagar el último.
- Por qué: un paciente siempre come al menos una vez; un plan con cero tiempos no tiene sentido y perdería las porciones sin avisar. Es un guard, misma familia que DIV-10. El QUÉ (el reparto por mayor resto) es fiel; el guard es nuestro.
- Cómo: `saveTiemposSchema` (superRefine: al menos un activo) + la UI (CP2.2b). 2026-08-22.

**DIV-12 · La cadena calórica va POR DELANTE del HTML: cuadre de macros, distinción calculado/ajustado, aviso de borde y candado de concurrencia.**
- El HTML reparte kcal/proteína/grasa pero no CUADRA los macros contra el objetivo, no distingue lo CALCULADO por el modelo de lo AJUSTADO por el profesional, no avisa el borde (cuando proteína+grasa exceden el objetivo y no queda margen para carbohidratos), y guarda en localStorage sin candado. Atlas agrega las cuatro cosas.
- Por qué: son mejoras nuestras (el CÓMO), no cambian la ciencia del reparto (el QUÉ es fiel a `computeProtocoloEfectivo`, la misma función que sella el servidor). El cuadre es exacto por construcción (choKcal = objetivo − prot − grasa, residuo sin redondeo). La distinción calculado/ajustado y el aviso de borde salieron de que Santiago dudó al ver "medido 2590" vs la cadena; el candado, de persistir en BD lo que el HTML deja en el navegador.
- Cómo: `CadenaCaloricaSection` (vista previa en vivo + placeholders del modelo + el aviso `proteinaGrasaExcedenObjetivo`) + `adjustmentSignature` (candado) + `saveAdjustments` (FOR UPDATE). Checkpoint 2 / sub-tareas 2-3. **NO es un hueco pendiente de alinear con el HTML: es mejora registrada. Atlas va adelante aquí.**

**DIV-11 · Al cambiar el objetivo calórico, Atlas NO recalcula-y-pisa la lista de intercambio guardada; el HTML sí.**
- En el v8, un `useEffect` (L16151-16164) observa el objetivo y, cuando cambia, RE-CORRE PASO 3 y sobrescribe las porciones editadas ("el motor/IA es la base"). Atlas guarda con el objetivo con el que se calcularon (`objetivoBase`) y, si el objetivo cambia, AVISA del desfase sin recalcular; recalcular es explícito, nunca automático.
- Por qué: en el v8 las porciones viven en localStorage (transitorio, por sesión), así que recalcular-y-pisar es inofensivo. Atlas las PERSISTE en la BD: copiar ese recálculo haría DESAPARECER el trabajo del profesional en silencio. Lo que es inofensivo en algo transitorio es pérdida de dato al persistirlo. Distinto de DIV-10 (aquella es un aviso de más; esta es no destruir dato).
- Cómo: `treatments.intercambio_porciones` guarda `{objetivoBase, grupos}`; el panel compara `objetivoBase` con el objetivo efectivo actual y avisa. CP1.2, 2026-08-22.

**DIV-10 · La lista de intercambio SEÑALA cuando un grupo NUCLEAR queda en 0 porciones; el HTML lo muestra en 0 sin avisar.**
- En el v8, un grupo que redondea a 0 porciones se muestra "0" plano en la tabla de intercambio y se FILTRA de la grilla de tiempos (`if(tot>0)`), sin ninguna señal. Atlas marca (`avisoSinPorcion`) cuando un grupo **nuclear** (harinas, frutas, lácteos, carnes, leguminosas) cae a 0, que solo pasa con un objetivo calórico implausiblemente bajo.
- Por qué: es la lección del reparto de macros (mejor avisar que mostrar un 0 mudo que se lee como dato). Solo los nucleares: un discrecional en 0 (mecato, azúcares, bebidas) es un default sano y frecuente (mecato queda en 0 aun a 2200 kcal), marcarlo sería ruido. El QUÉ (las porciones) es fiel a PASO 3 byte a byte; la marca es del CÓMO nuestro. La distinción nuclear/discrecional es nuestra.
- Cómo: `clinical-engine/intercambio.ts` (`GRUPOS_NUCLEARES` + `avisoSinPorcion`, la porción NO cambia). CP1.1, 2026-08-22.

**DIV-11 · La opción de texto libre de la P43 (alergias) dice "Otra"; su archivo dice "Otras".**
- Su `ATLAS_v8.html` ofrece `Ninguna · Leche · Huevo · Maní · Trigo · Soya · Pescado · Mariscos · Otras`.
  Atlas ofrece lo mismo con **`Otra`** en singular.
- **Esto se declara el 2026-09-04, y lo que se corrige NO es la palabra sino una afirmación falsa.** El
  comentario de la v4 en `supabase/seed.ts` decía que la opción se portó "VERBATIM de su archivo (el token
  es suyo)", y no era cierto. Un comentario que afirma fidelidad donde no la hay es peor que la divergencia,
  porque el siguiente que lo lea no va a verificar.
- Por qué se queda `Otra` (decisión de Santiago, 2026-09-04), con tres argumentos:
  1. **El sentido.** La pregunta es "¿alergias alimentarias diagnosticadas?" y sus opciones son alimentos
     en singular (Leche, Huevo, Maní). `Otra` concuerda; `Otras` no.
  2. **Coherencia del instrumento.** Las otras ocho preguntas de opción múltiple ya llevan `Otra` por la
     modificación autorizada del 13 de agosto. Portar `Otras` solo en esta dejaría la encuesta diciendo dos
     cosas al mismo paciente.
  3. **Ya está en uso.** Medido contra la nube: cinco respuestas guardadas son `"Otra: ..."` con su texto
     libre (Apio, Penicilina, grasas).
- **No tiene efecto en el motor.** El detector de opción libre reconoce las cuatro flexiones
  (`/^otr[oa]s?$/i`, arreglado el 2026-09-02), así que `Otra` y `Otras` se procesan igual. Es una
  divergencia de TEXTO, no de comportamiento.
- Si él prefiere `Otras`, se cambia en el bump siguiente: es una cadena.

**DIV-12 · El enunciado de la P29 (estrés) dice sus extremos; el de su archivo no.**
- Suyo: *"Nivel de estrés en el último mes"*. Nuestro: *"Nivel de estrés en el último mes (1 = sin estrés,
  10 = máximo)"*.
- Por qué NO se retira: es una escala de 1 a 10 y sin sus extremos **no se puede responder bien**. Un
  paciente que no sabe si 10 es "mucho estrés" o "muy tranquilo" contesta otra cosa, y ese dato alimenta el
  motor. Retirar la aclaración empeoraría la pregunta, no la acercaría a su archivo.
- **La diferencia con las demás divergencias es que esta no cambia lo que se pregunta, sino cómo se
  entiende la escala.** No toca opciones, ni `field_key`, ni clasificación: el valor que llega al motor es
  el mismo 1-10.
- **Apareció el 2026-09-04 comparando los dos instrumentos por script**, no leyendo. Llevaba sin declarar
  desde que se escribió, que es lo que este archivo existe para evitar.
- Se le menciona cuando haya ocasión; no bloquea nada.

**DIV-13 · La lista de intercambio del paciente imprime la MEDIDA además de los gramos; su archivo no.**
- Suyo (L18248): `nombre (gramos)`, ocho por subgrupo y ", entre otros". Nuestro: `nombre (gramos,
  medida)`, con los mismos dos cortes. Ejemplo: *"Fríjol cargamanto blanco con plátano verde (110 g,
  1 cucharón colmado)"* en vez de *"(110 g)"*.
- **Qué la motiva, y es suyo:** él mismo señaló el 5 de septiembre que las doce filas repetidas de
  Leguminosas **no son duplicados**, sino el mismo alimento en dos tamaños de porción (1 cucharón colmado
  110 g y medio cucharón 60 g), y que *"el defecto está en el render, no en la tabla"*. Planteó tres
  salidas y dijo que firmaría una en su próxima ronda.
- **Por qué se eligió esta de las tres:** es la única que no pierde información. Agrupar por nombre
  esconde que son dos tamaños distintos; retirar las doce medias porciones le quita al nutricionista
  media escala de reparto. Y el dato ya estaba en su propia tabla: las 350 filas traen `med`, que hasta
  hoy no se mostraba en ninguna pantalla.
- **Por qué se decidió y no se preguntó:** es presentación, no ciencia (Santiago, 2026-09-05). Su tabla,
  sus gramos y sus dos cortes se quedan intactos; lo único que cambia es que se imprime un campo suyo que
  ya existía. Y se hizo ahora porque el cotejo del plan del paciente es esta semana: sin decidirlo, esa
  página podía moverse **después** de cotejada.
- **LA PREGUNTA, que es lo que hace que esto sea una divergencia declarada y no un hecho consumado:** se
  le dice cuál se eligió y por qué, y **si prefiere la (b) o la (c) se cambia**. Revertir es una línea.
- Cómo: `plan-paciente-reader.ts` (`armarListaIntercambio`). Candado en `plan-paciente.test.ts`, con su
  control de que las 350 filas siguen trayendo `med` no vacío.
