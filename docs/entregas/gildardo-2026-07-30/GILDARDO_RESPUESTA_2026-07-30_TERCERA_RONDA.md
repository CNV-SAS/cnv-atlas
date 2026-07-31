# Respuestas de la dirección científica · tercera ronda

**Fecha:** 30 de julio de 2026
**De:** Dirección Científica CNV · Gildardo de Jesús Uribe Gil
**Para:** equipo Atlas

Va resuelto lo que los frena, que es el punto 1. Los puntos 2 y 3 los cierro en el próximo envío.

---

## 1. Quién aplica los cambios que tocan el cálculo

**Opción B.** Quedan autorizados a implementar de su lado los cambios que tocan el cálculo, siguiendo exactamente lo que yo escriba. Aplica a los trece cambios de C1 a C13 y a los que vengan.

La razón es práctica. Si cada ajuste tiene que pasar por mi archivo antes de llegar a Atlas, yo me convierto en el cuello de botella de todo el desarrollo, y la edición manual de un archivo de ese tamaño es justamente de donde salieron las divergencias que llevamos dos rondas resolviendo.

La autoría del modelo no se delega. Lo que se delega es la digitación.

**Dos condiciones, que no son negociables:**

1. **Cada cambio parte de una instrucción escrita mía**, con la fórmula, la condición y los puntos de corte explícitos. Si algo en mi instrucción no está claro, no lo interpreten: me lo devuelven y lo preciso. Un supuesto razonable de ustedes sigue siendo un supuesto que yo no autoricé.
2. **Me devuelven en lenguaje llano qué cambiaron**, y yo lo apruebo antes de que entre a producción. No necesito ver código; necesito leer qué quedó calculando el sistema y confirmar que es lo que quise decir.

Con esto, la garantía de verificación que ustedes construyeron se mantiene: lo que Atlas calcula sigue siendo lo que yo escribí, solo que la trazabilidad pasa por la instrucción y por mi aprobación, no por la coincidencia literal con mi archivo.

### 1.1 · La corrección de cintura

**Es la primera explicación: la corrección quedó pendiente.** La decidí y no alcancé a aplicarla.

El archivo que recibieron es mi versión vigente. No hay una posterior y no hay nada que reenviar. Porten desde ese archivo con tranquilidad.

La corrección, para que quede escrita: el campo de cintura debe leer la **circunferencia medida del paciente**, no la columna del umbral de referencia de la OMS. Tal como ya la aplicaron ustedes. Bajo la opción B, queda de su lado; no tengo que abrir mi archivo por esto.

### 1.2 · Cáncer en remisión

Igual. La decisión ya está tomada y no cambia: **la remisión no activa la estrategia hipercalórica.** El paciente en remisión sigue la estrategia que le corresponda por su condición clínica y su estado funcional, y conserva la marca visible de antecedente oncológico.

La encuesta ya quedó separada en mi archivo. El ajuste del cálculo, para que deje de tomar las dos opciones por igual, lo aplican ustedes bajo la opción B.

### Sobre el acuerdo de envíos

Sigue vigente y no lo estoy retirando. Si vuelvo a mover el HTML, se los envío con la lista de cambios. Lo que cambia con la opción B es que ya no hace falta que yo mueva el archivo para que un cambio llegue a Atlas.

---

## 2. Profesiones que pueden aprobar el protocolo nutricional

**Pendiente. Lo cierro en el próximo envío**, con el sí o el no por cada profesión.

Un criterio que sí queda fijado desde ya: **quien no pueda aprobar el protocolo no queda bloqueado del resto.** Consultar el análisis completo, agregar notas clínicas y remitir son actos que corresponden a todas las profesiones de la red. Lo que se restringe es la aprobación de la prescripción de calorías y proteína, no el acceso a la información del paciente.

Pueden avanzar con esa parte mientras defino la lista.

---

## 3. Las dos clasificaciones estructurales

**Pendiente. Lo cierro en el próximo envío.**

Es una observación pertinente y no la habíamos detectado. Necesito revisar cuál de las dos corresponde al estado actual del modelo antes de responder, porque la decisión no es solo cuál se muestra: define qué queda escrito en el registro clínico de cada paciente.

Mientras tanto **no cambien lo que se está guardando.** Que los diagnósticos sigan registrando lo mismo que han registrado hasta ahora. Si la clasificación que manda resulta ser la otra, la salida no será reescribir lo emitido, sino dejar constancia en cada diagnóstico de la versión de clasificación con la que se emitió. La inmutabilidad del registro no se toca.

---

## 4. Estado de lo mío

| | Qué | Estado |
|---|---|---|
| P0 | Presentación de la edad biológica | En curso. Es lo primero que cierro, entendido que condiciona el reporte del paciente |
| P1 | Fórmula de gasto basal sobre el peso meta | En curso |
| P2 | Tabla de nutracéuticos por ruta | Registrado, sin fecha |
| P3 | Las tres secciones del manual de tratamiento | Registrado, sin fecha |

---

## 5. Resumen

| | Decisión |
|---|---|
| 1 | Opción B. Quedan autorizados a implementar los cambios de cálculo, con instrucción escrita mía y aprobación mía antes de producción |
| 1.1 | La corrección de cintura quedó pendiente de mi lado. El archivo que tienen es el vigente, no hay reenvío. La corrección la aplican ustedes |
| 1.2 | La remisión no activa el hipercalórico. El ajuste del cálculo lo aplican ustedes |
| 2 | Pendiente. Queda fijado que quien no aprueba el protocolo sí consulta, anota y remite |
| 3 | Pendiente. No cambien lo que se guarda hasta que responda |
| P0, P1 | En curso, P0 primero |
