# Otros productos · LUVIA · especificación para portar

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 26 de agosto de 2026

Van a empezar a llegar productos que **venden nuestros integrantes pero no hacen parte del sistema**.
Necesito un área nueva para ellos. Ya está construida en mi archivo; esto es la especificación para que
la porten.

---

## 1. Qué son, y por qué no van con los VITACELLEBIS

Los VITACELLEBIS **se indican por diagnóstico**: salen de un sector EFyR, de un índice alterado, de una
ruta activa. El sistema los propone.

Estos otros no. **El integrante los tiene en comodato y los vende, pero no hay diagnóstico previo que
los indique.** El profesional los ofrece por criterio clínico, igual que recomendaría cualquier cosa que
no está en el modelo.

**Esa diferencia no puede quedar difuminada en la pantalla.** Si aparecen mezclados con los
VITACELLEBIS, el profesional —y sobre todo el paciente que lea el plan— van a leer que el sistema
recomendó un producto que el sistema no recomendó. Por eso van en un área propia, separada y rotulada.

## 2. Dónde va

**Módulo Diagnóstico → rutas de atención, inmediatamente debajo del bloque de VITACELLEBIS**, dentro de
la misma sección, separado por una línea punteada.

Rótulo del área: **OTROS PRODUCTOS**

Leyenda, textual: *«No se indican por diagnóstico: el profesional los ofrece por criterio clínico. Se
despachan con el mismo registro.»*

## 3. Cómo se comporta

**Igual que los VITACELLEBIS**: casilla de verificación por producto, campo de unidades cuando se marca,
y el mismo botón de registrar despacho.

En mi archivo comparte el estado de selección y de cantidades con los VITACELLEBIS, de modo que el
registro de despacho los recoge sin lógica aparte. **Háganlo igual**: un solo acto de despacho, una sola
selección, un solo registro. Si lo separan en dos flujos, el profesional va a tener que despachar dos
veces y alguno se le va a quedar sin registrar.

**Un caso que hay que atender y que a mí se me pasó primero:** el botón de despacho de los VITACELLEBIS
solo se dibuja cuando hay productos indicados. Si el paciente tiene los índices normales, no hay lista y
no hay botón — y entonces los productos externos no se podrían despachar. **El área de otros productos
necesita su propio botón para ese caso.**

## 4. El envío va al resumen de la historia clínica

**El reporte del envío debe aparecer en el resumen de la HC**, en el mismo bloque donde hoy salen los
nutracéuticos enviados, con su dosis y su presentación.

En mi archivo esto sale gratis porque comparten el registro: lo que se despacha se escribe en la misma
clave que ya lee la historia clínica. Verifiquen que en el suyo también, y que **la HC distinga que es
un producto externo** — no puede leerse como si el modelo lo hubiera indicado.

## 5. El catálogo, para que ustedes lo extiendan

Es una lista, no código embebido en la pantalla. **Santiago añade aquí los productos que se vayan
acordando** y aparecen solos, sin tocar nada más:

```js
const OTROS_PRODUCTOS = [
  {
    nombre:       "LUVIA",
    disponible:   true,
    descripcion:  "Mezcla en polvo para bebida a base de arroz con avena, linaza, psyllium y probióticos.",
    presentacion: "Polvo · 600 g",
    dosis:        "1 scoop (15 g) en un vaso con agua",
    invima:       "RSA-0019736-2022",
    alergenos:    "Contiene avena (gluten)",
    fabricante:   "Laboratorio Naturex S.A.S.",
    codigo:       "7232"
  }
];
```

**`disponible: false` lo retira de la pantalla sin perder la ficha.** Un producto cuyo acuerdo se acaba
no se borra: se apaga. Así queda el rastro de lo que se despachó cuando estaba activo.

## 6. LUVIA · la ficha completa

Es el primero. Datos tomados de la ficha técnica del fabricante:

| | |
|---|---|
| **Marca** | LUVIA |
| **Código de producto** | 7232 |
| **Producto** | Mezcla en polvo para preparar bebida a base de arroz con avena, linaza, psyllium y probióticos |
| **Registro sanitario** | INVIMA **RSA-0019736-2022** |
| **Fabricante** | Laboratorio Naturex S.A.S. |
| **Presentación** | 600 g · pote de 1.100 mL |
| **Modo de uso** | Disolver un scoop (15 g) en un vaso con agua |
| **Vida útil** | 24 meses |
| **Almacenamiento** | Bien tapado, lugar fresco y seco, temperatura ambiente |
| **Alérgenos** | **Contiene avena (gluten)** |

**Ojo con el nombre.** En la conversación se ha escrito «Luviaa»; **la ficha técnica y el registro
sanitario dicen LUVIA**, y es el nombre que usé. Si el nombre comercial lleva doble a, corríjanlo en el
catálogo y díganmelo, porque el que manda es el del registro.

## 7. El alérgeno, y lo que todavía no está resuelto

**LUVIA contiene gluten.** Lo puse visible en la tarjeta, en ámbar, para que el profesional lo lea al
marcar la casilla.

Pero eso es un aviso, no una salvaguarda. **El sistema todavía no cruza el alérgeno del producto con las
alergias e intolerancias que el paciente declaró en la encuesta.** Es exactamente el hueco del que
hablamos en su punto 3.2, ahora con un caso concreto y en producción.

**Cuando construyan el cruce de alergias, LUVIA es el primer caso de prueba:** un paciente que declaró
intolerancia al gluten no debería poder recibirlo sin una advertencia dura. Mientras tanto, **el aviso
en la tarjeta es lo único que hay entre el producto y el paciente**, y conviene que lo sepan.

Y anoten la asimetría: los VITACELLEBIS los indica el sistema, que sabe lo que sabe. Estos los ofrece
una persona. La responsabilidad de mirar el alérgeno es hoy enteramente del profesional, y la pantalla
tiene que ayudarle a hacerlo.

---

## Resumen

| # | Qué |
|---|---|
| 1 | Área **OTROS PRODUCTOS** en Diagnóstico → rutas, **debajo de los VITACELLEBIS**, separada y rotulada |
| 2 | **No se indican por diagnóstico.** La leyenda lo dice y no puede quitarse |
| 3 | Casilla + unidades + **el mismo botón de despacho**. Un solo acto, un solo registro |
| 4 | **Botón propio** para cuando el paciente no tiene VITACELLEBIS indicados |
| 5 | El envío va al **resumen de la HC**, distinguiendo que es producto externo |
| 6 | Catálogo `OTROS_PRODUCTOS` extensible por ustedes. `disponible:false` apaga sin borrar |
| 7 | **LUVIA** · INVIMA RSA-0019736-2022 · Naturex · 600 g · 15 g por toma · **contiene gluten** |
| 8 | El alérgeno **se avisa pero no se cruza** con la encuesta. Primer caso de prueba del 3.2 |

**Va adjunto el `ATLAS_v8.html`** con todo esto construido, para que lo porten mirándolo.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
