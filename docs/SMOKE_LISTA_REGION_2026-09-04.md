# Smoke: la lista de intercambio por región (2026-09-04)

**Un caso, dos pantallas.** Entró el séptimo y último bloque del plan del paciente: la lista de
intercambio recortada a su región. Es contenido que llega a un paciente, así que se mira en un navegador
real.

`pnpm dev`, y entra como el nutricionista de siempre.

---

## El caso · El paciente recibe los alimentos de su región, no los 350 del país

**Qué se construyó.** El plan del paciente tenía seis de los siete bloques de su §7.1. El séptimo estuvo
bloqueado meses porque su tabla de intercambio es nacional y faltaba el mapa de qué alimentos
corresponden a cada región. Ese mapa llegó el 3 de septiembre (existía desde el 2, pero venía suelto en
la carpeta y no dentro del HTML, que es donde su documento decía que estaba).

### a) Qué paciente

**`/evaluaciones/a0000000-0000-4000-8000-0000000000a3`**

El mismo del smoke de la grasa: tiene tratamiento y cadena calórica completa. **No hay que sembrar nada.**

Sirve cualquier paciente con tratamiento. Lo único que importa es **qué ciudad tiene en su perfil**, que
es lo que decide el recorte.

### b) Qué provocar

1. Abre el **reporte del paciente** (el que se imprime o se envía), no la pantalla del profesional.
2. Baja hasta el final. El bloque nuevo se llama **"Tu lista de intercambio"** y va **después** de las
   recomendaciones.
3. Míralo también en el **PDF**, donde arranca en **su propia página**.

### c) Qué mirar

| Dónde | Qué tiene que decir |
| --- | --- |
| **Encima de la lista** | `Preparada para <ciudad>, región <nombre>: N alimentos de los 350.` |
| **Los grupos** | Los doce, en el orden de siempre (Harinas, Verduras, Frutas, Lácteos...) |
| **Cada subgrupo** | `Cereales: arroz blanco (30 g), pan tajado (25 g), ...`, y **como mucho ocho**, con `, entre otros` si hay más |

**El número N depende de la ciudad.** Las diez que él verificó, por si quieres cotejar contra su tabla:

| Ciudad | Región | Alimentos |
| --- | --- | --- |
| Barranquilla | Caribe | 83 |
| Bogotá | Cundiboyacense | 82 |
| Medellín | Antioquia y Eje Cafetero | 80 |
| Cali | Valle y Cauca | 70 |
| Cúcuta | Santanderes | 65 |

### d) Qué sería defecto

- Que **no aparezca el bloque**. Es el defecto que más veces nos ha pasado: la pieza portada y sin
  renderizar.
- Que el encabezado diga **"Lista completa: 350 alimentos"** con un paciente cuya ciudad **sí** está en
  el mapa. Eso sería que la ciudad no está llegando al lector.
- Que **la pantalla y el PDF muestren listas distintas**. Los dos leen el mismo dato, así que una
  diferencia entre ellos es una fuente que se coló.
- Que un subgrupo muestre **más de ocho alimentos**, o que diga `, entre otros` cuando solo hay tres.

### e) Lo que NO es defecto, aunque lo parezca

**Vas a ver entre seis y ocho subgrupos con el rótulo y nada detrás:** "Azúcares y dulces:", "Mecato:",
"Bebidas alcohólicas:", "Leche descremada:", y según la ciudad "Nueces:" o "Semillas:".

**Eso es de su archivo, no nuestro.** Su render no filtra el subgrupo sin alimentos, y lo portamos tal
cual: suprimirlo sería un arreglo de forma que taparía un hueco de contenido suyo. Va preguntado en la
ronda del 4 (punto 7) con las tres salidas posibles.

Si te molesta a la vista, es exactamente el punto: por eso se pregunta.

---

## Lo que ya está verificado por código, para que no gastes el smoke en ello

- **Los diez conteos de su tabla**, ciudad por ciudad. Es un oráculo externo suyo, no una comparación de
  nuestra copia contra la suya.
- **Que ningún alimento se caiga en silencio** por un nombre con otra tilde (integridad referencial
  contra la tabla nacional: cero huérfanos).
- **Su regla del homónimo**: "Madrid" resuelve a Cundiboyacense y "Madrid España" recibe la lista
  completa. Él la señaló como el primer caso a probar si alguna vez se ablanda la comparación.
- **Que las 224 líneas de municipios vienen de su archivo**, no de una transcripción: las únicas ocho
  líneas nuestras que difieren son de tipado y están declaradas una por una.

Lo que el smoke añade a eso es lo único que un test no puede ver: **que el bloque se renderice y se lea**.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
