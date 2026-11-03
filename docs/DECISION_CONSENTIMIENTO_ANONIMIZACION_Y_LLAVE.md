# Decisión: finalidad de anonimización en el consentimiento y custodia de la llave de seudonimización

**Para:** chat desarrollador (Atlas)
**De:** chat legal, vía Santiago
**Fecha de la decisión:** 20 de octubre de 2026
**Estado:** decidido. Pendiente solo la ratificación escrita del asesor legal (no bloquea la implementación del texto).

---

## 1. Contexto: qué se discutió y por qué

Un chat de revisión levantó dos observaciones sobre el consentimiento de Atlas v1.0:

1. **La estadística comercializable figura entre las finalidades necesarias.** Los datos de salud son sensibles, y el parágrafo del artículo 6 de la Ley 1581 de 2012 prohíbe condicionar una actividad a que el titular entregue datos sensibles. Si el paciente no puede recibir su consulta sin aceptar que sus datos alimenten un producto comercial, esa autorización es atacable por no ser libre. Y como está en la misma casilla que la evaluación y el plan, un ataque podría afectar la casilla completa.
2. **¿Quién custodia la llave de seudonimización?** Si la tiene el mismo equipo que analiza y vende, la seudonimización protege poco en la práctica.

Se evaluó volver la estadística comercializable una autorización opcional (una casilla más) y **se descartó**. CNV tiene como parte de su modelo de negocio la venta de información anonimizada, y la preferencia es ajustar textos antes que agregar casillas.

## 2. Razonamiento jurídico que sostiene la decisión

- **El dato verdaderamente anonimizado no es dato personal.** Queda fuera de la Ley 1581, y venderlo no requiere autorización de nadie.
- **El único tratamiento del dato personal es el acto de anonimizar.** Ese acto sí requiere cobertura en el consentimiento.
- **Anonimizar sí sirve al paciente, de forma directa:** protege su información y construye las referencias poblacionales (percentiles, rangos de los índices, fenotipos del mapa integrado) con las que se interpretan sus propios resultados en el modelo ANI-BIS-E. Por eso puede estar entre las finalidades necesarias.
- **La venta deja de ser una finalidad del tratamiento del dato personal** y pasa a ser el uso de algo que ya no es dato personal, informado con transparencia.
- **La sostenibilidad del modelo NO es el fundamento legal.** "Lo necesitamos para financiarnos" no es un argumento válido de necesidad; figura en el texto solo como información al paciente.

## 3. Decisiones tomadas

| # | Decisión |
|---|---|
| D1 | La finalidad necesaria deja de ser "generar y comercializar información estadística anonimizada" y pasa a ser **anonimizar**, informando que lo anonimizado puede comercializarse. |
| D2 | **No se agregan casillas.** La casilla necesaria 1 sigue cubriendo todo el numeral 4. |
| D3 | El **control de calidad** sobre datos seudonimizados **se queda en necesarias**: garantiza que el modelo se le aplique bien al paciente. |
| D4 | El cambio es una **versión nueva del texto, no sustantiva**: aclara una finalidad que ya estaba informada. |
| D5 | **Los consentimientos firmados bajo la v1.0 siguen vigentes.** No hay regularización ni re-firma de nadie por este cambio. |
| D6 | CNV es **responsable autónomo sobre datos seudonimizados** (control de calidad e investigación ObBIA-Latam, con la autorización correspondiente) y sobre derivados anonimizados. Cualquier resumen interno que diga "solo anonimizados" está desactualizado. |

## 4. Cambios a implementar

### 4.1 Texto del consentimiento, numeral 4, cuarto punto

**Texto actual (v1.0), se reemplaza:**

> Generar y comercializar información estadística anonimizada que no permite identificarle. Los datos personales no serán vendidos; solo se comercializan derivados que son irreversiblemente disociados de su identidad.

**Texto nuevo:**

> Anonimizar sus datos, es decir, disociarlos de forma irreversible de su identidad, para proteger su información y construir y actualizar las referencias poblacionales con las que se interpretan sus propios resultados en el modelo ANI-BIS-E. La información resultante deja de ser un dato personal y no permite identificarle directa ni indirectamente; CNV podrá utilizarla para cualquier fin lícito, incluida su comercialización, que contribuye a sostener el desarrollo del modelo. Sus datos personales nunca se venden.

Ningún otro punto del consentimiento cambia. Las casillas quedan idénticas.

### 4.2 Versionado

- Se crea una versión nueva del texto (regla vigente: una versión, un texto, para siempre), con su hash congelado como las demás.
- Debe marcarse como **cambio no sustantivo**. La regla del enlace de seguimiento ("solo omite el consentimiento si el paciente tiene un consentimiento de Atlas vigente") **no debe tratar la v1.0 como reemplazada**: quien firmó la v1.0 conserva su consentimiento vigente y el enlace de seguimiento le sigue omitiendo el consentimiento.
- Si hoy el sistema no distingue entre versión sustantiva y no sustantiva, hay que agregar esa distinción: es la condición para que este cambio no fuerce la re-firma de toda la base.
- Los pacientes nuevos firman la versión nueva, y la copia que reciben es la de la versión nueva.

### 4.3 Lo que NO se construye

- Ninguna casilla nueva.
- Ninguna exclusión de pacientes v1.0 de los conjuntos anonimizados.
- Ningún gate de re-firma por este cambio.

## 5. Condiciones previas a la primera venta de datos (no bloquean el cambio de texto)

Estas dos cosas deben estar operando **antes del primer conjunto de datos comercializado o compartido con terceros**. Son las que hacen que el argumento jurídico se sostenga.

### 5.1 Umbral de anonimización

El argumento entero vale solo si el dato vendido es realmente anónimo. Un registro sin nombre no es anónimo si es identificable por cruce (por ejemplo, "el único paciente con cierta condición en un municipio").

- Agregación mínima: **grupos de al menos 5 personas (k ≥ 5)**.
- **Supresión de celdas pequeñas** en cualquier tabla o salida.
- La regla vive en la **Política de Gobernanza del Dato** y debe aplicarse técnicamente en el pipeline de salida, no solo estar escrita.

### 5.2 Custodia de la llave de seudonimización

Si quien analiza y vende puede reidentificar, la seudonimización es una etiqueta. Requisitos:

- **La tabla de correspondencia vive fuera del entorno de análisis.** Quien analiza o explota comercialmente los datos no tiene acceso técnico a ella.
- **La reidentificación solo ocurre por procedimiento registrado y con causa**: el acceso excepcional ya previsto en el consentimiento (queja o desviación grave del protocolo). Nunca a discreción del equipo analítico.
- **Cada reidentificación deja registro auditable.**

En una empresa pequeña las mismas personas cumplen varios roles, así que esto se resuelve con **control técnico de acceso**, no con organigrama.

## 6. Riesgo residual

La SIC podría sostener que anonimizar para producir un bien comercial no es necesario para la atención. Con el texto nuevo el riesgo es bajo, y la defensa descansa en tres hechos:

1. La anonimización construye las referencias con las que se evalúa al propio paciente.
2. Es una medida de protección de su información.
3. Su posible comercialización está informada expresamente.

Se lleva al asesor legal para ratificación escrita. La implementación del texto no espera esa ratificación.
