# Consulta legal — Conservar un BORRADOR de encuesta antes de firmar el consentimiento

**Estado:** BORRADOR, listo para enviar cuando Santiago decida. No enviado.

## Contexto

La encuesta del paciente tiene **63 preguntas**, y ahora, con la firma electrónica, hay una **espera de un código por correo** en el medio. Un paciente que llega casi al final y, por un tropiezo (se cierra la página, se le acaba la batería), tiene que rellenar todo de nuevo, **no vuelve**: es abandono.

La solución técnica es **guardar un borrador** de las respuestas ligado al token del enlace, sin crear todavía paciente, evaluación ni consentimiento, y volver a cargarlo si el paciente reabre el mismo enlace.

## Lo que hay hoy

- Hoy **no se guarda nada** hasta que el paciente firma el consentimiento al final. Es seguro legalmente (no hay datos de nadie que no autorizó), pero es lo que causa el abandono.
- Si guardáramos el borrador, Atlas tendría **respuestas de salud de una persona que todavía no autorizó nada**. El caso límite es un **borrador abandonado**: datos de salud de alguien que **nunca completó ni autorizó**, sin titular con quien hablar ni consentimiento que invocar para conservarlos.
- Por eso el nudo **no es técnico, es de gobierno**: la regla de expiración (borrar/anonimizar al vencer) no es higiene, es lo único que haría legítimo el borrador.
- El almacenamiento sería **solo en el servidor** (nunca en el navegador; los datos sensibles no van a `localStorage`).

## Preguntas concretas

1. **¿Se pueden conservar temporalmente respuestas de salud de una encuesta NO completada, antes de que el consentimiento se firme?**
2. Si se puede, **¿por cuánto tiempo** (el plazo máximo de conservación del borrador)?
3. **¿Qué hay que hacer al vencer** ese plazo: borrar por completo, anonimizar?
4. **¿Hace falta algún aviso al paciente** al iniciar la encuesta (por ejemplo, que sus respuestas se guardan temporalmente hasta que firme o hasta que venza el plazo)?

## Qué necesitamos de vuelta

- Un sí/no sobre si se puede conservar el borrador antes de firmar.
- Si se puede: el plazo máximo y la regla exacta al vencer (borrar vs. anonimizar), y si hace falta un aviso al iniciar.
- Con eso, construimos el bloque de borrador (esta consulta es su primer paso, el gate); y el asesor revisa antes de producción.
