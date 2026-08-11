# Estado de Atlas (dónde vamos)

Documento para consultar cuando se pierda el hilo. Lenguaje llano, sin tecnicismos. **Se actualiza al CERRAR cada bloque, no al planearlo.** Si el bloque lo cierra Santiago en consolas (un despliegue, sembrar la nube), ese trabajo no deja un commit al que colgar la actualización, así que la regla del "mismo commit" no se dispara. **Regla complementaria: cuando un bloque lo cierra Santiago, es Claude quien actualiza este estado en el turno siguiente.** No hay commit, pero sí hay turno. (Este desfase se repitió 7 veces; esta es la mitigación de la causa raíz.)

Última actualización: 2026-08-11, al cerrar el bloque de **retención en la fuente** (estado tributario del integrante + verificación del RUT + rechazo con motivo + aviso por correo).

---

## Qué funciona hoy

De punta a punta, el camino de un paciente ya está construido:

- Un profesional entra con su cuenta y su segundo factor (código del teléfono). Si olvida la clave, la recupera solo (enlace en la pantalla de acceso + correo + cambio con segundo factor).
- Un paciente recibe un enlace o un QR. El intake es de dos fases: **primero firma el consentimiento** (por medios electrónicos: se le manda un código al correo, lo valida, y le llega una copia con sus datos), y **después llena la encuesta**. Si se detiene, puede retomar con un enlace. Funciona para adultos y para menores (con su representante).
- Atlas decide solo si es un paciente nuevo o uno de seguimiento, por su documento. Ante duda por nombres parecidos, alerta y el profesional confirma (ya no se crean identidades duplicadas por error).
- Se importa la medición del equipo Biody.
- El motor clínico (la ciencia de Gildardo) calcula los indicadores, el diagnóstico, la Diana y las rutas de atención.
- El profesional ve los resultados, arma el tratamiento (protocolo, menú por inteligencia artificial, nutracéuticos), y genera el reporte del paciente: lo revisa, lo aprueba y lo envía por correo en PDF.
- En un seguimiento, Atlas compara contra la medición anterior y le comunica al paciente si mejoró, si sigue igual o si empeoró.
- Alrededor: los cobros por pasarela (Wompi) **y la venta en efectivo**, el préstamo del equipo (comodato), el inventario de nutracéuticos con su remesa/consignación CNV→integrante, y los paneles de administración, dirección y observatorio, con auditoría de accesos.
- **La retención en la fuente:** cuando un integrante empieza a generar comisiones, se le pide su estado tributario y su RUT; una persona designada de CNV verifica el RUT (o lo rechaza con un motivo que el integrante ve y recibe por correo), para que CNV pueda retener y pagarle su comisión con certificado.

## Dónde está desplegado

**Atlas ya está en la nube:** `atlas.cnvsystem.com` funciona, con Supabase en la nube, dominio propio, correo por Resend, y el pago probado de punta a punta con Wompi en sandbox. La nube nació limpia (se sembró sin datos demo; la tabla de pacientes quedó vacía). Los datos que hay ahora son los que Santiago fue creando probando. El entorno local sigue existiendo (es donde corren los tests y los smokes sin datos reales).

## Los tres hitos (dónde estamos)

- **Hito 1** (producto pulido para el integrante, en sandbox, sin pacientes reales): EN CURSO.
- **Hito 2** (los integrantes prueban en la nube y dan visto bueno): pendiente.
- **Hito 3** (pacientes reales): pendiente.

La lista formal de gates, con su hito, vive en `LANZAMIENTO.md` (fuente única). Este documento es el resumen llano.

## Qué falta (de lo más chico a lo más grande)

1. **Reenviar la copia del consentimiento.** Un botón para reenviar a quien no la recibió. Chico.
2. **Los cinco datos sociodemográficos + el motivo.** La etnia (el sexto) va aparte, tras una consulta legal. Mediano.
3. **Guardar el borrador de la encuesta.** Que un paciente que se detiene no pierda lo que llevaba. Va tras una consulta legal. Mediano.
4. **La factura real de la venta (Alegra).** Hoy la factura es un simulacro en sandbox; ni el pago por Wompi ni la venta en efectivo facturan de verdad. Depende de que Santiago prepare Alegra (sandbox y luego producción). Grande.
5. **La liquidación agregada del integrante** ("cuánto le deben"): junta ventas, faltantes, vencidos y retención para dar el neto. Es la pieza que el integrante pregunta al entrar. Depende de la tarifa de retención (contadora) para el número final, pero se puede construir antes. Grande.
6. **El re-port del motor de peso/prescripción de Tratamiento.** Es la mitad de Tratamiento que sigue trabada; espera la fórmula exacta del déficit desde el peso meta (Gildardo). Grande.
7. **Los grants sobre todo el contenido clínico** (cerrar el "god-view" del admin). Es gate de **pacientes reales (Hito 3)**, no de recibir integrantes: mientras no haya historias clínicas reales, lo que un admin vería de más son datos de prueba, no PHI de personas.
8. **Renumerar el consentimiento a 1.0 y limpiar.** Tarea del lanzamiento.

## Qué bloquea RECIBIR INTEGRANTES (la pregunta que importa)

**Para que un integrante entre, opere y venda, hoy no falta código bloqueante:** el despliegue está, la autenticación (incluida "olvidé mi clave") está, la nube está limpia, y la venta (Wompi + efectivo) registra venta y comisión. Los grants son gate del Hito 3, no de esto.

**Lo único que un tercero bloquea de verdad es PAGARLE la comisión:** la tarifa exacta de retención la define la **contadora**, y la liquidación agregada se apoya en ella. Un integrante puede entrar, operar y vender antes de que la contadora responda; lo que no se puede es liquidarle el pago. Decisión ya tomada: lo clínico y la venta no se bloquean por lo fiscal.

(Si además se abre a profesiones distintas de nutricionista, eso sí espera a Gildardo, Q22: hoy solo el nutricionista tiene contenido de tratamiento.)

## Qué espera a Gildardo

Nada de lo operativo/comercial (E2) lo espera. Lo que espera es clínico:

- **Bloquea:** la fórmula exacta del déficit calórico desde el peso meta (la mitad del motor de Tratamiento), y confirmar el retiro del "peso ajustado".
- **No bloquea:** unas confirmaciones de texto y de etiquetas, dos rarezas del patrón alimentario, cuántas de las 63 preguntas del intake son necesarias en la primera consulta, y una tabla de referencia que él ofreció entregar. Van en la ronda consolidada (`docs/entregas/RONDA_GILDARDO_2026-08-10.md`).

## Qué espera al contable y a la contadora

- **Contable** (ya entregó su dictamen): una consulta de seguimiento sobre el contacto en Alegra (afina cómo se factura, no si se factura) y confirmar el rediseño de retención (A2, ya elegida).
- **Contadora** (bloquea la liquidación, no la factura): la **tarifa exacta de retención por comisiones** por perfil, y el tratamiento contable del efectivo en custodia + la conciliación quincenal.

## Qué falta consultar en lo legal

Nada bloquea construir; espera consultas que aún no se hacen (el método que funcionó con la firma electrónica: consultar, decidir, construir, el abogado revisa al final). Preparadas: **etnia** (dato sensible para el observatorio) y **borrador de encuesta** (conservar respuestas antes de firmar). Y quedan el **adulto con representante legal** y varias de cumplimiento regulatorio: son gate de pacientes reales, no de hoy.
