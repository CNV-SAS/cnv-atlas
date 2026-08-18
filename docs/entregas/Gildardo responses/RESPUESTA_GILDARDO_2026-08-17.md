
Respuesta a la ronda del 2026-08-15
De: Gildardo Uribe — Dirección Científica CNV
Para: Equipo Atlas
Fecha: 17 de agosto de 2026
Respondo los seis puntos y los dos menores. Dos de ellos —el 3 y el 6— no eran preguntas abiertas: la respuesta ya estaba escrita en mi archivo y ustedes no tenían por qué saberlo. Lo señalo primero donde corresponde, porque les ahorra trabajo de diseño.

1. Región y altitud · residencia prolongada, y sí, va una pregunta más
Agreguen la pregunta. Su análisis es correcto y el argumento que dan es el que decide: la adaptación a la altura —hematocrito, agua corporal, y por ellos el reparto AEC/AIC— viene de vivir años en altura, no de dónde está el paciente hoy. Derivar la altitud de la residencia actual produciría una variable que parece medir adaptación y no la mide, y eso es peor que no tenerla: un dato mal etiquetado contamina todo análisis que lo use y nadie lo nota.
Lo que pedí el 15 fue "región de origen o de residencia prolongada". La residencia actual no es ninguna de las dos.
La pregunta, una sola:
¿En qué ciudad o municipio vivió la mayor parte de su vida?
Con la misma lista de ciudades que ya tienen, la misma opción "Otra", y la misma regla que fijaron para la ciudad actual: "Otra" o texto libre → sin altitud, no se inventa. De esa ciudad derivan altitud, departamento y región, exactamente con la tabla ciudad → altitud (IGAC/DANE) que ya construyeron.
Tres precisiones para que no crezca:
No pregunten años de residencia. "La mayor parte de su vida" ya es la pregunta; añadir la cuantificación duplica la carga y no cambia lo que vamos a hacer con el dato.
La ciudad actual se queda donde está y sigue sirviendo para lo que sirve: contacto, región de atención, logística. No alimenta la altitud.
Cuando las dos coincidan —que será el caso mayoritario— no hay nada especial que hacer; la coincidencia es en sí misma información de estabilidad residencial.
El mismo límite de uso que la ascendencia: la altitud entra como variable de caracterización y de exploración. Ningún índice del sistema se ajusta por altitud mientras no tengamos evidencia propia sobre nuestra cohorte. Si el efecto existe, lo mediremos; no lo vamos a suponer con un coeficiente.
Con esto el bump de encuesta queda desbloqueado por mi lado.

2. El Δ · contra el borde, y el borde es el que decide el diagnóstico
Va contra el borde. Su lectura es la correcta y coincide con la mía, así que la aplico sin más discusión — pero con una precisión que importa, porque "el borde" a secas es ambiguo.
No es el borde más cercano. Es el límite del rango que decide la clasificación en esa fila.
El punto medio es defendible en estadística y engañoso en clínica. El FFMI de su tabla lo muestra: 19,90 en un rango 17–25 es un valor normal, y contra el punto medio sale −1,10, que en una columna encabezada "Δ" y pintada de rojo se lee como déficit. No hay déficit. La columna Δ de esta tabla es de lectura clínica: dice cuánto falta para cruzar el límite, o cuánto se pasó de él. Contra el centro no dice nada accionable.
Los límites por fila, tal como quedan (Nivel V a Nivel II):
Fila
Límite que gobierna el Δ
Sentido
IMC
24,9
superior
Circunferencia de cintura
94 (H) · 80 (M)
superior
ICC
0,90 (H) · 0,85 (M)
superior
ICT
0,50
superior
FFMI
17 (H) · 15 (M)
inferior
FMI
6 (H) · 9 (M) — ver corrección abajo
superior
ASMI
7,0 (H) · 5,5 (M)
inferior
SMM/W
27 (H) · 24 (M)
inferior
AEC % (con y sin grasa)
40
superior
AIC % (con y sin grasa)
65
inferior
E/I (con y sin grasa)
0,40
superior
Ángulo de fase
6,5 (H) · 6,0 (M)
inferior
IR
0,78 (H) · 0,82 (M)
superior
AEC/MCA
0,45
superior
ACT/MLG
74
superior

