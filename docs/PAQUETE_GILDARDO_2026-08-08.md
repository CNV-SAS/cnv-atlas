# Paquete para Gildardo — 2026-08-08

Gildardo: desde tu última respuesta (principios de agosto) se construyó **casi todo**. Lo que sigue no son dudas de diseño: son lo último que falta para cerrar. Por eso llega en un solo documento, como pediste, y no en rondas sueltas.

**Lo que ya quedó construido y funcionando desde tu última respuesta:**
- El **patrón alimentario** (los 15 grupos, lo que llamabas C9).
- Los **tres motores de tratamiento** que faltaban (médico, deportólogo, psicólogo), portados tal cual y ya visibles para el profesional.
- El **despacho de nutracéuticos** (catálogo, inventario, entrega).
- El sistema **desplegado en la nube**, con profesionales pudiendo entrar.
- El **registro de remisiones** (a quién, por qué, cuándo, y si el paciente volvió).
- El **aviso de encuesta incompleta** y el candado que impide comunicarle al paciente un resultado calculado con datos que faltan.

Con eso en mente, hay **dos cosas que pedirte, y son actos distintos**:

1. **FIRMAR** el documento de decisiones (todo lo que ya se decidió y en buena parte ya opera). Es un acto de ratificación.
2. **RESPONDER** las preguntas abiertas (la lista del final). Es un acto de definición.

Mezclarlos hace que ninguno se complete. Por eso van separados.

---

## PARTE 1 — Para FIRMAR: las decisiones tomadas

Cada una está numerada de forma estable (`D-NNN`). "Implementado" = ya opera en Atlas. "Decidido" = acordado, aún por construir. El detalle completo de cada una vive en el documento de decisiones; aquí va el resumen para tu firma.

### Cadena calórica y prescripción
- **D-001** — Sin peso de referencia registrado no se prescribe (calorías ni proteína). *Parcial: falta la cadena que lo consume.*
- **D-002** — El gasto se calcula con Mifflin sobre el peso de referencia; las estrategias que restan no llevan ajuste extra, las que suman sí; cáncer activo = gasto + sobrecosto. Incluye la **salvaguarda de TCA** como requisito duro. *Decidido, pendiente C6 y construcción.*

### Clasificación y diagnóstico
- **D-003** — La referencia que ve el profesional sale del clasificador del motor, con la dirección del indicador explícita. *Firmado e implementado.*
- **D-004** — Se agrega el fenotipo estructural F1–F12 de aquí en adelante; lo ya emitido no se reescribe. *Implementado.*
- **D-005** — Frontera de desnutrición re-sincronizada a tu archivo vigente (FMI 3.0; FFMI 17 H / 15 M). *Implementado.*
- **D-006** — El mapeo del índice contextual (ICEC) queda **preparado pero NO activado**, porque tu propio archivo advierte "no activar sin resolver la calibración de la edad bioeléctrica", y activarlo movería la edad de todos por un cambio de escala, no por el paciente. Ver pregunta abierta sobre esto. *Decidido: no activar.*
- **D-007** — Con la encuesta incompleta se emite el diagnóstico bioeléctrico (el de la medición), pero NO lo que depende de la encuesta (edad bioeléctrica, índice contextual, rutas derivadas). El aviso de qué falta ya está construido; la suspensión real de esas salidas, no. *Parcial.*
- **D-015** — Regla general: cuando tu clasificador y tu tabla de presentación difieran, manda el clasificador. *Implementado.*
- **D-016** — El ángulo de fase se muestra siempre con UN decimal, en todos lados (tu instrucción del v8). *Implementado.*

### Tratamiento
- **D-008** — Los cuatro bloques por profesión se portan tal como están. Los tres que faltaban (médico, deportólogo, psicólogo) ya están portados y visibles. Invariante: solo el nutricionista genera protocolo nutricional. *Parcial: falta la cadena calórica del nutricionista (espera C6).*
- **D-009** — Remitir es un acto que se registra; a la propia profesión no es remisión sino conducta propia. *El registro ya opera; falta la redacción de "conducta propia" (pregunta abierta).*
- **D-010** — El cambio se le comunica al paciente en tres redacciones (mejoró / sin cambio / empeoró), sin cifra y sin nombrar el indicador; "empeoró" solo con tu confirmación y con la próxima cita. *Decidido, por construir.*
- **D-011** — La edad bioeléctrica nunca va en cifra al paciente; al profesional con marca "calibración provisional". *Parcial.*
- **D-012** — Se retira el examen de telómeros (era el único que citaba tu propio modelo como referencia). *Implementado, por el mecanismo de modificaciones autorizadas (tu archivo original queda intacto).*
- **D-013** — Las pantallas de las otras profesiones dicen que el modelo sí tiene contenido para su disciplina. *Implementado.*

