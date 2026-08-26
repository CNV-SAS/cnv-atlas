# Mapa de Atlas · qué consume cada pantalla y qué llega del instrumento

**De:** Equipo Atlas
**Para:** Gildardo Uribe, Dirección Científica CNV
**Fecha:** 26 de agosto de 2026

Este documento existe para que puedas contestar el **8.5** (*"¿qué otras salidas del modelo no están
llegando a donde deberían?"*) y el **3.5**. Dijiste que no podías hacerlo sin ver el software, y tienes
razón a medias: **el problema no era el acceso, era que lo que necesitas no se ve usando Atlas.**

Aquí está la mitad que te faltaba. Es un documento largo, pero es de consulta: puedes ir directo a la
parte que te interese.

---

## Cómo leer esto

Hay una pieza intermedia entre tu instrumento y tu modelo que no existe en tu archivo, y sin ella nada
de esto se entiende: el **`field_key`**.

En tu archivo, la respuesta a una pregunta y la variable que consume el motor son **la misma cosa**:
escribes `enc.d3_31` y ahí está. En Atlas están separadas, porque las respuestas viven en una base de
datos y las preguntas cambian de versión. El `field_key` es la etiqueta que dice *"esta pregunta, al
guardarse, se convierte en la variable `d3_31` del motor"*.

Y de ahí sale la consecuencia importante:

> **Una pregunta sin `field_key` se muestra, el paciente la responde, se guarda en su historia, y el
> motor nunca la ve.** No falla nada. No hay error. Simplemente el cálculo corre sin ese dato.

Ese es el estado de **25 de tus 64 preguntas** hoy, y es lo que estamos arreglando.

---

# Parte A · El instrumento: las 64 preguntas y cuáles llegan

Tres estados posibles:

- **Sí**: tiene `field_key` y hay algo en Atlas que la consume.
- **Sí, sin consumidor aún**: el dato llega, pero lo que lo consume es un motor que todavía no hemos
  portado. Se conecta solo cuando el porte llegue.
- **NO**: no tiene `field_key`. El dato no sale del formulario.

**Alimentación**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 1 | Verduras y hortalizas (frecuencia de consumo) | `d1_1_i` | **Sí** |
| 2 | Frutas enteras (frecuencia de consumo) | `d1_2_i` | **Sí** |
| 3 | Leguminosas (frecuencia de consumo) | `d1_3_i` | **Sí** |
| 4 | Pescado y mariscos (frecuencia de consumo) | `d1_4_i` | **Sí** |
| 5 | Grasas saludables (frecuencia de consumo) | `d1_5_i` | **Sí** |
| 6 | Lácteos y fermentados (frecuencia de consumo) | `d1_6_i` | **Sí** |
| 7 | Huevos (frecuencia de consumo) | `d1_7_i` | **Sí** |
| 8 | Cereales integrales y otros (frecuencia de consumo) | `d1_8_i` | **Sí** |
| 9 | Raíces, tubérculos y plátanos (frecuencia de consumo) | `d1_9_i` | **Sí** |
| 10 | Carnes blancas (frecuencia de consumo) | `d1_10_i` | **Sí** |
| 11 | Cereales refinados y harinas blancas (frecuencia de consumo) | `d1_11_i` | **Sí** |
| 12 | Carnes procesadas y embutidos (frecuencia de consumo) | `d1_12_i` | **Sí** |
| 13 | Azúcares añadidos y bebidas azucaradas (frecuencia de consumo) | `d1_13_i` | **Sí** |
| 14 | Ultraprocesados (PCBU) (frecuencia de consumo) | `d1_14_i` | **Sí** |
| 15 | Carnes rojas (frecuencia de consumo) | `d1_15_i` | **Sí** |
| 16 | ¿Con qué frecuencia añade sal extra a la comida ya servida? | `d1f_sal_i` | **Sí** |
| 17 | ¿Desayuna regularmente (antes de las 10 am)? | `d1f_des_i` | **Sí** |
| 18 | ¿A qué hora suele cenar? | `d1f_noche_i` | **Sí** |

**Percepción corporal**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 19 | ¿Cómo percibe su cuerpo actualmente? | `d2_19` | **Sí** |
| 20 | ¿Qué tan satisfecho/a está con su peso? | `d2_20` | **Sí** |
| 21 | ¿Qué métodos ha usado para cambiar su peso? | `d2_21` | **Sí** |
| 22 | ¿Con qué frecuencia pierde el control al comer? | `d2_22` | **Sí** |

**Hábitos**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 23 | ¿Cuántos días/semana hace actividad física (≥30 min)? | `d3_23` | **Sí** |
| 24 | ¿Cuánto dura cada sesión? | `d3_24` | **Sí** |
| 25 | ¿Qué tipo de actividad realiza? | (ninguno) | **NO** |
| 26 | ¿Cuántas horas duerme por noche? | `d3_26` | **Sí** |
| 27 | ¿Cómo califica la calidad de su sueño? | (ninguno) | **NO** |
| 28 | ¿Ronca durante el sueño? | (ninguno) | **NO** |
| 29 | Nivel de estrés en el último mes (1 = sin estrés, 10 = máximo) | `d3_29` | **Sí** |
| 30 | ¿Su relación con el tabaco / nicotina? | `d3_30` | **Sí** |
| 31 | ¿Con qué frecuencia consume alcohol? | (ninguno) | **NO** |

**Conductas alimentarias**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 32 | ¿Cuántas comidas hace al día? | (ninguno) | **NO** |
| 33 | ¿Desayuna regularmente? | (ninguno) | **NO** |
| 34 | ¿Sigue algún patrón alimentario? | (ninguno) | **NO** |
| 35 | ¿Qué suplementos toma actualmente? | (ninguno) | **NO** |

**Antecedentes y estilo de vida**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 36 | ¿Le han diagnosticado hipertensión arterial? | `d5_36` | **Sí** |
| 37 | ¿Toma medicamentos para la presión arterial? | (ninguno) | **NO** |
| 38 | ¿Familiares cercanos con estas enfermedades? | `d5_38` | **Sí** |
| 39 | ¿Tiene alguno de estos diagnósticos personales? | `d5_39` | **Sí** |
| 40 | ¿Qué medicamentos toma actualmente? | `d5_40` | **Sí** |
| 41 | ¿Fue amamantado/a en su infancia? | (ninguno) | **NO** |
| 42 | ¿Exposición habitual a contaminantes? | (ninguno) | **NO** |

**Alergias y digestión**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 43 | ¿Alergias alimentarias diagnosticadas? | (ninguno) | **NO** |
| 44 | ¿Intolerancias alimentarias? | (ninguno) | **NO** |
| 45 | ¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo? | (ninguno) | **NO** |
| 46 | Hinchazón abdominal | (ninguno) | **NO** |
| 47 | Gases / flatulencia | (ninguno) | **NO** |
| 48 | Dolor abdominal | (ninguno) | **NO** |
| 49 | Diarrea | (ninguno) | **NO** |
| 50 | Estreñimiento | (ninguno) | **NO** |
| 51 | Reflujo / acidez | (ninguno) | **NO** |
| 52 | Náuseas | (ninguno) | **NO** |

**Hidratación**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 53 | Café (tazas por día) | (ninguno) | **NO** |
| 54 | Té (tazas por día) | (ninguno) | **NO** |
| 55 | Jugos naturales (vasos por día) | (ninguno) | **NO** |
| 56 | Gaseosas (vasos por día) | `d7_55` | **Sí** |
| 57 | Agua (vasos de 200 ml por día) | `d7_agua` | **Sí** |
| 58 | Bebidas energéticas (latas por día) | `d7_56` | **Sí** |
| 59 | ¿Siente sed con frecuencia? | `d7_57` | Sí, sin consumidor aún |
| 60 | ¿Color de su orina habitualmente? | (ninguno) | **NO** |

**Contexto social**

| P | Pregunta | Nuestro `field_key` | ¿Llega al motor? |
|---|---|---|---|
| 61 | ¿Quién prepara sus alimentos habitualmente? | `d8_59` | **Sí** |
| 62 | ¿Con qué frecuencia come fuera de casa? | `d8_60` | **Sí** |
| 63 | ¿Tiene acceso fácil a alimentos frescos y saludables? | `d8_61` | **Sí** |
| 64 | ¿Hay momentos en que no tiene suficiente comida en el hogar? | `d8_62` | **Sí** |

## Resumen de la Parte A

| | Cuántas |
|---|---|
| Preguntas del instrumento | **64** |
| Con `field_key`, el dato llega | **39** |
| **Sin `field_key`, el dato NO llega** | **25** |

Y dos dominios completos, **Conductas alimentarias** y **Alergias y digestión**, no tienen **ni un solo**
`field_key`. Nada de lo que el paciente responde en esos dos dominios llega a ningún motor. Ahí están el
patrón alimentario y las alergias.

**Esto no requiere decisión tuya. Es trabajo nuestro y ya está en curso.**

---

# Parte B · Tus motores: qué está portado y qué no

| Tuyo | ¿Portado? | Nota |
|---|---|---|
| `computeDFI` | **Sí** | Con la salvedad de la Parte D |
| `calcPatron` | **Sí** | Alimenta la vista de patrón alimentario |
| `cap` (capacitancia) | **Sí** | `CAP_REF` y `capRef()` del archivo nuevo están **en cola**, no portados aún |
| `motorTratMedico` | **Sí** | |
| `motorTratEjercicio` | **Sí** | |
| `motorTratPsico` | **Sí** | |
| **`motorTratNutri`** | **NO** | Estaba bloqueado por el 1.1 al 1.4. Lo desbloqueaste el 26; es lo siguiente que portamos |
| **El constructor de texto clínico** (tu L13172) | **NO** | Es el que citaste en el 3.1. Nunca lo habíamos identificado como pieza aparte |
| `compFill` | **NO** | |

**El constructor de texto clínico es un hallazgo tuyo**, no nuestro: apareció porque nos corregiste el
inventario. No lo teníamos en la lista de piezas por portar. Es una pieza que lee bastante de la encuesta
y produce texto para el profesional, y hasta tu Parte 2 no sabíamos que existía como cosa separada.

---

# Parte C · Las pantallas de Atlas y qué muestra cada una

Atlas organiza la consulta en **cinco pestañas**, en este orden.

## 1 · Evaluación

Dos subpestañas: **Antropometría y BIS** (los datos que entran del equipo Biody, o a mano) y **Encuesta**
(las 64 preguntas, con su estado de completitud).

Es la pestaña de entrada de datos. No muestra salidas del modelo.

## 2 · Diagnóstico

Tres subpestañas:

- **Composición Corporal** , la tabla de indicadores con sus cortes y colores: FMI, FFMI, ASMI, SMM/W,
  ECM/BCM, capacitancia, ángulo de fase, agua, y el resto. Es donde vive la tabla de Wang.
- **Diagnóstico Funcional** , el DFI con sus ocho dominios, la Diana, y los índices: IFC, IRC, PABU,
  ICA-BIS, ISCM, IEHH, IAE, EB-BIS.
- **Diagnóstico Encuesta** , la lectura del instrumento: patrón alimentario, dominios de la encuesta.

## 3 · Tratamiento

- **Rutas de atención** , las remisiones por disciplina que producen tus cuatro motores.
- **Plan** , objetivo calórico y la cadena que lo produce, macros, restricciones del modelo,
  restricciones del profesional, distribución por grupos, tiempos de comida, menú generado por IA,
  nutracéuticos.

**Aquí está el hueco más grande, y es el de tu 3.2:** el plan se arma **sin** el patrón alimentario y
**sin** las alergias, porque son dos de las 25 que no llegan.

## 4 · Seguimiento

La comparación entre controles: la tabla de cambios por indicador, las líneas de serie, el aviso de
trayectoria (mejoró / estable / empeoró) y la fecha de próximo control.

## 5 · Reporte / HC

Dos documentos distintos, y esto es lo que resolviste en el 7.1:

- **La historia clínica** , el documento del profesional y de la institución. Lleva todo, incluidos los
  índices y la EB-BIS. **No la recibe el paciente.**
- **El reporte del paciente** , lo que se le envía. Hoy lleva lo que nos dijiste que **no debe llevar**:
  IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código `N_N_N_A`. Estamos rehaciéndolo con tu lista del 7.1.

---

# Parte D · Respuesta directa a tu 8.5: qué no está llegando a donde debería

Esto es lo que preguntaste. Son cuatro cosas, en orden de gravedad.

## D1 · Dos dominios del DFI están clavados en el mismo valor para todos los pacientes

`calcLE8` lee `d1_9`, `d1_10` y `d1_16`, que **no existen en la encuesta**: solo viven en el objeto de
demostración. En un paciente real las tres dan cero, y entonces **Alimentación queda en 30 y Hidratación
en 20, para todo el mundo**.

Dos de los ocho dominios no discriminan a nadie. Tenemos el mapeo correcto escrito y desactivado detrás
de un interruptor, porque encenderlo cambia el diagnóstico de todos los pacientes ya evaluados. Va como
pregunta 2 de la ronda.

## D2 · El plan nutricional se arma sin patrón alimentario y sin alergias

Lo encontraste tú en el 3.2. La causa es la de la Parte A: ninguna de las dos tiene `field_key`, así que
el generador no puede verlas ni aunque quisiera. **Es lo primero que estamos construyendo.**

## D3 · Tus motores de tratamiento leen una fracción del instrumento

Lo dijiste tú y lo confirmamos: `motorTratNutri` lee 5 campos, `motorTratMedico` 3 y `motorTratEjercicio`
2. Pero el techo real es más bajo de lo que parece, porque **de esos campos, los que no tienen
`field_key` llegan vacíos**. Tu ejemplo del alcohol es exactamente eso: `d3_31` tiene consumidores en tu
archivo y en Atlas nunca llega, así que portar esos consumidores sin arreglar el `field_key` produciría
código que lee la cadena vacía.

## D4 · El reporte del paciente lleva lo que dijiste que no debe llevar

Ya resuelto por tu 7.1, en construcción. Lo dejamos anotado aquí para que el mapa quede completo.

---

# Parte E · Respuesta a tu 3.5: qué más

Tu 3.5 preguntaba qué más hay de esta familia. La respuesta honesta, después de hacer este mapa:

**La familia es una sola y tiene un nombre: el `field_key`.** Casi todo lo que encontramos, y todo lo que
encontraste tú, es la misma cosa vista desde ángulos distintos: una pregunta que el paciente contesta y
que no llega al cálculo. No son defectos sueltos en sitios distintos; son **25 instancias de un mismo
hueco**, y por eso se arreglan juntas y no de a una.

Lo que **no** es de esa familia, y que conviene que sepas que existe:

- **La capacitancia no tenía referencia** hasta tu entrega del 26. Ya la tiene (`CAP_REF`), pendiente de
  portar.
- **`notas_profesional` se sobrescribe en cada control** y no la lee nadie. Lo verificaste tú en el 8.3.
- **Tres defectos de tu pantalla** que te reportamos al portar la historia clínica y que quedaron sin
  comentar. Van renumerados en la ronda: el serio es que **la fecha de la firma es la fecha de
  impresión**, en un documento probatorio.

---

# Y una cosa práctica sobre por qué el acceso no te sirvió

Tienes cuenta en Atlas desde hace semanas. Que no te haya servido para contestar el 8.5 no es por falta
de permisos: es que **la herramienta con la que trabajas lee archivos que tengas en tu computador**. No
navega a Atlas, no tiene nuestro repositorio y no puede entrar con tu cuenta.

Por eso este documento sirve y un usuario y contraseña no. Si además quieres el código, dilo y te
mandamos una copia en archivos.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
