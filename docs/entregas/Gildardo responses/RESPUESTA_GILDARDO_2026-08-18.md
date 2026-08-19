
Respuesta a la ronda del 2026-08-18
De: Gildardo Uribe — Dirección Científica CNV
Para: Equipo Atlas
Fecha: 18 de agosto de 2026
Va todo lo que pidieron: los dos bordes, el archivo y los datos. Pero el punto 3 no salió como esperábamos ninguno de los dos, y esa es la parte importante de esta carta. Hice el cálculo del agua extracelular sobre la cohorte y el resultado obliga a no hacer lo que yo mismo les pedí el 17. Empiezo por ahí, porque cambia una decisión que ya habíamos dado por tomada.

0. El agua extracelular: hice el cálculo, y hay que retirar la petición
Los 5.073 registros que ustedes no encontraban son la BD_UNICA de CIENCIA BIS: 5.885 registros válidos con AEC, ACT, sexo y edad, más la impedancia cruda. Los tenía yo, no el repositorio de Atlas. Corrí el cálculo que les había encargado, y después pasé un buen rato tratando de tumbar el resultado. Va con las pruebas, porque la conclusión no es la que yo esperaba.
La distribución, que es lo que pidieron:

n
Mediana AEC/ACT
IQR
p5–p95
Mujeres
3.434
42,10 %
41,37–42,76
40,13–43,73
Hombres
2.451
38,88 %
38,37–39,33
37,44–40,20
Total
5.885
41,00 %
39,02–42,29
—

El 42 % que elegimos a ojo cae casi exactamente sobre la mediana femenina. Y aparece lo que no habíamos visto: la constante no puede ser única, porque en hombres sobreestima 3,2 puntos.
Lo que hay que comprobar antes de usar esos números
Los volúmenes están bien medidos. Lo verifiqué contra el índice de impedancia, que es el fundamento de toda la BIA:

Mujeres
Hombres
ACT ↔ Ht²/R∞
+0,94
+0,95
AEC ↔ Ht²/Re
+0,90
+0,93
Reconstruir los volúmenes con impedancia (R²)
0,97–0,997
0,97

Así que la AEC y la ACT en litros son mediciones reales, derivadas de la impedancia como debe ser.
El problema no está en los volúmenes sino en el reparto. El cociente AEC/ACT —el número que nos importa, el que fijaría la constante— apenas tiene contenido bioeléctrico. Esto es lo que explica su varianza:
Predictores del cociente AEC/ACT
R² mujeres
R² hombres
Re/R∞ solo (el marcador bioeléctrico del compartimento extracelular)
0,032
0,006
(R∞/Re)^⅔, la forma del modelo de Hanai
0,028
0,005
+ peso y talla
0,49
0,29
+ ángulo de fase y Xc
0,52
0,31
+ edad
0,96
0,77