Y una corrección que sale de su propia tabla: el FMI de mi archivo está mal en el display. La fila muestra rango 6–9 en hombres y 9–13 en mujeres, y calcula el Δ contra 9 y contra 13. El clasificador cFMI dice otra cosa: hombres normal 3–6, mujeres normal 5–9. Su 3–6 es el bueno para hombres. Para mujeres no es 3–6 sino 5–9, ojo con eso. Esta es exactamente la corrección "tabla contra motor para FMI" que ya les había dado; ahora tienen el número. Cuando corrijan un clasificador contra el motor, corrijan también el rango que se muestra — si no, el Δ queda medido contra un borde que la clasificación ya no usa.
Dónde no aplica esta regla: en la columna Referencia de la tabla de Antropometría no hay rango sino un valor de referencia. Ahí el Δ es y sigue siendo valor − referencia. Son dos tablas distintas y las dos están bien; lo que no puede pasar es que se mezclen los criterios. Eso responde también el primero de sus menores.

3. "Manda el motor" · es general, y ya estaba escrito
Es general. Todos los clasificadores, sin excepción. IFC, IRC y FMI no eran una lista: eran los tres que habían aparecido hasta ese día.
No es una decisión nueva. Está en mi archivo, sobre _DFI_SEVL:
// §11a: manda el clasificador, no la tabla de display.
y ahí mismo está el ejemplo: el vocabulario de severidad pasó de ["Óptimo","Vigilancia","Moderado","Crítico"] a ["Bajo","Leve","Moderado","Alto"] por esa misma razón.
SMM/W: "Óptimo". cSMM en hombres es <27 sarcopenia · 27–33 normal · >33 óptimo. La tabla dice "Normal" porque quedó congelada en una versión anterior del clasificador. Corrijan la tabla.
El procedimiento, para cerrar la clase entera: ante una divergencia display-vs-motor, (1) manda el clasificador del motor, (2) se corrige la tabla —etiqueta y rango—, (3) se me reporta en el resumen de la entrega, no como pregunta. Solo súbanmela como pregunta si el motor no clasifica esa fila, o si sospechan que el equivocado es el motor. Ese segundo caso sí lo quiero ver, y quiero verlo con el número, como hicieron con el FMI.

