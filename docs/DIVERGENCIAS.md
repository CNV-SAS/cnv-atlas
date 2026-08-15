# Divergencias: qué hace Atlas distinto del prototipo de Gildardo, y por qué

**Qué es.** La lista única de los puntos donde Atlas se aparta DELIBERADAMENTE del archivo prototipo de Gildardo (`ATLAS_v7.html` vigente). Responde la pregunta que se hace muchas veces: "¿por qué Atlas hace esto distinto de su prototipo?". Cada divergencia es intencional y autorizada (por su instrucción escrita o por una regla del proyecto), NO un error de port. Los errores de port se corrigen; las divergencias se conservan y se justifican aquí.

**Cómo se relaciona con el resto.** Cada divergencia apunta a la decisión que la autoriza (`D-NNN` en `DECISIONES_ANIBISE.md`) o a la regla de arquitectura. Este documento es una VISTA (junta lo que en el consolidado vive como campo "Divergencia" por decisión); la autoridad está en la decisión, aquí está la lista para encontrarlas.

---

## Ciencia congelada (frozen)

**DIV-1 · El examen de telómeros/estrés oxidativo se RETIRÓ del listado de exámenes sugeridos.**
- El prototipo lo incluye (cuando IAE > 5); Atlas (el artefacto que corre) no.
- Por qué: instrucción escrita de Gildardo (2026-08-03): no es examen de laboratorio estándar y citaba el propio modelo como referencia. Ver **D-012 / CA-1**.
- Cómo: por el mecanismo de modificaciones autorizadas (el original queda byte-idéntico; el generado lo omite). El manifiesto `frozen/authorized-modifications.js` tiene la instrucción verbatim.

**DIV-2 · El mapeo del índice contextual (ICEC) se mantiene APAGADO, pese a la instrucción de activarlo.**
- El prototipo trae el interruptor apagado; su instrucción (2026-08-03) dice activarlo; Atlas lo mantiene apagado.
- Por qué: su propio comentario en el archivo advierte "no poner en true sin resolver" la calibración μ/σ de la EB-BIS (excepción a la regla de autoridad: el archivo advierte contra su propia instrucción). Además hoy no se puede sin C9 (calcPatron) y la captura de d7_agua. Ver **D-006 / P-01**.

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
