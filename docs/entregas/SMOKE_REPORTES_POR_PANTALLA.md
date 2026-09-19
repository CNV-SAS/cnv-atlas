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

Solo aplica a un **seguimiento cuyo EB-BIS empeoró**. Si no tienes uno a mano, dime y te paso la consulta
para encontrarlo (solo lee).

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