Léalo en la última fila. La edad sola aporta +0,44 y +0,46 de R²; toda la impedancia junta aporta menos de 0,04. El equipo mide bien cuánta agua hay, pero decide cómo repartirla entre dentro y fuera de la célula con un modelo de edad, no con la impedancia que acaba de medir.
Y el término de edad corre al revés. El coeficiente es −0,065 puntos por año en mujeres y −0,047 en hombres: −3,2 y −2,4 puntos a lo largo de cincuenta años de vida adulta. La fisiología dice lo contrario — el compartimento extracelular se expande al envejecer, y es la razón de que el ángulo de fase caiga.
La demostración más limpia es esta, sin modelos de por medio. Tomé mujeres con la misma Re/R∞ (±0,005, n=268), es decir en el mismo estado bioeléctrico:
menores de 35 años (n=97): mediana 42,79 %
mayores de 55 años (n=34): mediana 40,69 %
Misma impedancia, 2,1 puntos menos de agua extracelular por ser mayor. Eso no lo puede producir una medición; solo un término de edad. (En hombres ninguna banda de Re/R∞ reunió casos suficientes para el mismo contraste, así que este dato queda solo para mujeres.)
Dos cosas que comprobé y resultaron ser mías, no del equipo
Lo anoto porque me las creí un rato y por poco se las escribo como hallazgo:
Vi que el cociente no correlacionaba nada con el ángulo de fase (−0,08 y +0,01) y lo tomé por prueba de que la AEC no era bioeléctrica. Era confusión por tamaño corporal. Controlando peso, talla y edad, la correlación parcial es −0,82 y −0,62: negativa y fuerte, como manda la fisiología. La relación estaba, enmascarada.
Vi que el cociente correlacionaba con peso (+0,63) y talla (+0,48) y lo leí como regresión antropométrica. El modelo de Hanai lleva peso y talla dentro por construcción, así que eso era esperable y no probaba nada.
Queda en pie solo la inversión por edad, que es la que sobrevivió a todos los controles y se refuerza con ellos (cruda −0,58; controlando peso y talla −0,84; dentro de bandas estrechas de IMC, entre −0,46 y −0,77).
Qué hacemos
Retiro la petición del 17. El 42 % se queda marcado «en validación». Nuestras medianas son, en buena parte, la distribución de edades de la cohorte pasada por el modelo de edad del equipo. Fijar la constante con ellas habría sido grabar ese modelo en nuestro motor con el sello de «validado sobre 5.885 registros».
Tres consecuencias que sí son de ahora:
El umbral AEC/ACT > 44 % lee al revés en el eje de la edad. Está en el archivo (_aecPct > 44, marcador de hidratación alterada) y era nuestra única justificación para el 42 %. Con un reparto que baja con la edad, el paciente mayor —justo al que ese umbral debería señalar— es el que menos lo cruza. No lo toquen todavía, pero anótenlo como limitación conocida en la trazabilidad.
E/I, AEC %, AEC sin grasa y AEC/MCA heredan lo mismo, porque todos salen del reparto. Los volúmenes y todo lo que dependa de la ACT total están bien.
Si algún día usamos el cociente como marcador de envejecimiento o sarcopenia, se moverá en la dirección equivocada. Que quede escrito antes de que a alguien se le ocurra.
El camino que sí sirve, para cuando le toque su ronda: rehacer el reparto desde Re y R∞ con Cole–Hanai, sin término de edad. Los volúmenes ya vienen de ahí; es la partición la que hay que reconstruir. No lo emprendan ahora, es trabajo de modelo.
Les mando el export igual, abajo. La distribución sirve para caracterizar la cohorte. No para calibrar.