### Proceso
- **D-014** — La instrucción escrita manda sobre el archivo prototipo; donde discrepen, se registra la divergencia. *Adoptado.*

---

## PARTE 2 — Para RESPONDER: las preguntas abiertas

Una sola lista, ordenada por lo que más pesa. Marco lo que **BLOQUEA** trabajo y lo que no. La mayoría no bloquea: se acumularon para no interrumpirte.

### Lo que BLOQUEA trabajo grande

**1. C6 — proteína y sobrecosto por condición, en cifras. [BLOQUEA la mitad de Tratamiento].**
Es lo único que detiene trabajo grande: sin las cifras de proteína (g/kg por condición) y el sobrecosto calórico por condición, no se puede construir la cadena calórica del nutricionista, y con ella queda pendiente todo el plan alimentario (fórmula, intercambios, menú). Todo lo demás de Tratamiento ya está. **Si solo puedes responder una cosa, que sea esta.**

**2. Recordatorio: P2 y P3 quedaron de venir de tu lado y no llegaron. [P2 BLOQUEA cerrar los nutracéuticos].**
No son preguntas nuevas: dijiste que nos enviarías **P2** (los nutracéuticos por ruta, que destraba C13) y **P3**, y quedaron pendientes. **P2 no es menor:** el módulo de nutracéuticos ya está construido (catálogo, inventario, entrega), pero la RECOMENDACIÓN por ruta sigue saliendo del motor viejo. Sin tu manual de nutracéuticos por ruta, esa parte queda a medias.

**3. Las dos referencias del Biody BIS (`MCA_ref` y `hidSG_ref`). [Toca el uso con el equipo real].**
El equipo que CNV tiene (Biody BIS) da un export más corto que el ZM3, pero **sí trae la espectroscopía**, así que Atlas ya lo puede importar hoy. Su export corto no trae la mayor parte de la composición (masa celular activa, hidratación sin grasa, aguas sin grasa, etc.). **La buena noticia: tus identidades de derivación (las que verificaste sobre 5.073 registros) van a resolver casi toda esa composición cuando las portemos, que es justo lo siguiente que vamos a construir.** Lo único que ninguna identidad puede producir son dos **valores de referencia poblacional** (masa celular activa y hidratación sin grasa): no son medidas ni se derivan de otras, son normas por sexo/edad. Y hacen falta para el índice de susceptibilidad (ISCM) y dos señales celulares. **Por eso te los pedimos: ¿nos das la tabla de esos dos por sexo/edad, o preferís que dejemos esas salidas vacías (sin degradarlas en silencio) hasta que exista la referencia?**

### Lo que hace falta para construir bien la cadena calórica (va con C6)

**4. Factor de actividad.** En su momento pediste no construir el factor sugerido, creyendo que era trabajo nuevo. Pero **ya existe en tu archivo**: tu motor de ejercicio calcula un factor (moderado si hay obesidad, ligero en el resto) y tu motor nutricional lo usa como valor por defecto, con la última palabra del profesional. Ya portamos tu motor de ejercicio, así que el factor ya se calcula. **Cuando construyamos la cadena calórica, pensamos seguir tu archivo (usar ese factor como default, editable), salvo que prefieras el valor fijo ligero.** ¿Confirmás seguir el archivo?

**5. Salvaguarda de TCA — confirmación.** Ya portamos la detección (tu tamizaje SCOFF desde la encuesta, más la definición ampliada del motor de psicología). Queremos confirmar que entendimos bien la **conducta**: cuando hay riesgo de conducta alimentaria y el plan tiene déficit, el sistema pone el déficit en cero, vuelve la dieta normocalórica y marca remitir. ¿Correcto? (La detección ya está; falta conectar la acción cuando se construya la cadena.)

### Lo que hace falta para cerrar funciones específicas