4. Re-sincronización · la vigente NO es la del 13, es la del 15
Corrijo la premisa de la pregunta. La entrega del 13 quedó superada dos días después: el archivo del 15-ago-2026 es el que retira las derivaciones que se adelantaban a derivarFaltantes (el §0 de mi respuesta anterior). Si re-portan contra la del 13 vuelven a importar el defecto de la FFW que ustedes mismos detectaron.
Confirmo `ATLAS_v8.html` del 2026-08-15 como la entrega vigente para re-portar el motor. Contiene todo lo del 13 más esa corrección.
El delta completo contra su base del 05-ago, verificado sobre el archivo —para que re-sincronicen una sola vez y no pieza por pieza:
DFI, Dominio 1: entra la PABU. Faltaba en el dominio pese a estar declarada en la estructura. Se emite con su clasificación y, cuando hay ICA-BIS, con la desviación de φ.
Vocabulario de severidad del DFI: ["Bajo","Leve","Moderado","Alto"]. Antes ["Óptimo","Vigilancia","Moderado","Crítico"].
Radar: cuatro zonas, con la misma escala y el mismo vocabulario que las tarjetas de dominio. Fuera la banda "Excepcional", que era inalcanzable —el cálculo de zona solo devuelve del 1 al 4—.
Código de estructura FFMI×FMI renombrado `R1–R9` → `E1–E9` (9-ago), porque chocaba con las rutas de atención R1–R6. El dato guardado no se reescribe: las consultas anteriores al 9-ago se traducen solo al mostrarlas, para que un reporte viejo y uno nuevo se lean igual. Porten la traducción, no una migración.
Salvaguarda TCA: avisa, no bloquea (9-ago). Antes ponía el déficit en cero y forzaba dieta normocalórica. El déficit sigue partiendo del peso meta acordado con el paciente; el sistema levanta la alerta y marca remisión. Es la misma regla del veto conductual.
El objetivo calórico ya no lo deriva el sistema (13-ago). Se retiraron los cinco déficits sugeridos por fenotipo (−300, −500, −600, −300 y mantenimiento). El déficit queda en 0 y la orientación del fenotipo se conserva como texto sin cifra, en el campo perfil. Lo decide el nutricionista.
Hábitos moderados: dejan de seguir la lógica de los protectores. En ellos más frecuencia no es mejor, así que el óptimo está en el medio y la frecuencia alta ya no se pinta en verde.
ICEC — la bandera de activación del mapeo sigue en `false`, y así se queda. No se activa sin recalcular en el mismo acto μ y σ del ICEC sobre nuestra base con el mapeo ya corregido (hoy μ = 58,578 · σ = 13,332 en EB-BIS v5). Activarla sola bajaría la edad bioeléctrica de todos los pacientes entre 1 y 8 años, y más cuanto más sano esté el paciente. D-006 sigue vigente. Porten la bandera apagada y el comentario completo.
Bloque `REF_POB` revisado el 12-ago (ver §5).
§0 del 15-ago: retiradas FFW = MLG × hidratación y el reparto proporcional de las aguas sin grasa; los porcentajes sin grasa se calculan después de derivarFaltantes.
Sobre `cPABU` y `cMMEM`, que retuvieron por Q27
`cPABU`: pórtenlo tal cual, y no lo gradúen. Es un marcador direccional —dice hacia dónde se desvía la célula respecto de φ = 1,618, no cuánto—, con la k recalibrada por sexo sobre la cohorte de 6.063 (H 0,78 · M 0,46 · sin sexo 0,9 histórico). La ausencia de bandas es deliberada: graduarlo añadiría niveles sin información nueva. El "cuánto" ya lo da el ICA-BIS.
`cMMEM`: pórtenlo, pero con el umbral femenino corregido a 5,5. Aquí encontré una incoherencia mía que conviene cerrar ahora que están re-sincronizando: cMMEM usa AWGS2019 (H < 7,0 · M < 5,7) mientras el resto del sistema —la fila ASMI de la tabla, REF_POB.asmi y el diagnóstico de sarcopenia con fuerza prensil H < 27 / M < 16 Kgf— usa EWGSOP2. Un mismo paciente puede quedar por encima del corte en una fila y por debajo en otra. Unificamos en EWGSOP2: ASMI H < 7,0 · M < 5,5 kg/m². Queda pendiente en mi archivo y va en la próxima entrega; ustedes pórtenlo ya corregido y anótenlo en la trazabilidad.

5. Las constantes de la MLG · confirmo tres, dos siguen marcadas
Confirmo, quítenles la marca:
Proteína total 19,4 % de la MLG
Contenido mineral óseo 5,6 % de la MLG
Mineral no óseo 1,2 % de la MLG
No son elecciones nuestras: son el reparto del modelo molecular de Wang, el mismo del que sale la hidratación de 73,2 % que ya está referenciada. La prueba de que forman un conjunto y no tres números sueltos es que cierran: 73,2 + 19,4 + 5,6 + 1,2 = 99,4 %, y el 0,6 % restante es glucógeno y componentes menores. Confirmar la hidratación y dejar el resto del reparto marcado sería inconsistente. Cítenlas como reparto de Wang, no como constantes independientes.
Siguen marcadas, y no por desconfianza sino porque efectivamente no están validadas:
Agua extracelular 42 %. No hay constante publicada aquí; la elegimos por coherencia con nuestro propio umbral AEC/ACT > 44 %. La literatura la sitúa entre 38 y 45 % según el método de medición, que es demasiada horquilla para presentarla sin advertencia. Y esto tiene arreglo por cuenta nuestra: los 5.073 registros tienen AEC y ACT. Calculen la distribución real —mediana e intervalo intercuartílico, estratificada por sexo— y con eso la fijamos con dato propio. Deja de ser una decisión de diseño y pasa a ser un percentil nuestro. Se lo pido explícitamente para la próxima ronda.
Proteína metabólicamente activa 70 % de la proteína total. Es la más frágil de las cinco: el reparto activa/estructural no tiene una constante de referencia estable y varía con la edad y con el estado nutricional, que es justo la población que nos interesa. Se queda con el asterisco.
La marca dice "en validación", no "dato incorrecto", y así debe leerse en pantalla. Revisen que el texto del asterisco lo diga con esas palabras.

