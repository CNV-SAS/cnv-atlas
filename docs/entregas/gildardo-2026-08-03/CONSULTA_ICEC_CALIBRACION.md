# Consulta a Gildardo: activar el mapeo del ICEC vs la calibración de la EB-BIS (2026-08-03)

> Va junto con el documento consolidado y las tres consultas anteriores. Para revisión de Santiago antes de enviar.

---

Sobre activar el mapeo del índice contextual (C1 / lo que nos pediste en esta ronda):

Nos dijiste que lo activáramos en Atlas sin esperar tu archivo, y lo vamos a hacer. Pero al prepararlo vimos algo que queremos confirmarte antes.

La edad bioeléctrica estandariza ese índice contra una media (58,578) y una desviación (13,332) fijas. Esas constantes corresponden al índice calculado con el mapeo APAGADO, es decir, con la alimentación y la hidratación en sus valores por defecto. Si activamos el mapeo sin revisar esas constantes, la edad bioeléctrica se movería porque cambió la escala del índice, no porque cambiara el estado del paciente: estaríamos cambiando una de las dos mitades de la comparación y dejando la otra vieja.

Tu propio comentario en el archivo, junto al interruptor, ya lo señala: lo marca como "desactivado a propósito, no poner en true sin resolver lo siguiente", estima que activarlo baja la edad bioeléctrica de todos entre uno y ocho años (más cuanto más sano está el paciente), y deja abierta justamente la pregunta de dónde salieron esa media y esa desviación. Por eso te lo consultamos en vez de activarlo directo: tu instrucción de activarlo y ese comentario apuntan a cosas distintas, y no queremos elegir por ti en algo que mueve la edad bioeléctrica de todos los pacientes.

La pregunta concreta: ¿la media y la desviación se ajustan junto con el mapeo (recalibración), o hay algo que no estamos viendo? Mientras tanto lo dejamos preparado pero sin activar.
