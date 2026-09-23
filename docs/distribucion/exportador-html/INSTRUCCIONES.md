# Exportar tus pacientes del HTML a Atlas web

Para cada integrante que atendió pacientes con el HTML. Toma unos minutos.

**Busca abajo el camino de tu computador:** en Mac va por la consola, en Windows por el archivo nuevo. No es
un capricho: el navegador guarda lo que hiciste separado por archivo, y en Mac el camino del archivo nuevo
falla con más frecuencia por cómo Safari y Chrome tratan esa separación. El camino de la consola trabaja
sobre tu propio archivo, así que no depende de eso.

---

## En Mac: desde la consola del navegador

1. Abre **tu HTML de siempre**, el que tiene tus pacientes. No lo muevas ni lo renombres.
2. Abre la consola del navegador:
   - **Chrome o Brave:** `Cmd + Opción + J`.
   - **Safari:** primero activa el menú Desarrollo (Safari > Ajustes > Avanzado > "Mostrar funciones para
     desarrolladores web"), y luego `Cmd + Opción + C`.
3. Abre el archivo `exportador-consola.js` de esta carpeta, **copia todo su contenido**, pégalo en la consola
   y pulsa **Enter**. Si el navegador te pide escribir algo antes de dejarte pegar (Chrome pide escribir
   `allow pasting`), escríbelo y vuelve a pegar.
4. Abajo a la derecha aparece el botón **"Exportar a Atlas web"**.
5. Marca los pacientes que te pidieron continuar en Atlas web (puedes usar **Marcar todos**), marca las
   **tres declaraciones** y pulsa **Descargar archivo**.
6. **Envía el archivo descargado a CNV** por correo o WhatsApp. Cuando CNV te confirme que lo importó,
   bórralo de tu equipo.

## En Windows: con el archivo nuevo

1. **Cierra el HTML** si lo tienes abierto.
2. **Reemplaza tu archivo del HTML por `ATLAS_v9.html` de esta carpeta**, en la **misma carpeta** donde tenías
   el tuyo y con el **mismo nombre** que tenía el tuyo. Si el tuyo se llamaba distinto, renombra este igual al
   tuyo. Esto importa: algunos navegadores separan lo guardado según el archivo.
3. **Ábrelo con el mismo navegador de siempre.** Si usaste dos navegadores, repite con cada uno.
4. Abajo a la derecha aparece el botón **"Exportar a Atlas web"**. Sigue desde el paso 5 de arriba.

Si el botón dice "Este navegador no tiene pacientes guardados" y sabes que sí los tienes, usa el camino de la
consola: en Windows la consola se abre con **F12**, y el resto es igual.

## Lo que conviene saber

- **El archivo lleva todo lo que el HTML guardó de esos pacientes**, incluidos su documento, su salud y la
  firma del consentimiento. Trátalo como una historia clínica.
- **El archivo nuevo es solo para exportar.** No trae las claves de la IA ni de la nube del HTML, así que esas
  funciones no le van a responder. Tu trabajo de ahora en adelante es en Atlas web.
- Nada de lo que haces aquí cambia tus pacientes en el HTML: el exportador solo lee.