1. Borde del FM_pct · el superior, y ya estaba bien
H 22 % · M 32 %. Su suposición es correcta y el motivo es el que dan: es el lado del riesgo.
Sale de dFMpct, que es quien clasifica: por debajo de 10/18 «Bajo (atleta)», hasta 22/32 «Normal», hasta 25/35 «Sobrepeso adiposo», y de ahí «Obesidad adiposa». El límite que decide el paso a anormal por el lado que importa es el superior.
Y una aclaración: en mi archivo esa fila ya mide contra 22/32. No fue omisión deliberada de la tabla del §2; simplemente no la copié. Si a ustedes les salía contra el punto medio, ahí hay una divergencia que se cierra con esto.
2. Borde del IAE · aquí mi regla del §2 se queda corta
No es un borde, son dos, y esto es un defecto de mi tabla, no de su pregunta.
cIAE es el único clasificador de dos colas del sistema: por debajo de −5 «Desacelerado», entre −5 y +5 «Concordante», por encima de +5 «Acelerado». Y no se estratifica por sexo, que es deliberado y quedó confirmado el 28 de julio. Mi regla del §2 —«un límite por fila, el que decide»— asume una sola dirección de anormalidad. Aquí hay dos, y las dos significan algo.
La regla para el IAE: el Δ va contra el borde del lado del signo. Con IAE ≥ 0, contra +5. Con IAE < 0, contra −5. Así el número siempre responde «cuánto falta para cruzar», que es para lo que sirve la columna.
Una advertencia de lectura que conviene poner en la trazabilidad: el IAE ya es de por sí una diferencia (EB-BIS − edad cronológica). Su Δ es entonces la distancia de una distancia, y el dato que manda es el valor, no el Δ. Si al maquetarlo ven que el Δ compite con el valor y confunde, prefiero que lo dejen en «—» y me lo digan; en esta fila el valor con su signo ya lo dice todo.
Generalicen la regla, no la dejen como excepción del IAE: cualquier clasificador de dos colas que aparezca sigue el mismo criterio, sin volver a preguntarme.
3. SMM/W en mujeres · 22. El error era mío
Confirmo 22, y el motor no debía ser 24. Hicieron exactamente lo correcto: aplicaron «manda el motor», dejaron 22 y me lo reportaron con el número. Así es como quiero que se resuelvan estas.
El 24 fue un error de transcripción mío al armar la tabla del §2: lo copié de la fila del display, que estaba desactualizada, en vez de leerlo de cSMM. El clasificador tiene mujeres <22 sarcopenia · 22–28 normal · >28 óptimo, que es la banda espejo de la masculina 27–33, desplazada por sexo igual que en FMI y FFMI. El 24 no salía de ningún clasificador.
Corregido en mi archivo, junto con lo demás (§4).
4. El archivo del 15-ago · va, con tres correcciones encima
Va adjunto el ATLAS_v8.html, y no es el del 15 sino el del 18: le apliqué hoy las tres correcciones que quedaron pendientes de la ronda anterior, para que re-porten una sola vez y no dos.
Contiene todo lo del 15 —incluido el §0, las derivaciones que se adelantaban a derivarFaltantes— más:
`cMMEM`, umbral femenino 5,7 → 5,5. Es la unificación en EWGSOP2 que les anuncié en el §4 del 17. Era el mismo índice clasificado con dos criterios: una mujer con ASMI 5,6 salía «Normal» por cMMEM y «Bajo» por cASMI, la fila ASMI, REF_POB.asmi y el diagnóstico de sarcopenia.
Fila del FMI: rango 6–9 / 9–13 → 3–6 / 5–9, y el Δ contra 6 (H) y 9 (M). El display medía contra el borde de la banda «Alto SS», que la clasificación ya no usa.
Fila del SMM/W: borde femenino 24 → 22 (§3).
Nada más. El diff contra el respaldo son esas tres cosas y sus comentarios; los saltos de línea siguen en CRLF, así que el diff les sale limpio.
Cuando re-sincronicen contra este archivo, los diez puntos del delta del 17 siguen vigentes tal cual: PABU al Dominio 1, vocabulario de severidad, radar de cuatro zonas, R1–R9 → E1–E9 como traducción al mostrar, nunca como migración del dato guardado, salvaguarda TCA que avisa y no bloquea, objetivo calórico en 0, hábitos moderados con el óptimo en el medio, y la bandera del ICEC apagada —esa pórtenla en false con su comentario completo, que activarla sola bajaría la edad bioeléctrica de todos los pacientes entre 1 y 8 años—.
5. El export de la cohorte
cohorte_AEC_ACT_2026-08-18.csv, 5.885 filas, anonimizado, sin identificadores. Columnas:
n · sexo · edad · ACT_L · AEC_L · AEC_pct_ACT · Re_ohm · Rinf_ohm
Les puse cuatro columnas más de las tres que pidieron, y no es por completitud: la edad es la que destapa la inversión del §0, y Re/R∞ son las que les permiten reproducir todas las pruebas de esta carta. Reprodúzcanlas. La comparación de mujeres con la misma Re/R∞ por grupo de edad se hace con esas ocho columnas y es la que más pesa; si les sale otra cosa, quiero saberlo antes de que yo escriba nada sobre la AEC en ningún sitio.

Resumen
Punto
Decisión
§0
Retiro la petición del 17. Los volúmenes están bien medidos, pero el reparto AEC/ACT lo decide un término de edad (R² +0,45) y no la impedancia (R² <0,04), y corre al revés: −0,065 puntos/año. El 42 % sigue marcado. Distribución adjunta, solo para caracterizar
§1
FM_pct: borde superior, H 22 % · M 32 %. Mi archivo ya lo medía así
§2
IAE: dos bordes, contra +5 o −5 según el signo. Regla general para todo clasificador de dos colas. Mi tabla del §2 no cubría este caso
§3
SMM/W mujeres: 22, el motor tenía razón. El 24 fue error mío de transcripción. Procedieron bien
§4
Va el `ATLAS_v8.html` del 18: el del 15 más cMMEM 5,5, fila FMI 3–6/5–9 y fila SMM/W 22
§5
Va el export de 5.885 registros con edad, Re y R∞ además de lo pedido

Lo que espero de vuelta: la re-sincronización del motor contra este archivo, con sus golden tests. Y la reproducción independiente de las pruebas del §0.
© Connected Nutrition Ventures SAS, 2026. Documento interno.

