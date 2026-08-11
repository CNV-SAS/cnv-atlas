# Estado de Atlas (dónde vamos)

Documento para consultar cuando se pierda el hilo. Lenguaje llano, sin tecnicismos. **Se actualiza al CERRAR cada bloque, no al planearlo.**

Última actualización: al cerrar los desplegables de la encuesta (país, ciudad, sexo) y el arreglo del sexo.

---

## Qué funciona hoy

De punta a punta, el camino de un paciente ya está construido:

- Un profesional entra con su cuenta y su segundo factor (código del teléfono).
- Un paciente recibe un enlace o un QR, llena la encuesta, y **firma el consentimiento por medios electrónicos**: se le manda un código al correo, lo valida, y le llega una copia del consentimiento con sus datos. Funciona para adultos y para menores (con su representante).
- Atlas decide solo si es un paciente nuevo o uno de seguimiento, por su documento (ante duda, el profesional confirma).
- Se importa la medición del equipo Biody.
- El motor clínico (la ciencia de Gildardo) calcula los indicadores, el diagnóstico, la Diana y las rutas de atención.
- El profesional ve los resultados, arma el tratamiento (protocolo, menú por inteligencia artificial, nutracéuticos), y genera el reporte del paciente: lo revisa, lo aprueba y lo envía por correo en PDF.
- En un seguimiento, Atlas compara contra la medición anterior y le comunica al paciente si mejoró, si sigue igual o si empeoró (y si empeoró, con la fecha de su próxima cita).
- Alrededor: los cobros (pasarela de pago + factura), el préstamo del equipo (comodato), el inventario de nutracéuticos, y los paneles de administración, dirección y observatorio, con auditoría de accesos.

## Qué falta (por bloque, del más chico al más grande)

1. **Reenviar la copia del consentimiento.** Un botón para que el profesional reenvíe la copia a quien no la recibió. Chico.
2. **Los cinco datos sociodemográficos + el motivo.** La etnia (el sexto) va aparte, tras una consulta legal. Mediano.
3. **Guardar el borrador de la encuesta.** Que un paciente que se detiene a mitad no pierda lo que llevaba. Va tras una consulta legal. Mediano.
4. **El re-port del motor de peso/prescripción de Tratamiento** (Gildardo ya respondió cómo: peso por defecto Lorentz/peso actual, retirar el peso ajustado). Es la mitad de Tratamiento que estaba trabada; ya se puede. Grande.
5. **Renumerar el consentimiento a la versión 1.0 y limpiar.** Es tarea del lanzamiento, no de ahora.

Notas:
- La **encuesta** ya tiene los desplegables (país, ciudad, sexo). Sigue faltando **el pase de instrumento** (espera a Gildardo) para darla por terminada.
- De §9 queda una sola confirmación de texto pendiente de Gildardo (cómo llamar a la "conducta propia" cuando la remisión es a la propia profesión del que atiende). Va en la ronda. El resumen por destinatario ya funciona.

## Sobre la encuesta (lo que preguntaste)

**La encuesta NO está lista.** Ya están hechos: la navegación por pasos, la numeración de las preguntas, la seguridad y **todo el consentimiento** (incluida la firma electrónica y su copia). **Falta:** el pase de instrumento (que espera a Gildardo) y los desplegables (las listas de opciones).

## Qué espera a Gildardo

- **El pase de instrumento de la encuesta** (para poder terminarla).
- Un lote de preguntas acumuladas (cirugías digestivas, alcohol, dos referencias del equipo Biody). No urgen; se le mandan juntas.

## Qué falta consultar en lo legal

**Importante: nada de esto bloquea construir, y nada "espera al abogado" de brazos cruzados. Espera una consulta que todavía no hicimos.** El método que funcionó con la firma electrónica es el que aplica: se consulta (se le pregunta al asesor legal), se decide, se construye, y el abogado revisa al final y corrige si no está de acuerdo. Todo junto sí es gate de ATENDER PACIENTES REALES (el lanzamiento), no del desarrollo.

Dos consultas condicionan trabajo concreto, y ya están preparadas para cuando decidas mandarlas:

- **Etnia:** ampliar el consentimiento para capturar un dato sensible que el observatorio necesita. Hasta consultarlo, ese campo no se pide.
- **Borrador de encuesta:** conservar temporalmente respuestas de salud de una encuesta no completada, antes de firmar. Hasta consultarlo, no se guardan respuestas a medias.

La **firma electrónica** ya pasó por este método (consultada, decidida, construida); falta solo su visto bueno final. Y quedan el **adulto con representante legal** (hoy el sistema asume representante = menor) y varias de **cumplimiento regulatorio** (notificación de incidentes, anonimización, registro de bases de datos, acuerdos con proveedores): son gate de atender pacientes reales, no de una tarea de hoy.

## Siguiente paso

Las cuatro cosas de Gildardo (§6, §10, §15, §9) y los desplegables están hechos. La ronda para Gildardo y las dos consultas legales (etnia, borrador) están listas para que las mandes. Lo grande que sigue: el re-port del motor de peso de Tratamiento (Gildardo ya dijo cómo), que destraba la mitad de Tratamiento.
