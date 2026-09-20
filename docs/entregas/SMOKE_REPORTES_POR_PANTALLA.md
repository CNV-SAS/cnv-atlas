# Smoke del cambio de reportería: cada pantalla se imprime, el reporte es una hoja más (2026-09-18)

Un solo recorrido, sobre **una evaluación de seguimiento** que ya tenga diagnóstico y plan. No hace falta
crear nada nuevo: sirve cualquier paciente de prueba que ya tengas diagnosticado.

**Lo que se probó y ya pasó en local:** los 3.127 tests (incluidos los de BD real), `tsc`, `lint` y el
barrido de fronteras RSC. Lo que esta guía busca es lo que ninguna de esas tres cosas ve: **cómo sale el
papel y qué pasa en un navegador real.**

**Regla de siempre:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

**Antes de empezar:** ten una impresora o el diálogo de impresión a mano (con "Guardar como PDF" basta), y
abre la evaluación en **/ani-bis-e/{id}**.

---

## 1. El menú quedó sin "Reportes"

- [ ] Mira la barra lateral. **Debe dar:** ya **no** aparece la entrada **Reportes**.
- [ ] Entra a **/reportes** escribiendo la dirección a mano. **Debe dar:** la pantalla carga igual, con el
      histórico de lo enviado. La ruta se queda viva a propósito: es el registro, no una pantalla de
      trabajo.

## 2. El tablero no cuenta reportes fantasma

