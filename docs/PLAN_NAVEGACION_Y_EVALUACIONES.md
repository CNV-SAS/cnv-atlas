# Plan conjunto: la navegación (b) y las evaluaciones que estorban (L) — 2026-09-20

> **ESTADO: las dos construidas (2026-09-20).** Y el estado no se afirma, se corre:
> `pnpm vitest run src/tests/volver-a-navegacion.test.ts src/tests/historial-evaluaciones.test.ts`.
>
> **Una cosa salió distinta del plan, y a mejor.** El plan hablaba de arreglar el DESTINO del enlace; al
> construirlo quedó claro que el defecto del SOAP tenía dos mitades, y la segunda era el TEXTO: decía
> "Volver a la evaluación" porque alguien lo escribió a mano el día que solo había una vía de entrada.
> Así que el rótulo también se deriva ahora del destino (`etiquetaDeDestino`), y `VolverA` ya no recibe
> texto. Es la misma lección de `etapas.ts`: un texto que nombra un sitio, escrito a mano, sobrevive a
> que su premisa deje de ser cierta.

> **Lo que el candado NO cubre, dicho aquí para que no se lea como cubierto:** que un enlace NUEVO hacia
> una pantalla de detalle se acuerde de llevar el origen. Si se olvida, la vuelta sigue funcionando (cae
> al padre declarado), así que es una oportunidad perdida, no un defecto: por eso no hay candado, que
> tendría que adivinar qué enlaces son navegación de verdad.

Santiago pidió planear las dos juntas y ejecutarlas juntas. **Tienen más en común de lo que parece**, y por
eso la planeación conjunta sale mejor que dos planes seguidos: las dos son sobre **cómo se recorre el
trabajo**, no sobre qué hace el sistema.

---

# Parte 1 · La navegación (observación b)

**Lo que él plantea:** breadcrumbs dinámicos ("volver a donde estabas") o fijos ("la ruta que nosotros
elijamos").

## 1.1 El diagnóstico: hoy hay tres comportamientos distintos

| Dónde | Qué hace hoy |
|---|---|
| Pantallas con `VolverA` (encuesta, corregir, SOAP) | Un enlace fijo, escrito a mano en cada una. El del SOAP decía "Volver a la evaluación" cuando se venía de Reporte/HC: lo corregí ayer **a mano**, que es justo el síntoma |
| Pestañas de la evaluación | Viven en la URL (`?etapa=`), así que el navegador las recuerda |
| El resto | No hay rastro de por dónde se entró |

**El problema no es que falte un componente: es que cada pantalla decide sola a dónde vuelve, y lo decide
al escribirla.** Cuando aparece una vía de entrada nueva (como el SOAP desde Reporte/HC), el enlace viejo
miente. Eso ya pasó una vez y se arregló a mano; va a volver a pasar.

## 1.2 Las dos opciones, con lo que cuesta cada una

| | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **Dinámico** ("volver a donde estabas") | La pantalla lee de dónde vino (un parámetro en la URL, puesto por quien enlaza) | Nunca miente: dice exactamente de dónde viene | Cada enlace tiene que pasarlo; si alguien llega por un enlace pegado o un marcador, no hay origen y hay que tener un destino por defecto |
| **Fijo** (ruta que elegimos) | Cada pantalla tiene un padre declarado, siempre el mismo | Predecible, y no depende de cómo se llegó | Miente cuando hay dos vías de entrada, que es el caso del SOAP |

**Recomiendo el dinámico con respaldo fijo**, que es lo que hacen los sistemas que funcionan: **si hay
origen, se usa; si no, el padre declarado.** Así el enlace nunca queda sin destino y nunca dice una mentira.

## 1.3 Qué se construye

1. **Un componente único** (`VolverA` ya existe: se le añade la lógica) que recibe un padre por defecto y
   lee el origen de la URL.
2. **Un helper para enlazar** que añade el origen automáticamente, para que el que escribe un enlace nuevo
   no tenga que acordarse.
3. **El barrido:** las pantallas que hoy tienen `VolverA` escrito a mano pasan al mecanismo.
4. **Candado:** que ninguna pantalla escriba su "volver" a mano por fuera del componente. Es lo único que
   impide que el defecto vuelva a entrar por la siguiente pantalla nueva.

**Lo que NO se construye:** una barra de breadcrumbs con la ruta completa ("Pacientes › Juan › Evaluación ›
SOAP"). En una aplicación donde se trabaja dentro de UNA evaluación, esa barra ocupa una línea en cada
pantalla para decir algo que el profesional ya sabe. Un solo "volver", bien puesto, hace el trabajo.

---

# Parte 2 · Las evaluaciones que estorban (observación L)

**Lo que él plantea:** *"¿Hay forma de eliminar las evaluaciones ya cerradas? Es que parecen molestas que
sigan en el historial."*

## 2.1 Lo primero: borrar, no

Una evaluación arrastra diagnóstico sellado, tratamiento, reporte y su rastro de auditoría. Borrarla rompe
la trazabilidad que la regla dura 8 protege, y deja eventos de auditoría apuntando a algo que ya no existe.
Es la misma razón por la que los pacientes se **archivan** y no se borran.

## 2.2 Y lo segundo: no todas las que estorban son iguales

Con los datos de "Hhh Ooo" (tres seguimientos y una sola medición) quedó claro que hay **tres cosas
distintas** mezcladas en el historial, y cada una pide algo diferente:

| Qué es | Cómo se reconoce | Qué debería pasar |
|---|---|---|
| **Cascarón** | Sin respuestas de encuesta, sin medición | Se retira del historial. Ya existe el acto ("cerrar evaluación"), lo que falta es que deje de aparecer |
| **A medias** | Con respuestas, sin medición o sin diagnóstico | **No se oculta**: es trabajo pendiente, y esconderlo es perderlo. Debería estar señalado, no escondido |
| **Terminada** | Con diagnóstico y reporte enviado | Se pliega: es historia, y la historia no estorba si no ocupa la pantalla |

**Esa distinción es la decisión de producto que faltaba**, y es lo que convierte la (L) de "un botón de
borrar" en algo que se puede construir sin perder nada.

## 2.3 Qué se construye

1. **Un interruptor en el historial del paciente**: *"Mostrar las terminadas"*, apagado por defecto. Las
   terminadas se pliegan; las **a medias** siguen visibles siempre, con su pendiente dicho.
2. **Los cascarones se retiran** con el acto que ya existe (cerrar evaluación), y dejan de listarse.
3. **Nada se borra**, y el interruptor lo dice en una línea: están, no se han ido.
4. **Candado:** que una evaluación **a medias nunca se oculte**. Es la parte que puede salir mal en
   silencio, y la que de verdad importa: ocultar trabajo pendiente es perderlo.

---

# Por qué juntas

Las dos tocan **la misma pantalla** (el historial del paciente y la vuelta desde la evaluación) y las dos
son decisiones de recorrido. Hacerlas seguidas significa tocar esa pantalla una vez y probarla una vez.

**Tamaño conjunto: una tanda.** La navegación es la mitad más grande (el barrido de las pantallas que
tienen su "volver" a mano); la (L) es sobre todo una decisión, y una vez tomada, poco código.

**Orden propuesto:** primero la (L), porque su decisión ya está tomada arriba y deja el historial limpio;
después la navegación, que se aprovecha de que el historial ya es el sitio al que se vuelve.
