# Cuando la medición no es de ese paciente

**Para:** la profesional que atiende al paciente · **De:** equipo Atlas · **2026-10-25**

Esto pasa cuando un archivo del equipo de bioimpedancia se importó a la consulta de otra persona. No es un
dato mal digitado: el diagnóstico de esa consulta se calculó con el cuerpo de alguien más, así que no se
arregla cambiando un número.

Atlas ya tiene el camino para arreglarlo, y **no borra nada**. Son cuatro pasos.

---

## Antes de tocar nada: ¿es este caso o es el otro?

Son dos cosas distintas y cada una tiene su botón. Elegir el equivocado deja el registro diciendo algo que
no pasó.

| Lo que pasó | Qué se usa |
|---|---|
| La consulta **sí ocurrió**, pero la medición que quedó es de otra persona | **"La medición no es de este paciente"** (esta guía) |
| La consulta **no ocurrió**: se creó por error, el paciente no vino, se abrió un seguimiento de más | **"Esta consulta no ocurrió"**, desde el historial del paciente |

**La señal más clara de una consulta que no ocurrió:** se creó y se cerró con uno o dos minutos de
diferencia. Nadie atiende a nadie en dos minutos; eso es un clic de más.

Si no estás segura, no elijas: pregúntale al equipo con el documento del paciente a la mano. Las dos quedan
registradas y las dos son difíciles de deshacer.

---

## Lo primero que vas a ver: Atlas te avisa solo

**No tienes que ir a buscar estos casos.** Cuando una medición está también en otra consulta, Atlas lo
detecta por sí mismo (compara las cuatro lecturas eléctricas del equipo, que son idénticas hasta el último
decimal, así que es la misma toma física y no dos mediciones parecidas) y lo dice en dos sitios:

- **En la lista de pacientes**, con una etiqueta: *Medición repetida*.
- **En la consulta**, en la pestaña **Antrop. & BIS**: un recuadro amarillo, **lo primero de la pestaña**, con el aviso y el botón para corregirlo en el mismo sitio.

**El aviso no te dice de quién es la otra consulta**, y eso es a propósito: puede ser un paciente que no es
tuyo, y entonces no te corresponde ver su historia. Lo que necesitas saber es que esa toma está en dos
sitios, y eso sí te lo dice.

**Y se apaga solo.** No hay nada que marcar como revisado: en cuanto la corrección deje una sola de las dos
consultas en pie, el aviso desaparece por su cuenta.

---

## 1 · Dónde está la corrección

1. Abre el paciente y entra a **la consulta** que tiene la medición equivocada.
2. Pestaña **Antrop. & BIS** (es donde vive la medición).
3. **Lo primero que aparece** es el recuadro con el botón **"La medición no es de este paciente"**. Púlsalo.
   (Si la medición no está repetida, el recuadro sigue ahí pero en gris: la salida existe igual.)

El bloque se abre y te explica lo que va a pasar **antes** de pedirte nada. Lee esa lista: es lo mismo que
está más abajo en esta guía.

> **Si alguien te dijo que estaba en Diagnóstico:** ahí estaba antes del 26 de octubre. Se movió a
> Antrop. & BIS porque es donde está la toma, y en Diagnóstico quedó una línea que te manda aquí.

---

## 2 · Qué motivo escribir

Pide al menos 15 caracteres, y no es por capricho: dentro de un año alguien va a abrir esa historia clínica
y lo único que va a explicar por qué se retiró una medición es esta frase.

**Escribe qué pasó, no que hubo un error.** Lo útil es cómo te diste cuenta:

> *El archivo importado era el de la otra paciente atendida esa misma tarde.*

> *La edad que trae el equipo no coincide con la de este paciente.*

> *Se importó dos veces el mismo archivo y esta copia es la que quedó en la historia equivocada.*

**No escribas** "error", "corrección", "me equivoqué": no dicen nada que el sistema no sepa ya.

Después marca la casilla de confirmación. El botón para terminar dice
**"Retirar la medición y crear la versión nueva"**, y mientras falte algo te dice qué falta en el propio
botón.

---

## 3 · Qué pasa al confirmar (tres cosas, y ninguna se deshace)

1. **Esta versión de la consulta queda reemplazada.** Su diagnóstico **no se borra**: queda legible como el
   registro de lo que se emitió, con la firma de quien lo firmó. Eso es a propósito: lo que se emitió,
   ocurrió, y una historia clínica no se reescribe.
2. **Se crea una versión nueva de la consulta, sin medición.** La encuesta del paciente, su fuerza prensil y
   su peso meta **se conservan**, porque esos sí son suyos.
3. **La medición queda marcada como de otra persona.** Esta es la parte que no se ve y es la que más
   importa: es lo que permite que **el paciente al que de verdad pertenece esa medición pueda cargar su
   propio archivo**. Sin esa marca, Atlas le diría que su archivo ya está en el sistema y no lo dejaría
   importar.

**Una cosa más, para que no te sorprenda:** las condiciones de la toma (si estaba en ayunas, si había hecho
ejercicio, y las demás) se conservan pero **vuelven a quedar pendientes de registro**. Describen un momento
que no era este, así que hay que confirmarlas con la medición buena.

---

## 4 · Qué vas a ver después

La consulta nueva aparece **sin medición**, y su pendiente dice **"Montar BIS"**. Eso es lo correcto, no un
error: desde ahí importas el archivo que sí es de ese paciente, y el diagnóstico se vuelve a generar solo
con los datos buenos.

Si el paciente no tiene su archivo, la consulta se queda en "Montar BIS" hasta que lo tengas. No hay prisa y
no se pierde nada.

---

## Lo que **no** tienes que hacer

- **No borres la consulta.** Nada en una historia clínica se borra, y el botón no existe.
- **No vuelvas a importar encima.** El sistema lo frena a propósito: la misma medición no puede estar en dos
  consultas.
- **No pidas que lo haga un administrador.** Esto lo hace quien atiende al paciente, porque es una decisión
  clínica sobre su historia. Un administrador no la puede tomar por ti.

---

## Y una regla nueva que sale de esto

**Para probar el sistema nunca se usa el archivo de un paciente real.** Pasó: un archivo real se importó
primero a un paciente de prueba y cinco horas después al paciente al que pertenecía. Para probar hay un
archivo de ejemplo; pídelo.