- [ ] Abre el tablero (**/**). **Debe dar:** no hay ningún contador de *"reportes en borrador"* pidiendo
      una acción que ya no existe. Los demás contadores siguen como estaban.

## 3. El plan sale en el orden de Gildardo

En la pestaña **Tratamiento**, bloque *"Imprimir el plan para entregarlo"*.

- [ ] Pulsa **Imprimir el plan** y mira la vista previa del navegador (no hace falta imprimir de verdad).
- [ ] **Debe dar, en este orden:** datos del profesional (nombre **y profesión**) → datos del paciente
      (nombre, **documento**, edad, fecha) → el plan → las porciones → la lista de intercambios → **y el
      menú al final**, después de la lista.
- [ ] **Debe dar también:** en la hoja sale **solo el plan**. Ni las rutas, ni el diagnóstico, ni la
      historia clínica se cuelan en el mismo papel.

## 4. Las rutas de atención se imprimen

En la pestaña **Tratamiento**, bloque **Rutas de atención**.

- [ ] Pulsa **Imprimir / Guardar PDF**.
- [ ] **Debe dar:** una hoja con el encabezado (profesional + profesión, paciente + documento + edad +
      fecha) y las rutas activadas. **Solo eso:** el plan no aparece.

## 5. El diagnóstico funcional se imprime

En la pestaña **Diagnóstico**, bloque **Diagnóstico funcional**.

- [ ] Pulsa **Imprimir / Guardar PDF**.
- [ ] **Debe dar:** una hoja con el mismo encabezado y el diagnóstico funcional con sus mapas. **Solo
      eso.**

> Los pasos 3, 4 y 5 juntos prueban lo mismo desde tres sitios: **una hoja a la vez**. Antes, con dos
> bloques imprimibles montados, salían los dos en el mismo papel.

## 6. El reporte ya no se aprueba: se envía

En la pestaña **Tratamiento**, al final, bloque **Reporte**.

- [ ] **Debe dar:** la tarjeta dice **Sin enviar** y ofrece dos cosas: **Ver o imprimir el reporte** y el
      botón **Enviar al paciente**. **No** debe haber caja de notas, ni botón **Aprobar**, ni los tres
      modos de envío (*Reporte de Atlas / Solo mis notas / Ambos*).
- [ ] Abre **Ver o imprimir el reporte**. **Debe dar:** el PDF del paciente, **con su plan**.
- [ ] Pulsa **Enviar al paciente**. **Debe dar:** aviso verde *"Reporte enviado al paciente."*, la tarjeta
      pasa a **Enviado**, y debajo aparece **Última entrega: (fecha) a (correo)**.
- [ ] Revisa el correo del paciente de prueba. **Debe dar:** llega con el PDF adjunto.

## 7. La observación de la consulta viaja con el reporte

Esto reemplaza a las notas del reporte, que se retiraron.

Sobre **otra** evaluación (o antes de enviar, si aún no enviaste):

- [ ] En la pestaña **Seguimiento**, escribe una **observación de la consulta** y guárdala.
- [ ] Vuelve al bloque **Reporte** y abre **Ver o imprimir el reporte**. **Debe dar:** el PDF trae esa
      observación. El preview y el correo salen de la misma fuente: si el papel la trae, el correo también.

## 8. El freno del cambio desfavorable (el paso que más importa)

> **HOY NO SE PUEDE EJERCITAR, y está verificado (2026-09-19):** en la nube no hay **ningún** seguimiento
> con banda `empeoro`. Con "Hhh Ooo" salieron 8,9 semanas entre mediciones y la banda exige **12**
> (decisión de Gildardo), así que no se sella banda y el ámbar no sale: el comportamiento es correcto.
>
> Para fabricar el caso sobre un paciente **de prueba**, está `scripts/preparar-caso-empeoro.sql` (lo
> corres tú; aborta si el paciente no está marcado como de prueba). Hacen falta las dos condiciones a la
> vez: **12 semanas o más** entre mediciones **y** que la edad bioeléctrica **suba 2 años o más**.

Solo aplica a un **seguimiento cuyo EB-BIS empeoró**.

- [ ] Con el paciente **sin próxima cita agendada**, mira el bloque **Reporte**. **Debe dar:** un aviso
      ámbar que dice que informa un cambio desfavorable y que no tiene la cita, con un enlace **Agéndala en
      Seguimiento**; y el botón **Enviar al paciente** apagado.
- [ ] Baja al bloque de la **historia clínica** y pulsa **Enviársela al paciente**. **Debe dar:** un aviso
      rojo con el mismo motivo. **No debe salir el correo.**
- [ ] **Y esto es lo que hay que confirmar que SÍ funciona:** con ese mismo paciente frenado, imprime el
      **plan** (paso 3) y las **rutas** (paso 4). **Debe dar:** imprimen normal. El freno no alcanza a lo
      que el paciente se lleva en la mano; solo a lo que le cuenta cómo va.
- [ ] Agenda la próxima cita en **Seguimiento** y vuelve al reporte. **Debe dar:** el aviso ámbar cambia
      por uno gris que dice la fecha de la cita, y el botón **Enviar al paciente** se activa.

> **Esto responde tu pregunta del otro día:** el freno mudado a la entrega **no** bloquea imprimir el plan
> de un paciente que empeoró sin cita. Frena el **reporte** y la **historia clínica**, que son los dos
> documentos que le cuentan al paciente cómo va. El plan y las rutas dicen qué hacer, y dejarlos frenados
> te dejaría sin poder entregarle nada con el paciente ahí delante.

## 9. El registro de entregas dice QUÉ se entregó

En el **editor SQL de Supabase** (esto solo lee), cambiando el id por el de la evaluación que usaste:

```sql
select scope, delivered_at, sent_to
  from hc_deliveries
 where evaluation_id = '00000000-0000-0000-0000-000000000000'
 order by delivered_at desc;
```

- [ ] **Debe dar:** una fila con `scope = 'reporte'` por el envío del paso 6, y si entregaste la historia
      clínica, otra con `scope = 'hc'`. Cada documento deja su propia constancia.
- [ ] Vuelve a la pantalla y mira el bloque de la **historia clínica**. **Debe dar:** su *"Última entrega"*
      habla de la **historia clínica**, no del reporte que acabas de enviar. (Antes de este arreglo, las dos
      pantallas leían la misma fila y decían lo mismo.)

## 10. Reenviar sigue siendo reenviar

- [ ] En la tarjeta del reporte ya enviado, escribe un motivo y pulsa **Reenviar el mismo documento**.
      **Debe dar:** sale otra vez el **mismo** PDF (no uno nuevo), y el texto de la tarjeta cuenta el
      reenvío.

---

## Lo que NO entra en este smoke

- La **corrección** de un reporte (versión nueva): no se tocó.
- Los reportes que en producción quedaron **aprobados y sin enviar**: siguen pudiendo enviarse, y el código
  lo admite a propósito. Si te encuentras uno, envíalo y dime si salió bien.
- El bloque comercial (3b sesión 2, Alegra producción): pausado, con su estado en
  `ESTADO_COMERCIAL_AL_PAUSAR_2026-09-18.md`.

---

# Segunda vuelta (2026-09-19): lo que cambió tras tu smoke

Esto **reemplaza** los pasos 3, 4, 6 y 10 de arriba; el resto sigue igual.

## 3-bis. El encabezado, en tres bloques

- [ ] Imprime el plan (Tratamiento → **Imprimir el plan**). **Debe dar**, en tres bloques separados:
      profesional + profesión / paciente + documento + edad / **Plan del paciente** + fecha.
- [ ] Imprime las **rutas** y el **diagnóstico funcional**. **Debe dar:** el mismo encabezado, con el
      título de cada hoja. Es el mismo componente en las tres.

## 5-bis. El diagnóstico ya no imprime botones

- [ ] Imprime el **Diagnóstico funcional**. **Debe dar:** sin "Explorar otros estados" y sin el bloque
      "Cierre del diagnóstico / Corregir evaluación".

> Por qué salían: esa hoja envuelve la **pantalla de trabajo**, no contenido compuesto (el plan y las rutas
> sí lo son). El CSS oculta lo que está fuera de la hoja, y esos botones estaban dentro. Ahora están
> marcados para no imprimirse. Si quieres una hoja compuesta de verdad para esa pantalla, es otra tanda.

## 4-bis. La hoja de rutas dice suplementos y remisiones

- [ ] Imprime **Rutas de atención**. **Debe dar**, después de las rutas: **Tus suplementos** (con "Lo que
      sugiere el modelo" y, si los hay, "Lo que te indicó tu profesional") y **Otros profesionales que te
      pueden acompañar** (modelo y, si las hay, las que registró el profesional). Y la próxima consulta si
      está agendada.
- [ ] Con un paciente **sin nutracéuticos prescritos**. **Debe dar:** sale solo el bloque del modelo, sin
      un título vacío del profesional.

## 6-bis. El informe

- [ ] Abre **Ver o imprimir el informe**. **Debe dar**, en este orden: título **"Informe ANI-BIS-E del
      paciente"**, el cambio respecto a la medición anterior (si es seguimiento), **Cómo estás**, tu meta,
      el plan, las porciones, la lista de intercambio, el menú, **Lo que vas a trabajar**, **Tus
      suplementos**, **Otros profesionales que te pueden acompañar** y **Tu seguimiento**.
- [ ] **Y lo que NO debe aparecer:** ninguna sigla del modelo (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, FFMI,
      FMI). Si ves una, para y dímelo: es lo único de este bloque que no puede fallar.
- [ ] La tarjeta del reporte. **Debe dar:** **sin** "Ver resultados"; al pulsar **Enviar al paciente** sale
      *"¿Lo mandamos?"* con **Sí, enviar** y **Cancelar**; cancelar no manda nada.

## 10-bis. Reenviar

- [ ] En un informe ya enviado, pulsa **Reenviar el mismo documento**. **Debe dar:** pregunta *"¿Lo
      reenviamos?"*, **sin** pedir motivo, y la tarjeta sigue contando cuántas veces se reenvió.
- [ ] Compara el PDF que llega con el del primer envío. **Debe dar:** idénticos. Ahora se mandan los bytes
      guardados, no un render nuevo (antes, si el plan cambiaba entre los dos envíos, "el mismo documento"
      dejaba de serlo en silencio).

## 11. La ficha del paciente ya se puede corregir

- [ ] Abre la ficha de **"Hhh Ooo"** (el paciente sin correo). **Debe dar:** la tarjeta **Fecha de
      nacimiento** entre las demás, y un botón **Corregir el contacto** con la línea *"Sin correo no se le
      puede enviar su reporte ni su historia clínica"*.
- [ ] Pulsa, escribe un correo y guarda. **Debe dar:** aviso verde, y la tarjeta de Correo actualizada.
- [ ] **Debe dar también:** el formulario **NO** permite cambiar nombre, documento ni fecha de nacimiento,
      y lo dice (eso toca identidad y consentimiento, y sigue en el backlog con su decisión pendiente).
- [ ] Vuelve a su evaluación y envíale el informe. **Debe dar:** ahora sí sale (si tiene la próxima cita
      agendada, porque empeoró).

## Lo que queda abierto de esta vuelta

- **Los gráficos de trayectoria en el informe:** segunda tanda, como acordamos.
- **La redacción de las rutas para el paciente:** pregunta abierta con Gildardo
  (`docs/PENDIENTES_CIENTIFICOS.md`, entrada del 19/9). Hoy se filtra lo que nombra índices del modelo y el
  componente médico viaja como remisión.
- **El pulido gráfico:** `PULIDO_GRAFICO_PENDIENTE.md`.

---

# Tercera vuelta (2026-09-19, tarde): lo del informe y las simultáneas

## 12. Ningún índice en el informe

- [ ] Abre el informe de un paciente con rutas activas. **Debe dar:** en *Otros profesionales que te pueden
      acompañar*, la urgencia dice **"(valoración recomendada)"** o **"(valoración obligatoria)"**, y
      **nunca** "si IAE > 10 años" ni ningún otro índice.
- [ ] Mira *Lo que vas a trabajar*. **Debe dar:** indicaciones que el paciente puede hacer, sin siglas del
      modelo y **sin guiones largos**.

## 13. La tercera salida del informe

- [ ] En un informe ya **enviado**, mira el bloque **¿Cambió algo después de enviarlo?**
- [ ] Escribe una observación nueva en **Seguimiento** y pulsa **Emitir una versión nueva** → **Sí,
      emitirla**. **Debe dar:** la tarjeta vuelve a **Sin enviar**, con el informe nuevo.
- [ ] Ábrelo. **Debe dar:** trae la observación nueva. El anterior sigue enviado en `/reportes`.
- [ ] Vuelve a pulsar **Emitir una versión nueva** sin enviar la que acabas de crear. **Debe dar:** avisa
      que ya hay una versión nueva sin enviar.

## 14. Las simultáneas

- [ ] **Checkout:** abre un link de pago. **Debe dar:** el logo de **VITACELLEBIS**, debajo *CONNECTED
      NUTRITION VENTURES S.A.S. / NIT 902045562-3*, y **sin** el logo de Atlas.
- [ ] **Import BIS sin cintura:** intenta importar un XLSX al que le falte. **Debe dar:** *"Se mide
      siempre: es parte del estándar de la medición y de los datos que sostienen la investigación"*, sin
      hablar de "decisión de negocio" ni del "motor".
- [ ] **Encuesta, contador:** abre la encuesta del paciente. **Debe dar:** donde había un guion, dice
      **sin responder**; pulsar "Ninguno" pone **0**.
- [ ] **Pase sin correo:** con un pase en curso, entra a crear otro. **Debe dar:** el bloque *"Tienes un
      pase en curso"* con **Anular este pase y empezar otro**; al pulsarlo, el pase se anula **de verdad**
      y el siguiente intento funciona.
- [ ] **Preguntas que faltan:** en una evaluación con encuesta incompleta, mira el bloque de la barra.
      **Debe dar:** la lista de preguntas sin responder, con su número y su dominio; al pulsar una, la
      encuesta abre **en esa pregunta**.
- [ ] **Descargar respuestas:** junto a "Ver o editar encuesta", pulsa **Descargar respuestas**. **Debe
      dar:** un CSV que abre bien en Excel (con tildes), con el paciente y la fecha arriba, y las preguntas
      sin responder marcadas como *(sin responder)*.

## 15. La ficha se cierra al guardar

- [ ] Corrige el contacto de un paciente y guarda. **Debe dar:** el formulario **se cierra** y la tarjeta
      de Correo muestra el valor nuevo (antes se quedaba abierto tapándola).

---

# Cuarta vuelta (2026-09-19, noche)

## 16. El consentimiento por QR abre sin sesión

- [ ] Genera un pase (**Si el paciente no tiene correo** → *Mostrar el código al paciente*). **Debe dar:**
      un **QR** además del enlace.
- [ ] Abre el enlace en el teléfono, **o en una ventana de incógnito**. **Debe dar:** la pantalla del
      consentimiento del paciente. **No debe pedir iniciar sesión** (era el defecto: el proxy lo rebotaba a
      `/login`, y el paciente no tiene cuenta).
- [ ] Escanea el QR con un teléfono. **Debe dar:** la misma pantalla.

## 17. El informe, dos detalles

- [ ] Abre el informe de una consulta con observación. **Debe dar:** dentro de *Tu seguimiento*, el rótulo
      **"Observaciones de tu profesional:"** y debajo el texto. Una sola vez.
- [ ] Abre un link de pago. **Debe dar:** el logo de VITACELLEBIS **sin deformar** (antes iba estirado
      porque las medidas declaradas no eran las del archivo).

## 18. La pregunta 32

Después de aplicar `0149_pregunta_32_mas_clara.sql`:

- [ ] Abre la encuesta del paciente. **Debe dar:** *"¿Cuántas comidas consume al día?"*
- [ ] Descarga las respuestas (paso 14). **Debe dar:** la misma redacción en el CSV.

## 19. Si el scroll de "Agregar observación" vuelve

No lo he podido reproducir leyendo el código: ese formulario ya pasa por el guard y su acción no revalida.
Si lo ves otra vez, pega esto en la consola del navegador (F12 → Consola) **antes** de pulsar el botón:

```js
(() => { const t0 = Date.now(); addEventListener("scroll", () => console.log("scroll", ((Date.now()-t0)/1000).toFixed(1)+"s", Math.round(scrollY)), { passive: true }); console.log("mirando. Ahora pulsa Agregar observación."); })()
```

Y pásame lo que imprima. Con eso se sabe si la página se movió una vez o dos, cuándo, y si volvió sola.

---

# Quinta vuelta (2026-09-20): el SOAP y lo demás de hoy

## 20. La historia clínica en formato SOAP

- [ ] En una evaluación con diagnóstico, pestaña **Reporte / Historia clínica**, pulsa **Ver en formato
      SOAP**. **Debe dar:** una pantalla con los cuatro apartados (S, O, A, P) y la cabecera del paciente.
- [ ] Mira el apartado **S**. **Debe dar:** el motivo de consulta, los antecedentes y **la encuesta
      redactada por dominio**, con cada frase en la forma *"cuántas comidas consume al día: 3"*.
- [ ] Si la encuesta tenía preguntas sin responder. **Debe dar:** al final del párrafo, *"Quedaron sin
      responder las preguntas N, M"*. No deben desaparecer en silencio.
- [ ] Pulsa **Copiar** y pega en un correo o en el bloc de notas. **Debe dar:** el documento entero en
      texto plano, con los cuatro apartados y la cabecera.
- [ ] Pulsa **Imprimir o guardar PDF**. **Debe dar:** solo el documento, sin los botones.
- [ ] Vuelve a la evaluación. **Debe dar:** la historia clínica sigue **igual que antes**. El SOAP no la
      reemplaza.

## 21. El caso del "empeoró", preparado en LOCAL

No hace falta tocar la nube. En tu base local ya quedó listo:

- **Paciente:** *Demo Trayectoria Empeoro 1 (confirmar y agendar)*, documento `TRAJ-DEMO-00`.
- **Evaluación:** `a0000000-0000-4000-8000-0000ee010002` (banda `empeoro`, informe en borrador y **sin
  próxima cita**, que es lo que faltaba).

- [ ] Ábrelo en local y ve a **Reporte**. **Debe dar:** el aviso ámbar y el botón **Enviar al paciente**
      apagado.
- [ ] Intenta entregar la **historia clínica**. **Debe dar:** el mismo motivo, y no sale el correo.
- [ ] Imprime el **plan** y las **rutas**. **Debe dar:** imprimen normal (el freno no alcanza a lo que el
      paciente se lleva en la mano).
- [ ] Agenda la próxima cita en **Seguimiento** y vuelve. **Debe dar:** el aviso pasa a gris con la fecha y
      el botón se activa.

## 22. "Atlas Pacientes", donde debía verse

- [ ] Abre **Link de consultorio**. **Debe dar:** el título dice *"Link de consultorio · Atlas Pacientes"*.
- [ ] Pulsa **Mostrar QR de consultorio**. **Debe dar:** el diálogo se titula *"QR de consultorio · Atlas
      Pacientes"*.
- [ ] Entra a crear un paciente en consulta. **Debe dar:** las dos vías (con correo y sin correo) nombran
      **Atlas Pacientes** como el sitio al que entra el paciente.
