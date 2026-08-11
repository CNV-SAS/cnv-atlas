# Consulta legal — Captura de ETNIA en el consentimiento

**Estado:** BORRADOR, listo para enviar cuando Santiago decida. No enviado.

## Contexto

El Observatorio Latinoamericano de Bioimpedancia (ObBIA-Latam) necesita **estratificar por etnia** los datos anonimizados del modelo. Para eso, Atlas tendría que **capturar la etnia** del paciente en el intake, junto con otros cinco datos sociodemográficos (nivel educativo, ocupación, estado civil, estrato, motivo de consulta).

La etnia (origen racial/étnico) es un **dato sensible** bajo el artículo 5 de la Ley 1581 de 2012, y es una categoría **distinta** de los datos sensibles de salud.

## Lo que hay hoy

- El consentimiento vigente (v1.7) tiene una autorización de datos sensibles **acotada explícitamente a datos sensibles de SALUD** ("Autorizo el tratamiento de mis datos sensibles de salud"). No menciona origen racial/étnico.
- Los otros cinco sociodemográficos (educación, ocupación, estado civil, estrato, motivo) **no son categorías sensibles** del artículo 5; los cubre el consentimiento general de servicio (ya recolectamos salud, que es más sensible). Esos cinco no dependen de esta consulta.
- Capturar la etnia sin cubrirla en el consentimiento sería tratar un dato sensible sin autorización específica.

## Preguntas concretas

1. **¿Se puede capturar la etnia ampliando el alcance del consentimiento actual, o hace falta una autorización separada y específica** para origen racial/étnico (distinta de la de datos de salud)?
2. Si hace falta redactar algo, **¿cuál sería el texto (o la dirección)** de esa autorización?
3. El artículo 6 exige que sea **opcional y que no condicione el servicio**. En Atlas ya lo sería (si el paciente no responde, queda vacío, no un valor por defecto). ¿Basta con eso?
4. El observatorio estratifica **por etnia** sobre datos anonimizados. Como la etnia es re-identificante en combinación, **¿qué gobernanza necesita su uso agregado** (por ejemplo, exigir la autorización de investigación + agregación por cohorte, nunca fila a fila)?

## Qué necesitamos de vuelta

- Un sí/no sobre si se puede capturar la etnia, y bajo qué figura (ampliar el consentimiento vs. autorización separada).
- Si se puede: el texto o la dirección de la redacción, y la condición de gobernanza para el uso agregado.
- Con eso, construimos; y el asesor revisa el texto final antes de pedirlo a ningún paciente.
