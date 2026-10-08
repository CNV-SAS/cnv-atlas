# La venta desde la bodega no se registra como domicilio (y nadie pide la dirección)

**Encontrado el 2026-10-08, por una pregunta de Santiago en el punto 10 del primer smoke.** No se arregló
todavía: hay dos decisiones que no son nuestras. Esto es lo verificado, para que se decida con los hechos.

---

## La pregunta que lo encontró

> *"Ya está el aviso del domicilio, pero me pregunto si también es necesario capturar los datos de dirección,
> celular, etc. que ya tiene el bloque de domicilio en /pagos."*

La respuesta corta es **sí, y no es una mejora: hoy no los pide nadie, en ningún momento del flujo.**

## La cadena, verificada en el código

1. **La venta desde la bodega no se marca como domicilio.** `payments-writer` escribe
   `deliveryMode: input.domicilio ? "domicilio" : "en_consulta"`, y el formulario de la consulta nunca manda
   `aDomicilio` (`leerDomicilio` devuelve `undefined` sin él). El interruptor que sí manda es `desdeLaBodega`,
   que solo decide **de qué ubicación sale el inventario**.
   **Resultado: queda `delivery_mode = 'en_consulta'`, que es literalmente lo contrario de lo que pasó.** La
   pantalla le dice al profesional, con esas palabras, que *"el paciente no se lleva el producto hoy"*.

2. **Y `shipping_city`, `shipping_address` y `shipping_phone` quedan en `null`**, porque solo se escriben desde
   el bloque de `/pagos`.

3. **Así que no aparece en "Envíos por coordinar".** `enviosPorCoordinar()` filtra
   `delivery_mode = 'domicilio'`. Quien tiene que mandar el producto **no ve esa venta en el panel que existe
   para eso**, y aunque la viera no tendría dirección ni celular.

4. **Y no se le calcula el derecho de retracto.** `retractosDeLasVentas` filtra por el mismo
   `delivery_mode = 'domicilio'`.

5. **Pero sí aparece en "Pendientes sin salida"**, que se construye desde el inventario y no desde el modo de
   entrega. **Por ahí se despachó en el smoke**: admin la marcó entregada sin que nadie hubiera registrado
   nunca a dónde iba.

**O sea: una venta pagada, que el paciente no se lleva, se marca como entregada y en ninguna parte queda
dónde se entrega.** En el smoke no se notó porque el "paciente" era de prueba y nadie tenía que enviar nada.

## Las dos decisiones, y por qué no las tomo yo

### 1. ¿Una venta desde la bodega da derecho de retracto? (legal, de Santiago)

Marcarla `'domicilio'` **activa el retracto sobre toda esa clase de ventas**, automáticamente, porque la regla
cuelga de esa columna. Eso es una determinación legal, no un ajuste de pantalla: el retracto del Estatuto del
Consumidor es para la venta a distancia, y una entrega por mensajería lo es; una entrega en el consultorio no.

**Mi lectura, para que haya algo que confirmar o corregir:** si el producto va por mensajería, sí aplica, y hoy
no se está calculando. Pero quien lo confirma es el asesor legal, igual que el texto del aviso.

### 2. ¿Quién captura la dirección, y cuándo?

Dos caminos, y el segundo me parece mejor:

- **(a) En la consulta, al cobrar.** Es donde está el paciente, que es quien sabe la dirección. El costo es que
  le añade campos a la pantalla más cargada del flujo, y el profesional puede no tenerla a mano.
- **(b) Al coordinar el envío, por parte de quien despacha (recomendado).** La venta entra en "Envíos por
  coordinar" **sin dirección y diciéndolo**, y quien coordina la pide y la registra. CNV es quien habla con la
  mensajería y quien confirma el valor del envío, así que es quien ya va a llamar al paciente de todos modos.
  **Y el aviso que ya se puso en la consulta sigue siendo necesario**, porque lo que no se puede es cobrarle sin
  decirle que el envío lo paga aparte.

**Lo que NO puede quedarse como está, en cualquiera de los dos casos:** `delivery_mode = 'en_consulta'` para una
venta que el paciente no se lleva. Esa columna es la que decide quién la ve y qué derechos se le calculan, y hoy
dice lo contrario del hecho.

## Cómo se comprueba que sigue abierto

```sql
select t.id, t.delivery_mode, t.shipping_address, t.fulfillment_state, l.kind as salio_de
  from transactions t
  join inventory_locations l on l.id = t.location_id
 where l.kind <> 'integrante' and t.status = 'paid'
 order by t.created_at desc;
```

Mientras salga `delivery_mode = 'en_consulta'` con `salio_de = 'central'`, el hueco está vivo.