**6. La cita del "empeoró".** Pusiste que un empeoramiento solo se le comunica al paciente con la próxima cita agendada. Lo construimos con un campo de fecha (no tenemos calendario ni recordatorios). Dos cosas: (a) ¿el requisito se cumple con ese campo lleno, o hace falta una agenda real? (b) Al construirlo descubrimos que **esa fecha hoy NO aparece en el reporte del paciente**: él recibe "tu profesional revisará contigo el plan en la próxima consulta", sin decir cuándo. ¿La fecha debería aparecer en su reporte, o basta con que el profesional la tenga?

**7. La pregunta de cirugías.** Tu v8 tiene en el dominio de digestión una pregunta que nuestra encuesta no tenía (colecistectomía, bariátrica, resección intestinal, gastrectomía). La vamos a portar. Como una bariátrica cambia la absorción: **¿esa respuesta alimenta el motor nutricional, o es solo registro clínico?** Si alimenta, qué cambia cada opción.

**8. La suspensión por encuesta incompleta.** Ya avisamos qué dominios faltan. Para suspender de verdad las salidas que dependen de la encuesta, necesitamos saber la dependencia exacta: **¿cualquier dominio que falte suspende todo (edad bioeléctrica + índice contextual + rutas), o cada salida depende de dominios específicos?**

### Nomenclatura y presentación (del cotejo del v8; menor)

**9. Redacción de "conducta propia".** Cuando una ruta remite a la misma profesión del que atiende, hay que cambiar el texto. Necesitamos la lista de esas auto-remisiones y la redacción con que corregir cada ruta.

**10. Nombres de los indicadores.** Cotejando la pantalla de diagnóstico, varios nombres largos difieren entre tus propias vistas: IFC aparece como "función celular", "Función Celular" y "Fuerza Celular"; PABU como "proporción áurea" y como "distancia a la proporción áurea"; ISCM como "cardiometabólica" y "multicomponente"; IEHH como "espectro de hidratación" y "equilibrio hídrico". **¿Cuál es el nombre correcto de cada uno?** No los adivinamos.

**11. Dos detalles de display.** (a) La severidad por dominio: tu clasificador dice "Leve/Moderado/Alto" pero tu tabla de display dice "Vigilancia/Crítico"; ¿cuál ve el profesional? (b) El IRC lo mostrás ×10 en la tabla; nosotros lo mostramos crudo. ¿Adoptamos el ×10?

### Confirmaciones y material, sin apuro (no bloquean nada)

**12. Los campos sociodemográficos — la única que puede evitarnos trabajo legal.** Decidimos capturar etnia, nivel educativo, ocupación, estado civil, estrato y motivo de consulta, porque el observatorio los va a necesitar y después no se pueden reconstruir (el paciente ya pasó). Tu archivo también los captura. Dos cosas: (a) **¿alguno de esos alimenta el modelo, o son solo caracterización?** (b) La **etnia es dato sensible bajo la ley colombiana, y nuestro consentimiento actual no la cubre.** Antes de pedírsela a un paciente: **¿la considerás necesaria para el observatorio?** Si la respuesta es que no, nos ahorramos ampliar el consentimiento.

**13. Calibración de la edad bioeléctrica y el índice contextual.** Tu archivo estandariza la edad bioeléctrica contra una media y desviación calculadas con el mapeo del índice contextual APAGADO. Si lo activamos, la escala cambia pero esas constantes quedan viejas, moviendo la edad de todos. ¿Se recalibran junto con el mapeo, o hay algo que no vemos?

**14. Alcohol y contaminantes ambientales.** Lo que el paciente reporta de consumo de alcohol y de exposición a contaminantes hoy no cambia ningún resultado. ¿Debería influir en algo?

**15. Coherencia de la ruta R2.** Dos reglas distintas activan R2 en tu archivo y para un paciente real podrían discrepar. ¿Cuál representa el modelo vigente?

**16. Tu HTML como referencia.** Ahora que Atlas aplica modificaciones autorizadas que hacen divergir tu HTML de Atlas a propósito: ¿mantenés tu HTML al día con esos cambios (para usarlo como banco de pruebas), o lo dejás como está? Es decisión de tu flujo.

**17. Material sin urgencia.** Las 7 constantes de referencia poblacional que marcaste como "no aprobadas" (las dejamos sin usar, como pediste); y la lista de indicadores que miden lo mismo y alertan juntos (para tu revisión).
