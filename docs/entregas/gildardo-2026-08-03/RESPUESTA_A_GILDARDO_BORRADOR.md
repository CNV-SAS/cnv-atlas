# Borrador de respuesta a Gildardo (2026-08-03) — para revisión de Santiago antes de enviar

---

Gildardo, gracias. Respondemos tus tres preguntas con datos, te dejamos tres consultas que salieron al revisar tu archivo completo, y confirmamos el método.

## Tus tres preguntas

**1. ¿Revisamos los cuatro bloques o solo el del nutricionista?**

Solo el del nutricionista. Sin adornos: cuando inventariamos la pantalla de tratamiento recorrimos únicamente la columna del nutricionista. De la de médico y la de ejercicio hicimos un juicio rápido ("es casi todo texto derivado de los indicadores") sin leer su código, y a la de psicología no la miramos. Tenías razón, y por eso rehicimos el inventario recorriendo el archivo entero.

**2. ¿Cuánto es portar los otros tres?**

Poco, y es construible ya. Los cuatro son motores de verdad, no texto derivado como habíamos supuesto. Los otros tres son compactos: el de médico calcula metas, monitoreo, remisión e interacciones fármaco-nutriente; el de ejercicio calcula el tamizaje ACSM, la prescripción FITT y el factor de actividad; el de psicología calcula el tamizaje (SCOFF, PHQ-9, GAD-7) y la salvaguarda de conducta alimentaria. Cada uno es un motor pequeño más su pantalla. Lo importante: ninguno de los tres depende de la cadena calórica, así que se pueden portar sin esperar tu C6. Se portan tal como están, sin interpretarlos, como el resto del motor.

**3. ¿Qué más encontramos al recorrer el archivo entero?**

Cuatro cosas que no teníamos identificadas como tuyas: (1) los tres motores de tratamiento de arriba; (2) los cuatro párrafos de resumen clínico, uno por profesión (solo conocíamos el del nutricionista, y como un archivo suelto); (3) el registro de despacho por profesión; (4) el panel de control de calidad de la toma, que tú tienes interactivo y nosotros solo validamos al importar. Lo demás que falta (la cadena calórica, el plan alimentario, el menú) ya lo teníamos ubicado. El error no fue omitir esos: fue mirar una sola de las cuatro columnas de la pantalla.

## Tres consultas

**A. El factor de actividad ya existe, y tu instrucción de 6.4 se tomó sin saberlo.**

Nos dijiste en 6.4 que no construyéramos un factor de actividad sugerido, que fuera un valor fijo ligero elegido por el profesional. Pero al leer el motor de ejercicio que nos pides portar, ese factor ya está: el motor de ejercicio calcula un factor recomendado (moderado si hay obesidad, ligero en el resto), y el motor nutricional lo usa como valor por defecto cuando el profesional no elige, dejándole siempre la última palabra. O sea que ya existe y no es trabajo nuevo. La pregunta pasa a ser: al portar el motor de ejercicio, ¿usamos ese factor recomendado como default (como hace tu archivo), o lo ignoramos y dejamos un fijo ligero (como pediste en 6.4)? No te contradecimos: solo te avisamos que 6.4 se decidió sobre una premisa que tu propio archivo desmiente, para que decidas con el dato correcto.

**B. La cadena calórica depende de un motor que aún no portamos.**

El motor de psicología produce la señal de riesgo de conducta alimentaria, y el motor nutricional la usa para pausar el objetivo hipocalórico (poner el déficit en cero y remitir), porque prescribir una dieta de pérdida a alguien con riesgo de conducta alimentaria es dañino. El nutricional también detecta ese riesgo por su cuenta desde la encuesta, pero el motor de psicología amplía la detección. Consecuencia: cuando construyamos la cadena calórica, la salvaguarda tiene que venir con ella, e idealmente con el motor de psicología para no perder los casos que él detecta y el nutricional solo no. Lo confirmamos contigo al construir la cadena.

**C. La cita agendada.**

Pusiste como requisito que la banda "empeoró" solo se emita acompañada de la próxima cita agendada. En tu prototipo la cita es un campo de fecha (con una frecuencia opcional), sin calendario ni recordatorios. Nosotros tenemos exactamente eso: un campo de fecha de próxima cita. Entendemos entonces que el requisito se cumple con que ese campo esté lleno, y que no hace falta construir un sistema de agenda. ¿Lo confirmas?

## El orden que proponemos

Portar los tres motores de tratamiento (médico, ejercicio, psicología) primero, porque es construible ya y no espera tu C6. Arrancamos por ahí salvo que prefieras otra cosa.

## El método

Lo adoptamos completo. Vamos a consolidar todo lo decidido en un solo documento numerado, con la estructura que definimos (una sola secuencia de números, cada decisión con su estado y lo que afecta, y las modificaciones a tu ciencia como una vista de ese mismo documento, no un archivo aparte, para no crear una tercera fuente que se desincronice). Cuando esté poblado te lo pasamos para tu firma. Y desde ahora, antes de preguntarte revisamos si ya está y, si está, lo implementamos.

Quedamos atentos a C6 (proteína y sobrecosto en cifras), P2 y P3.