6. Fuerza prensil · el campo ya existe, no lo diseñen
No hay que decidir dónde ponerla: ya está puesta, y está donde ustedes supusieron.
En mi archivo, en Datos Personales de Antropometría, junto a cintura y cadera:
DPEdit('Fuerza prensil', ant.fuerzaPrensil, 'Kgf', v => setAnt(a => ({ ...a, fuerzaPrensil: v })))
Y ya está cableado de punta a punta: se persiste con cintura y cadera en atlas:antro:<documento> en cuanto se teclea, viaja en guardarConsulta, y lo leen tanto dxSarcopenia como el DFI, que lo toman de bis.fuerzaPrensil || enc.fuerzaPrensil. Los cortes EWGSOP2 ya están: bajo si H < 27 · M < 16 Kgf. Pórtenlo; no diseñen un campo nuevo.
Lo que sí falta y es lo que les respondo de fondo — el protocolo de medición, porque un número de dinamómetro sin protocolo no es comparable entre consultas:
Unidad: Kgf, con un decimal.
Quién: el profesional, en consulta. Nunca la encuesta del paciente. Confirmado.
Cuándo: en el mismo bloque de antropometría, después de cintura y cadera y antes de la medición BIS.
Cómo: mano dominante, sentado, codo a 90°, mejor de tres intentos con descanso entre ellos. Se registra el mejor, no el promedio. Es el protocolo EWGSOP2 y es el que hace que los cortes de 27 y 16 signifiquen algo.
Ese protocolo debe quedar como texto de ayuda junto al campo, no solo en la documentación.

Menores
Δ del Agua total. Sí: valor − referencia, exacto. Su −3,89 es el correcto. El −1,05 que veían era el arrastre de la FFW mal derivada, ya corregido en el §0. Y la regla general está en el §2: donde hay valor de referencia, Δ = valor − referencia; donde hay rango, Δ contra el límite que decide la clasificación.
Cola del Nivel II. Dejen las suyas, son mejores. Punto por punto:
"Grasa corporal total (% - Lípidos Wang)" es la misma Masa grasa % que ya muestran arriba. No la dupliquen. Que aparezca dos veces en mi HTML es redundancia, no criterio.
IEHH en la tabla de índices, correcto. Es un índice compuesto, no un compartimento de Wang; no pertenece a esa tabla.
Masa proteica metabólica derivada en lugar de "sin dato", correcto — con una condición: mientras el 70 % de proteína activa siga marcado en validación (§5), esa fila hereda la marca. Un valor derivado de una constante sin validar no puede presentarse como si fuera medido.

Resumen
Punto
Decisión
§1
Agreguen la pregunta de residencia prolongada; de ahí salen altitud y región. La ciudad actual no alimenta la altitud. Caracterización, nunca coeficiente de corrección
§2
Δ contra el borde que decide la clasificación, no el punto medio ni el borde más cercano. Tabla de límites por fila arriba. FMI: normal 3–6 (H) · 5–9 (M), corrijan también el rango mostrado
§3
"Manda el motor" es general, todos los clasificadores. SMM/W → "Óptimo". Las divergencias se reportan, no se preguntan
§4
La entrega vigente es la del 15-ago, no la del 13. Delta completo de 10 puntos arriba. cPABU tal cual; cMMEM con M < 5,5 (unificar en EWGSOP2)
§5
Confirmadas proteína 19,4 %, CMO 5,6 %, mineral no óseo 1,2 % (reparto de Wang, cierran en 99,4 %). Siguen marcadas agua EC 42 % y proteína activa 70 %. Calculen el agua EC sobre los 5.073 registros
§6
El campo ya existe en Datos Personales de Antropometría (Kgf, cortes 27/16). Pórtenlo y añadan el protocolo: mano dominante, mejor de tres
Menores
Δ del ACT = valor − referencia. Cola del Nivel II: dejen las suyas; la Masa proteica metabólica hereda la marca de validación

Lo que espero de vuelta: la distribución real del agua extracelular sobre los 5.073 registros (§5). Es lo único que les pido que calculen, y cierra la última constante sin validar.
© Connected Nutrition Ventures SAS, 2026. Documento interno.
