# Propuesta · el flujo comercial dentro de Tratamiento

**Para Santiago, 2026-09-26.** Lo que pediste del punto C. **El defecto ya está arreglado** (ver abajo); lo que
sigue es la propuesta del rediseño, que necesita tu decisión porque toca un registro clínico.

---

## 1 · El defecto: diagnosticado y arreglado

**Lo que pasó:** el integrante marcó "el paciente **sí** los adquiere" y debajo no apareció nada. Ni el enlace,
ni un aviso, ni una caja en gris.

**La causa:** el bloque de venta hacía `return null` mientras la prescripción no estuviera **entregada** (el
cobro cuelga de haber entregado el plan: venderle un producto es un acto posterior a prescribirlo). Y el aviso
que la pantalla sí tiene ("la venta se habilita cuando el paciente los adquiere") **solo sale cuando la
respuesta NO fue "sí"**. Así que en el camino correcto la pantalla se quedaba muda.

**Lo llamativo:** la lección estaba escrita **veinte líneas más abajo en el mismo archivo**, para el caso de
"nada vendible": *"la lección de la ausencia contra la fila vacía: un bloque que no está no informa de nada"*.
Se había aplicado a un gate y no al otro.

**Ya está:** ahora dice que el cobro se habilita al entregar el plan, y dónde se entrega. Es el paso 2 de la
parte 9 del smoke.

---

## 2 · Las tres opciones: cómo quitarlas sin perder lo que sí sirve

Hoy el profesional responde **sí / no / pendiente**, y el "no" pide una razón de seis posibles.

**Antes de proponer quitarlas, lo que hay que saber de lo que capturan** (porque una de esas razones no es
comercial, es clínica):

| Razón | Qué es | Si se quita |
| --- | --- | --- |
| `profesional_clinica` | **El profesional lo descartó por una razón clínica.** Se guarda como **contraindicación del paciente** y se muestra a todo profesional que lo atienda después | **Se pierde información clínica.** Es lo único de este bloque que no es comercial |
| `profesional_no_clinica` | Lo descartó por otra razón suya | Se pierde un dato de gestión |
| `costo`, `lo_piensa`, `ya_toma_otros`, `otra` | Por qué el paciente no compra | Se pierde información comercial agregada |

**Y la distinción que el código protege hoy, que es clínica y no de producto:** *no prescribir* no es lo mismo
que *prescribir y que el paciente no compre*. Lo segundo es **una indicación que no se cumple**, y eso importa
en la siguiente consulta.

### La propuesta: que la respuesta salga del CAMINO, no de una casilla

