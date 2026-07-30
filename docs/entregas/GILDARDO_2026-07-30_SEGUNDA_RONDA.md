# Pendientes para Gildardo — segunda ronda

**Fecha:** 30 de julio de 2026 · **De:** equipo Atlas · **Para:** dirección científica CNV

Gildardo: tu documento de decisiones resolvió casi todo. Con eso ya podemos avanzar en la mayor parte.

Quedan tres cosas: **una que necesitamos de ti para poder aplicar tus cambios**, **un acuerdo para adelante**, y **los asuntos que siguen abiertos** — cuatro que tú mismo dejaste marcados y cinco preguntas nuevas.

---

## 1. Lo que necesitamos primero: tu archivo actual

**Las líneas que citas en tu documento no coinciden con el HTML que nos entregaste en julio.**

Revisamos cinco ubicaciones distintas y todas caen sobre contenido diferente, y los desfases no son parejos:

| Tú citas | En nuestra copia, esa línea es |
|---|---|
| 14088 · gasto basal por Mifflin | la sección de remisiones |
| 14077 · motor nutricional | la sección de nutracéuticos |
| 14024–14031 · estrategia por fenotipo | un bloque de la pantalla de seguimiento |
| 12828–12878 · rangos de referencia | configuración de la vista |
| 6516–6529 · índice contextual y su interruptor | el puntaje de estilo de vida, sin ese interruptor |

Y no es solo que estén corridas: **es contenido distinto**. Tú describes Mifflin sobre el peso medido; nuestra copia calcula Cunningham. Eso es un cambio de fórmula, no un desplazamiento.

La explicación es simple y natural: **seguiste trabajando tu archivo después de pasárnoslo**. La copia que tenemos es del 24 de julio.

**Lo que necesitamos: tu versión actual, la misma desde la que escribiste el documento de decisiones.**

Por qué importa, sin rodeos: tu lista de trece cambios (C1 a C13) está escrita con números de línea. Si los aplicamos contra la copia vieja, tomamos el pedazo de código equivocado **y nada da error**. Es el tipo de problema que no se ve hasta que ya está en un paciente.

Cuando nos llegue, lo primero que haremos es comprobar que las líneas 14077, 14088, 6529 y 12828 caen sobre lo que tu documento describe. Si cuadran, aplicamos tus trece cambios directo.

Mientras tanto seguimos con todo lo que no depende del archivo.

---

## 2. Acuerdo para adelante

Para no volver a esta situación:

> **Cada vez que actualices el HTML, nos envías el archivo actualizado junto con una lista corta de qué cambiaste.**

No hace falta que sea formal: una línea por cambio basta ("cambié el gasto basal a Mifflin sobre peso meta", "agregué el grupo de carnes rojas al patrón"). Lo importante es el archivo y saber qué se movió.

Sin eso, cualquier referencia de línea que nos des apunta a un archivo que ya no existe, y nosotros no tenemos forma de saberlo hasta que algo sale mal.

---

## 3. Los cuatro asuntos que dejaste abiertos

### 3.1 · P0 — Cómo presenta Atlas la edad biológica *(el de mayor prioridad, según tu documento)*

Planteaste tres salidas. Te proponemos una cuarta, que combina lo mejor de las tres y aprovecha algo que Atlas tiene y tu prototipo no distingue: **son dos pantallas separadas**, la del profesional y el reporte que se lleva el paciente. Tú ya usas esa distinción en el Nivel IV, donde la fórmula sintética dice "solo referencia profesional, no se imprime".

Aplicando el mismo criterio:

- **Al profesional** se le muestra la cifra absoluta, con la nota visible de que la calibración es provisional. Tiene el contexto para interpretarla y necesita ver lo que produce el modelo para ejercer criterio.
- **En el reporte del paciente**, nunca la cifra absoluta. Desde la segunda medición se muestra el cambio: *"su edad biológica bajó 4 años respecto de la evaluación anterior"*, que es lo que el modelo sostiene hoy según tu propio análisis.
- **Siempre** se calcula y se guarda, con la versión de calibración registrada (tu cambio C2b), para poder reemitir toda la serie cuando exista la población.
- **El índice de aceleración del envejecimiento sigue la misma regla**, porque se calcula restando la edad cronológica de la biológica: si la absoluta no es interpretable, el IAE tampoco. Su cambio en el tiempo sí lo es.

Así el profesional no pierde información y el paciente no recibe un número sin respaldo poblacional. Y en la primera consulta sí hay edad biológica: la ve el profesional, no el paciente.

**Qué necesitamos de vuelta:** que confirmes esta salida, o que elijas una de tus tres. La parte clínica es tuya; nosotros solo proponemos la forma.

