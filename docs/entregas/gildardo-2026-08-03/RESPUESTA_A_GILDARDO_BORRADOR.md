# Borrador de respuesta a Gildardo (2026-08-03) — para revisión de Santiago antes de enviar

---

Gildardo, gracias. Respondemos tus tres preguntas con datos, te dejamos tres consultas que salieron al revisar tu archivo completo, y confirmamos el método.

## Tus tres preguntas

**1. ¿Revisamos los cuatro bloques o solo el del nutricionista?**

Solo el del nutricionista. Al inventariar la pantalla de tratamiento miramos una sola de las cuatro columnas: de la de médico y la de ejercicio dimos por hecho que eran texto derivado de los indicadores, sin leer su código, y la de psicología no la revisamos. Al recibir tu observación rehicimos el inventario recorriendo el archivo completo, y encontramos lo que sigue.

**2. ¿Cuánto es portar los otros tres?**

Poco, y es construible ya. Los cuatro son motores de verdad, no texto derivado como habíamos supuesto. Los otros tres son compactos: el de médico calcula metas, monitoreo, remisión e interacciones fármaco-nutriente; el de ejercicio calcula el tamizaje ACSM, la prescripción FITT y el factor de actividad; el de psicología calcula el tamizaje (SCOFF, PHQ-9, GAD-7) y la salvaguarda de conducta alimentaria. Cada uno es un motor pequeño más su pantalla. Lo importante: ninguno de los tres depende de la cadena calórica, así que se pueden portar sin esperar tu C6. Se portan tal como están, sin interpretarlos, como el resto del motor.

**3. ¿Qué más encontramos al recorrer el archivo entero?**

Cuatro cosas que no teníamos identificadas como tuyas: (1) los tres motores de tratamiento de arriba; (2) los cuatro párrafos de resumen clínico, uno por profesión (solo conocíamos el del nutricionista, y como un archivo suelto); (3) el registro de despacho por profesión; (4) el panel de control de calidad de la toma, que tú tienes interactivo y nosotros solo validamos al importar. Lo demás que falta (la cadena calórica, el plan alimentario, el menú) ya lo teníamos ubicado. El error no fue omitir esos: fue mirar una sola de las cuatro columnas de la pantalla.

## Tres consultas

**A. El factor de actividad.**

Cuando decidiste en 6.4 que no construyéramos el factor de actividad sugerido, entendimos que era trabajo nuevo. Al inventariar tu archivo vimos que ya existe: el motor de ejercicio calcula un factor recomendado (moderado si hay obesidad, ligero en el resto), y tu motor nutricional lo usa como valor por defecto cuando el profesional no elige, dejándole siempre la última palabra. Así que la pregunta cambia: al portar el motor de ejercicio, ¿usamos ese factor recomendado como valor por defecto, como hace tu archivo, o lo dejamos fuera y mantenemos un valor fijo ligero, como pediste en 6.4? Te damos el dato para que decidas con la foto completa.

**B. Tu modelo tiene una salvaguarda de conducta alimentaria que Atlas todavía no, y la vamos a construir con la cadena.**

Queremos confirmarte que entendimos bien cómo opera: cuando hay riesgo de trastorno de conducta alimentaria y el plan tiene déficit calórico, tu motor nutricional pausa el objetivo hipocalórico (pone el déficit en cero, vuelve la dieta normocalórica y marca remitir), porque prescribir una dieta de pérdida a alguien con ese riesgo es dañino. Tu nutricional detecta el riesgo por su cuenta desde la encuesta, y el motor de psicología amplía esa detección con un caso más. Como esa salvaguarda vive dentro de la cadena calórica, que todavía no construimos, hoy Atlas no la tiene; la vamos a construir junto con la cadena, y no daremos la cadena por terminada sin ella. Esto es otra razón para portar los tres motores primero: sin el de psicología, la protección quedaría más pobre de lo que tu modelo la tiene.

**C. La cita agendada.**

Pusiste como requisito que la banda "empeoró" solo se emita acompañada de la próxima cita agendada. En tu prototipo la cita es un campo de fecha (con una frecuencia opcional), sin calendario ni recordatorios. Nosotros tenemos exactamente eso: un campo de fecha de próxima cita. Entendemos entonces que el requisito se cumple con que ese campo esté lleno, y que no hace falta construir un sistema de agenda. ¿Lo confirmas?

## El orden que proponemos

Portar los tres motores de tratamiento (médico, ejercicio, psicología) primero. Es construible ya y no espera tu C6, y además dos de ellos alimentan la cadena calórica (el de ejercicio da el factor de actividad y el de psicología da la salvaguarda), así que tenerlos listos antes hace que la cadena, cuando llegue C6, se construya completa. Arrancamos por ahí salvo que prefieras otra cosa.

## El método

Lo adoptamos completo. Vamos a consolidar todo lo decidido en un solo documento numerado, con la estructura que definimos (una sola secuencia de números, cada decisión con su estado y lo que afecta, y las modificaciones a tu ciencia como una vista de ese mismo documento, no un archivo aparte, para no crear una tercera fuente que se desincronice). Cuando esté poblado te lo pasamos para tu firma. Y desde ahora, antes de preguntarte revisamos si ya está y, si está, lo implementamos.

Quedamos atentos a C6 (proteína y sobrecosto en cifras), P2 y P3.
