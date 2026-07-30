# Pendientes para Gildardo — tercera ronda

**Fecha:** 30 de julio de 2026 · **De:** equipo Atlas · **Para:** dirección científica CNV

Gildardo: tu archivo llegó y **pasó la prueba de identidad** — las líneas que citas caen sobre el código que describen, así que podemos aplicar tus trece cambios.

Quedan **tres preguntas** y un recordatorio. La primera es la que nos frena.

---

## 1. ¿Quién aplica los cambios que tocan el cálculo?

En tus documentos hay dos tipos de decisión, y necesitamos tratarlas distinto.

**Las que son contenido o presentación** —cómo se rotula el fenotipo, qué muestra la casilla del total, qué dice un texto— las aplicamos nosotros sin problema.

**Las que cambian cómo calcula el modelo** son otra cosa, y ahí tenemos una regla que consideramos importante: **no tocamos tu ciencia por nuestra cuenta.** Todo el sistema de verificación que construimos existe para poder afirmar que lo que Atlas calcula es lo que tú escribiste, dígito a dígito. Si cambiamos una fórmula sin que venga de ti, esa garantía se cae.

**La pregunta es cuál es el camino:**

- **Opción A.** Las haces tú en tu archivo y nos mandas la versión nueva. Nosotros solo portamos.
- **Opción B.** Nos autorizas a implementarlas de nuestro lado, siguiendo exactamente lo que escribiste.

**La respuesta nos sirve para los trece cambios de tu primer documento**, no solo para los dos casos de abajo. Es lo que más nos condiciona ahora mismo.

### 1.1 · El caso concreto: la corrección de cintura no está en el archivo

En tu segunda respuesta escribiste: *"La corrección del campo de cintura va incluida en ese envío."*

Revisamos el archivo que llegó y **la línea 5600 sigue leyendo la columna del umbral de referencia de la OMS**, no la circunferencia medida del paciente. Es el mismo comportamiento que te reportamos.

Hay dos explicaciones posibles y necesitamos saber cuál es:

1. **La corrección quedó pendiente.** La decidiste pero no alcanzaste a aplicarla.
2. **Nos enviaste una versión anterior.** La prueba de identidad que corrimos verifica las líneas que citas en tu documento del 29 de julio. La corrección de cintura la anunciaste el 30. Es posible que el archivo sea tu estado del 29 y no el más reciente.

Si es la segunda, hay que reenviarlo, y todo lo que portemos de este archivo estaría desactualizado en un día.

### 1.2 · El otro caso: cáncer en remisión

Decidiste que un paciente en remisión no reciba la estrategia hipercalórica.

En tu archivo nuevo **la encuesta ya tiene las dos opciones separadas** (cáncer activo y en remisión), pero **el cálculo sigue buscando la palabra "cáncer"** y toma las dos por igual. Así que la remisión sigue recibiendo el hipercalórico.

Separaste la pregunta; falta cambiar el cálculo.

> **Recordatorio del acuerdo:** si tocas el HTML, nos lo vuelves a enviar con la lista breve de qué cambió. Sin eso, tus números de línea dejan de ser verificables de nuestro lado.

---

## 2. ¿Qué profesiones pueden aprobar el protocolo nutricional?

Atlas ya sabe qué profesión tiene cada integrante y decide con eso qué ve en pantalla. Falta la otra mitad: **qué puede hacer cada uno.**

El caso concreto: el protocolo del Nivel IV prescribe calorías y proteína. Un nutricionista claramente puede aprobarlo. Un médico también, dentro de su alcance. **¿Un deportólogo? ¿Un psicólogo?**

Hoy el sistema deja aprobar el protocolo a cualquier profesional asignado al paciente, sin importar su disciplina. Eso probablemente no es lo que quieres.

**Qué necesitamos:** para cada profesión con la que vamos a arrancar (nutricionista, médico y deportólogo), si puede o no aprobar el protocolo nutricional. Un sí o un no por cada una basta.

Y si hay actos que sí puede hacer aunque no apruebe el protocolo —consultar el análisis, agregar notas, remitir— dínoslo, para no bloquear de más.

---

## 3. Hay dos clasificaciones estructurales, no una

En tu respuesta anterior aclaraste bien la diferencia entre el mapa estructural (FMI × FFMI) y el funcional (IFC × IRC), y decidiste que se muestren los dos. Eso está claro.

Pero al implementarlo encontramos algo que no habíamos visto: **en tu modelo hay dos clasificaciones distintas sobre el mismo eje estructural.**

| Clasificación | Ejes | Cuántos estados |
|---|---|---|
| La que Atlas guarda hoy en el diagnóstico | FMI × FFMI | **9** |
| El fenotipo F1 a F12 (MCCB) | FMI × FFMI | **12** |

Las dos salen de tu prototipo. La de 9 estados es la que Atlas viene guardando en el registro clínico de cada paciente desde el principio; la de 12 es la que pediste mostrar.

**Qué necesitamos saber:**

1. ¿Las dos son tuyas y conviven a propósito, o una reemplaza a la otra?
2. **¿Cuál debe quedar guardada en el registro clínico del paciente?** Esto importa más de lo que parece: los diagnósticos ya emitidos guardan la de 9 estados, y son inmutables. Si la de 12 es la que manda, hay que decidir qué hacer con lo ya guardado.
3. ¿Y qué se le muestra al profesional en pantalla: las dos, o solo una?

---

## 4. Recordatorio de lo tuyo

Sin nada nuevo de nuestra parte:

| | Qué | Nota |
|---|---|---|
| **P0** | Presentación de la edad biológica | Dijiste que es lo primero que cierras. Es la que más nos condiciona: define qué ve el paciente en su reporte, y no podemos atender pacientes reales sin resolverla |
| **P1** | Fórmula de gasto basal sobre el peso meta | Bloquea solo esa parte del cálculo |
| **P2** | Tabla de nutracéuticos por ruta | Sin fecha, registrado |
| **P3** | Las tres secciones del manual de tratamiento | Sin fecha, registrado |

---

## 5. Lo que estamos haciendo mientras tanto

Para que sepas que nada está detenido esperándote:

- Exponiendo las funciones de tu motor que estaban escritas pero no accesibles, para llenar la card de abordaje por profesión.
- Transcribiendo los rangos de referencia (líneas 12828 a 12878) tal como los dejaste, sin cambiar un valor. Eso llena las columnas de referencia que hoy aparecen vacías en la tabla de indicadores.
- Conectando dos clasificadores que ya existían en tu motor y que nosotros no estábamos llamando: por eso el ángulo de fase y el radio de impedancia aparecían sin clasificación.
- Portando las pestañas de medicina y de ejercicio, para que los médicos y deportólogos de la red no reciban una pantalla vacía.

---

## Resumen

| | Qué necesitamos | Esfuerzo |
|---|---|---|
| **1** | Quién aplica los cambios que tocan el cálculo: ¿tú o nosotros? | decisión |
| **1.1** | ¿La corrección de cintura quedó pendiente, o nos enviaste una versión anterior? | verificación |
| **2** | Qué profesiones pueden aprobar el protocolo nutricional | sí/no por profesión |
| **3** | Cuál de las dos clasificaciones estructurales manda, y cuál se guarda | decisión |
| **4** | P0 y P1 cuando puedas. P0 es la que más nos condiciona | decisión |

Lo demás está registrado y no requiere acción tuya ahora.