---

### 3.2 · P1 — Qué fórmula de gasto basal se usa sobre el peso meta

Planteaste el problema con precisión: Mifflin toma un peso corporal y acepta el peso meta sin dificultad; Cunningham toma masa libre de grasa, que es una medición, y no existe una masa libre de grasa del peso meta.

**Qué necesitamos de vuelta:** una de tus tres opciones.

1. Siempre Mifflin sobre el peso meta, y Cunningham se retira.
2. Cunningham cuando hay bioimpedancia, con la masa libre de grasa medida tal cual, aceptando que en ese caso el peso meta no interviene en el gasto basal aunque sí en la proteína.
3. Cunningham con una masa libre de grasa proyectada al peso meta, en cuyo caso necesitamos también la regla de proyección.

Como dijiste, esto decide las calorías que se le prescriben a una persona. Mientras no se cierre, implementamos el resto del punto 8 (la proteína sobre el peso meta y la estrategia por condición clínica).

---

### 3.3 · P2 — La tabla de nutracéuticos por ruta

Sigue pendiente: qué producto ocupa la primera, la segunda y la tercera posición en cada una de las seis rutas, y la regla para cuando un paciente active una ruta y a la vez caiga en un sector del mapa EFR con su propia lista.

**Sin fecha comprometida.** Lo anotamos para que no se pierda. Mientras tanto la vía por estado funcional sigue operando normalmente.

---

### 3.4 · P3 — Las tres secciones del manual de tratamiento

Igual: registrado, sin fecha. No lo pedimos ahora.

---

## 4. Preguntas nuevas

Estas cinco salieron al implementar. Cuatro son de la misma familia: decisiones tuyas que producen un efecto secundario que probablemente no estaba previsto.

### 4.1 · La fuerza prensil dejó de contar en tu criterio de sarcopenia

Definiste que la fuerza prensil se capture pero no entre al motor. Quedó una consecuencia que quizá no estaba prevista: **tu propio criterio de sarcopenia usa la prensil**, y sin ese dato una de sus ramas no se activa nunca.

En la práctica, hoy el diagnóstico de sarcopenia se apoya solo en masa muscular y ángulo de fase, no en fuerza.

**¿Lo dejamos así, o quieres que la prensil vuelva a contar para ese criterio?**

---

### 4.2 · El paciente con cáncer en remisión recibe el mismo protocolo que el activo

Tu motor detecta el cáncer por el texto de la respuesta de la encuesta, y la opción es una sola: *"Cáncer (activo/en remisión)"*. Así que un paciente en remisión activa la misma estrategia hipercalórica que uno con enfermedad activa.

Con tu decisión de que la estrategia pase a ser por condición clínica, la pregunta se vuelve más concreta: **¿"en remisión" cuenta como condición activa para efectos del protocolo, o debería seguir la estrategia que le corresponda por su condición general?**

Si son distintos, hace falta separar la opción de la encuesta en dos.

---

### 4.3 · El campo de cintura toma el umbral de referencia, no la medida

En tu función de importación, el campo de cintura lee la columna del **umbral de referencia de la OMS** (102 cm, igual para todos los pacientes) en vez de la circunferencia medida del paciente.

Hoy no afecta ningún cálculo, porque los índices cintura-cadera y cintura-talla se leen directamente del equipo. Pero si algún día algo se calculara desde ese campo, todos los pacientes tendrían el mismo valor.

De nuestro lado ya lo corregimos. **¿Lo corriges también en tu archivo, o prefieres dejarlo?**

---

### 4.4 · El peso meta como base del cálculo: dónde se captura y qué pasa si no hay

Decidiste que el gasto basal y la proteína se calculen sobre **el peso meta del módulo de antropometría**, no sobre el peso medido. Entendido.

Dos cosas que necesitamos precisar para implementarlo:

1. **¿El peso meta es obligatorio?** Es decir: si un paciente no tiene peso meta registrado, ¿no hay cálculo calórico, o hay algún valor de respaldo?
2. **¿Quién lo fija y cuándo?** ¿Lo pone el profesional en la primera consulta, lo propone el sistema, o el paciente lo declara?

Lo preguntamos porque hoy en Atlas el peso meta es un dato opcional que el profesional puede ajustar. Convertirlo en la base del cálculo lo vuelve obligatorio, y eso cambia el flujo de la consulta.

---

### 4.5 · El fenotipo F1–F12 en la pantalla de Diagnóstico

En tu prototipo, cuando el profesional abre el Diagnóstico ve el fenotipo estructural con su nombre: "F7 (Normopeso sarcopénico)", "F4 (Obesidad preclínica sarcopénica)", y así con los doce.

