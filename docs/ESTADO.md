# Estado de Atlas (dónde vamos)

Documento para consultar cuando se pierda el hilo. Lenguaje llano, sin tecnicismos. **Se actualiza al CERRAR cada bloque, no al planearlo.**

Última actualización: al cerrar §6 (la fecha de la cita en el reporte).

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

1. **Nombres de los indicadores (§10).** Corregir cuatro nombres a los que fijó Gildardo. **En curso.**
2. **Renombre de la Diana (§15) + un detalle.** Cambiar un código de eje en el gráfico, y evitar que el profesional vea un código interno crudo en una pantalla. Chico.
3. **Remisiones del reporte (§9).** Que las remisiones salgan resumidas por destinatario (una línea por profesión) en vez de repetidas ruta por ruta. Mediano.
4. **Los desplegables de la encuesta.** Faltan varias listas de opciones de la encuesta. Mediano.
5. **Reenviar la copia del consentimiento.** Un botón para que el profesional reenvíe la copia a quien no la recibió. Chico.
6. **Los seis datos sociodemográficos.** Cinco datos + el motivo de consulta (uno de ellos, la etnia, espera al abogado). Mediano.
7. **Guardar el borrador de la encuesta.** Que un paciente que se detiene a mitad no pierda lo que llevaba. Espera primero al abogado. Mediano.
8. **Renumerar el consentimiento a la versión 1.0 y limpiar.** Es tarea del lanzamiento, no de ahora.

## Sobre la encuesta (lo que preguntaste)

**La encuesta NO está lista.** Ya están hechos: la navegación por pasos, la numeración de las preguntas, la seguridad y **todo el consentimiento** (incluida la firma electrónica y su copia). **Falta:** el pase de instrumento (que espera a Gildardo) y los desplegables (las listas de opciones).

## Qué espera a Gildardo

- **El pase de instrumento de la encuesta** (para poder terminarla).
- Un lote de preguntas acumuladas (cirugías digestivas, alcohol, dos referencias del equipo Biody). No urgen; se le mandan juntas.

## Qué espera al abogado

- Ampliar el consentimiento para poder capturar la **etnia**.
- Si se puede **guardar un borrador** de encuesta de alguien que aún no firmó.
- El caso del **adulto que necesita representante legal** (hoy el sistema asume que representante = menor).
- La ratificación de la **firma electrónica** (ya está implementada; falta el visto bueno formal).
- Varias de cumplimiento (plazos de notificación de incidentes, estándar de anonimización, registro de bases de datos, acuerdos con proveedores).

## Siguiente paso

Terminar las cuatro cosas que Gildardo ya respondió: §6 (hecho), §10 (en curso), luego §15 y §9. Después, los desplegables de la encuesta.