Es el mismo criterio que ya aplicamos con `captured_by` de la encuesta ("la procedencia sale del camino y no de
una casilla"):

1. **Se quita la pregunta de tres opciones.** En su lugar, el bloque de cobro aparece **siempre** que haya algo
   prescrito y vendible, sin preguntar nada. Si el paciente compra, el profesional genera el cobro: **eso ES el
   "sí"**, y queda registrado por la venta misma, que es un hecho y no una declaración.
2. **El "no" y el "pendiente" desaparecen como pregunta** y se vuelven la ausencia de venta, que es lo que son.
   Nadie tiene que declarar que algo no pasó.
3. **Lo clínico se salva moviéndolo a donde pertenece:** el descarte por razón clínica pasa a ser un botón **en
   la línea del producto prescrito** ("descartar por razón clínica"), que es donde el profesional está mirando
   cuando lo decide. Sigue escribiendo la contraindicación del paciente, igual que hoy.
4. **Lo comercial agregado (costo, lo piensa, ya toma otros) se pierde, y hay que decidirlo a sabiendas.** Mi
   lectura: se puede perder. Es información de mercadeo que hoy nadie consulta, y su costo es un formulario en
   cada consulta. Si algún día hace falta, se pregunta **una vez al mes a los integrantes**, no en cada paciente.

**Lo que hace falta de ti:** confirmar el punto 4. Los otros tres los construyo sin más.

---

## 3 · Los dos bloques

### Bloque A · Nutracéuticos

```
Nutracéuticos
├─ [contraindicaciones del paciente, si hay]        ← ya existe, se queda arriba
├─ El modelo recomienda                            ← ya existe
│    · VITACELLEBIS D3-K2 · 1 cáp/día   [Agregar]
└─ ▸ ¿Quieres prescribir un nutracéutico que el modelo no recomendó?   ← PLEGADO
       └─ [desplegable con el catálogo]  [Agregar]
```

**Lo que cambia respecto de hoy:** el desplegable está siempre abierto y con el catálogo entero a la vista, al
mismo nivel que la recomendación del modelo. Eso hace que **prescribir contra el modelo se vea igual de normal
que seguirlo**, y no lo es: el modelo es lo que Atlas propone y lo otro es una decisión propia del profesional.
Plegarlo no lo esconde, lo pone en su lugar; el rótulo que propusiste ya dice exactamente eso.

**Y el desplegable deja de traer LUVIA**, que es lo que más confunde hoy: un producto de tercero en la misma
lista que los nutracéuticos de CNV.

### Bloque B · Otros productos

```
▸ ¿Quieres prescribir un producto que no es un nutracéutico de CNV?
     └─ LUVIA                                        [Agregar]
        Mezcla en polvo para bebida a base de arroz con avena, linaza, psyllium y probióticos.
        Polvo · 600 g   ·   1 scoop (15 g) en un vaso con agua
        INVIMA RSA-0019736-2022   ·   Laboratorio Naturex S.A.S.   ·   código 7232
        Contiene avena
```

**Es la ficha de Gildardo, tal cual.** La leí en su HTML v9 (`OTROS_PRODUCTOS`, línea 1303) y trae exactamente
esos campos: nombre, descripción, presentación, dosis, INVIMA, alérgenos, fabricante y código. **Se porta, no se
mejora.**

**Y una línea suya que hay que conservar entera**, porque es Regla 0 y ya la tenemos decidida igual:

> *"Contiene avena: el alérgeno se muestra en la tarjeta tal como lo declara la ficha. **El sistema no lo cruza
> con las alergias de la encuesta.**"*

Eso coincide con lo que ya hicimos: yuxtaponer las dos declaraciones y que valore el profesional. La tarjeta
muestra el alérgeno del producto, y lo que el paciente declaró sigue saliendo al lado, como hoy.

**Una diferencia de ubicación que te devuelvo en vez de decidirla:** en su HTML la ficha vive en
**Diagnóstico → rutas de atención, debajo de los VITACELLEBIS**. Tú lo quieres como bloque en Tratamiento. En
Atlas las rutas de atención están en Tratamiento, así que puede que sea el mismo sitio con otro nombre, pero no
quiero suponerlo: **¿va donde están las rutas, o como bloque aparte debajo de los nutracéuticos?**

---

## 4 · Lo que queda igual, y por qué

- **El cobro sigue colgando de haber entregado el plan.** No es burocracia: venderle un producto a alguien es
  posterior a prescribírselo, y ese orden es el que hace que la venta tenga un respaldo clínico.
- **Los productos que no se venden en consultorio siguen apareciendo marcados**, no ocultos: el profesional
  tiene que saber que el modelo los contempla aunque no los pueda entregar hoy.
- **El aviso de cobro duplicado se queda.** Es lo que evita cobrarle dos veces al mismo paciente por el mismo
  producto, y con un botón menos en la pantalla vale más, no menos.

---

## 5 · Tamaño

| Paso | Necesita decisión |
| --- | --- |
| Plegar el desplegable del catálogo con su rótulo | No |
| Sacar los productos de tercero del desplegable de nutracéuticos | No |
| El bloque B con la ficha de LUVIA portada | Solo **dónde va** (sección 3) |
| Quitar las tres opciones y mover el descarte clínico a la línea del producto | Sí: **confirmar que se puede perder lo comercial agregado** |

Lo que no necesita decisión lo construyo mientras haces el smoke.