En Atlas hoy el profesional **no ve eso**. Ve el estado funcional bioeléctrico (el que sale del IFC y el IRC) y el sector EFR. Son dos formas distintas de clasificar al mismo paciente: la tuya es antropométrica (bandas de grasa y de músculo); la de Atlas es bioeléctrica.

Lo preguntamos por dos razones. La primera es que **los profesionales se están formando con tu HTML**, así que aprenden a hablar de "F7" y luego no lo encuentran en Atlas. La segunda es que hasta ahora tu motor de tratamiento usaba el F-number internamente; con tu decisión de retirar la estrategia por fenotipo, ese uso desaparece, y queda la pregunta de si el fenotipo tiene algún rol que conservar.

**Tres opciones:**

1. Se muestran los dos (el fenotipo F1–F12 y el estado bioeléctrico), porque dicen cosas distintas y se complementan.
2. Solo el fenotipo F1–F12, como en tu prototipo.
3. Solo el estado bioeléctrico, y el fenotipo desaparece también de la pantalla.

**Necesitamos esto antes de abrirle Atlas a los integrantes.**

---

## 5. Resumen de lo que necesitamos

| | Qué | Esfuerzo |
|---|---|---|
| **1** | Tu archivo HTML actual | envío |
| **2** | Acuerdo: cada actualización viene con archivo y lista de cambios | acuerdo |
| **3.1** | P0 · Confirmar la propuesta de edad biológica, o elegir una de tus tres | decisión |
| **3.2** | P1 · Cuál fórmula de gasto basal sobre el peso meta | decisión |
| **4.1** | Prensil: ¿vuelve a contar en el criterio de sarcopenia? | sí/no |
| **4.2** | Cáncer en remisión: ¿cuenta como activo? | sí/no |
| **4.3** | Cintura: ¿lo corriges en tu archivo? | sí/no |
| **4.4** | Peso meta: ¿obligatorio? ¿quién lo fija? | precisión |
| **4.5** | Fenotipo F1–F12 en Diagnóstico: cuál de las tres opciones | decisión |
| **3.3 / 3.4** | P2 y P3: tablas de nutracéuticos y manual de tratamiento | autoría, sin fecha |

Lo más urgente es el punto 1. Sin el archivo no podemos aplicar tus trece cambios.

---

## Anexo técnico *(para el equipo técnico de Gildardo)*

- **Punto 1 (identidad del archivo):** nuestra copia es `ATLAS.html` de la entrega del 2026-07-24, 16.724 líneas (renombrada de `ATLAS_v7.html` para no colisionar con una copia anterior en el repositorio). Cinco ubicaciones citadas en el documento de decisiones caen sobre contenido no relacionado, con desfases no uniformes, lo que descarta un simple corrimiento. Prueba de identidad propuesta para la versión nueva: que las líneas 14077, 14088, 6529 y 12828 caigan sobre lo descrito.
- **Contradicción del gasto basal, con evidencia aritmética:** la captura del Nivel IV muestra GEB 1946 para una paciente mujer de 110 kg y 169 cm (el sexo se deduce del peso ajustado 73,6, que solo sale con la fórmula de peso ideal Broca femenina). Mifflin femenino sobre peso medido da 1995,25 − 5·edad, con máximo 1895 a los 20 años: no puede producir 1946 a ninguna edad. Cunningham sí: 500 + 22 × 65,73 = 1946. Nuestra copia calcula Cunningham en la línea 14124.
- **Punto 4.1 (prensil):** `dxSarcopenia` depende de la fuerza prensil con respaldo en 0; la rama `sarcoDx.k >= 2` no se activa nunca en producción.
- **Punto 4.2 (remisión):** los flags clínicos se derivan por coincidencia de texto sobre la respuesta de encuesta. La opción única *"Cáncer (activo/en remisión)"* activa `tieneCancer` en ambos casos.
- **Punto 4.3 (cintura):** el campo mapea el encabezado `...Waist Size...REFERENCEESTIMEE...cm` en vez de `Waist Size cm`. Corregido de nuestro lado como divergencia deliberada y documentada; los ratios ICC e ICT se leen del export y sí usan la medida real.
- **Punto 4.4 (peso meta):** en Atlas el peso meta existe hoy como ajuste opcional del profesional, con respaldo al peso de cálculo. La decisión del punto 8 lo convierte en la base, lo que elimina ese respaldo y lo vuelve una dependencia obligatoria.
- **Advertencia recibida y aplicada:** las etiquetas R1 a R9 se usan también para los anillos del mapa de estados funcionales. Registrada en nuestra documentación de arquitectura como trampa de implementación.
