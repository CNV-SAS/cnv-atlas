# Si un archivo del exportador no pasa la revisión

**Para Santiago, 2026-09-24.** El archivo trae historias clínicas: **no me lo mandes**. Lo que sigue se
averigua mirando sus primeras líneas en un editor de texto, y con lo que la propia pantalla dice.

---

## Lo primero: vuelve a pulsar Revisar

El mensaje **cambió hoy**. Antes decía siempre *"no tiene el formato del exportador"* y mandaba a exportar de
nuevo, que era un consejo dado a ciegas. Ahora dice **cuál de estas cuatro cosas pasó**, y el remedio de cada
una es distinto:

| Lo que dice | Qué pasó | Qué hacer |
|---|---|---|
| *"no trae su marca"* | El archivo no lo hizo nuestro exportador (es otra cosa: un respaldo, un export del navegador) | Exportar de nuevo, esta vez con la copia de CNV |
| *"de la versión N"* | Sí es nuestro exportador, pero **una copia vieja** | **Repetir el export NO sirve.** Hay que mandarle la copia actual |
| *"salió SIN PACIENTES"* | El exportador corrió en un navegador (o un perfil) que no tenía los pacientes | **Repetirlo en ese mismo navegador daría lo mismo.** Hay que hacerlo en el navegador donde atendió |
| *"le falta o viene mal: `campo`"* | Es nuestro exportador y le falta algo concreto | **Mándame el nombre del campo**, no el archivo |

---

## Si quieres confirmarlo tú mismo, sin abrir nada delicado

Abre el `.json` con el Bloc de notas (o cualquier editor) y mira **solo el principio**. Las primeras líneas
son la envoltura y **no traen datos de pacientes**: eso empieza más abajo, en `"pacientes"`.

Busca estas cuatro cosas:

1. **`"formato":"atlas-exportacion-html"`** — si no está, el archivo no es del exportador.
2. **`"version":1`** — si dice otro número, la copia del exportador está vieja.
3. **`"exportadoEn"`** — la fecha del export. Sirve para saber si de verdad es el de hoy y no uno viejo.
4. **`"pacientes":[`** — justo después, si viene `]` de inmediato, **salió vacío**.

**Para contar cuántos pacientes trae sin leer ninguno:** busca cuántas veces aparece `"clave":` (el buscador
del editor te dice el número de coincidencias). Es un conteo, no un dato de nadie.

---

## Las tres causas probables, en orden

**1. Exportó con su HTML de siempre, no con la copia de CNV.** Es lo más frecuente. Si usó la ruta de la
consola sobre su archivo viejo, el exportador es el nuestro y el resultado debería servir; pero si abrió
*otro* archivo suyo o guardó algo distinto, no. Lo dice el punto 1 de arriba.

**2. El navegador equivocado.** Y esto es lo que más se confunde: **lo que el HTML guarda vive en el
navegador, no en el archivo**. Si ella atendió en Chrome y exportó en Safari, el exportador corre igual y
sale un archivo válido **y vacío**. Si dice *"salió SIN PACIENTES"*, es esto, y repetirlo en el mismo
navegador no cambia nada.

**3. Safari con dos almacenes.** Safari separa lo guardado con más agresividad (por archivo y por modo de
navegación). Si abrió el HTML desde otra carpeta, o en una ventana privada, ve otro almacén. Mismo síntoma
que el 2, mismo remedio: repetirlo donde están los pacientes.

---

## Lo que NO hay que hacer

**No le pidas que exporte otra vez "por si acaso".** Si el archivo salió vacío o la copia está vieja, repetir
el mismo gesto da el mismo resultado y le gasta el tiempo dos veces. El mensaje ahora distingue esos casos
justamente para no mandarla a eso.

---

## Sobre el nombre del profesional en el archivo

**Ya está resuelto y puedes importar sin dudar.** Si en el archivo ella aparece como "Gildardo" (porque el
HTML no tenía su nombre), no importa: **la cuenta a la que van los pacientes la eliges tú en la pantalla de
importación**, no sale del archivo. Es una decisión tomada el 2026-09-22, y por esta razón exacta: en esos
archivos hay muchos nombres escritos durante pruebas.

Lo único que el nombre del archivo afecta es informativo: la revisión te muestra qué profesionales aparecen
como autores de las consultas, para que sepas lo que estás mirando.
