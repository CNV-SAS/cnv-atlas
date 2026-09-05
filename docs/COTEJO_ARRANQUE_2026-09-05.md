# El arranque del cotejo final

**Para Santiago. 2026-09-05.** Paciente: **Nico Smoke Final, CC 122333**, en los tres sitios.

Método, criterios y qué NO es hallazgo: `COTEJOS_VISUALES.md`. Esto es solo el arranque.

---

## a) El orden SÍ importa, y en un solo punto

**Dos de los tres dan igual. El de la nube no.**

| Sitio | ¿Cuándo? | Por qué |
| --- | --- | --- |
| **El archivo de Gildardo** | Cuando quieras | Es un HTML suelto, no tiene versiones ni sella nada |
| **Local** | Cuando quieras | Ya está en `anibise-1.3.0` con la 0100 aplicada |
| **Atlas web (nube)** | **DESPUÉS de confirmar que corre 1.3.0** | Un diagnóstico se sella y **no se reescribe** |

**El riesgo concreto:** si generas el diagnóstico en la nube antes de que el despliegue de `1.3.0`
aterrice, queda sellado con `1.2.0` y el LE8 apagado. Ese snapshot es inmutable: no se corrige, se
reemite. Y estarías cotejando la ciencia de anteayer contra la de hoy sin que nada lo diga.

### Cómo confirmarlo sin gastar el paciente

**Abre cualquier evaluación vieja de la nube que ya tenga diagnóstico** (no la de Nico) y mira si sale el
aviso de versión anterior:

- **Sale el aviso**, diciendo *"motor clínico: se emitió con `anibise-1.2.0`, hoy rige `anibise-1.3.0`"*
  → **el despliegue aterrizó**. Adelante.
- **No sale ningún aviso** en una evaluación sellada con `1.2.0` → **la nube todavía corre `1.2.0`**.
  Espera el despliegue.

Funciona porque el aviso compara la versión sellada contra la del **código que está corriendo**. Es una
lectura, no escribe nada, y no consume nada.

---

## b) Que los tres partan de lo MISMO, que es lo que hace válido el cotejo

**La nube:** la 0099 y la 0100 aplicadas. `pnpm db:check:cloud` tiene que decir **101 en el repo y 101
aplicadas**. Sin la 0099 la nube sirve la encuesta v5 y las pantallas de encuesta no son comparables; sin
la 0100 la marca de qué lee el motor queda corta.

**Y una cosa NUEVA de ayer que puede producir un hallazgo falso, así que va antes de las capturas:**

> **Desde que se encendió el LE8, el ICEC depende de la matriz de frecuencia de alimentos (los quince
> grupos) y de los vasos de agua.** Hasta anteayer esos dieciséis campos no llegaban al motor y daban lo
> mismo en todo paciente.

Si en los tres sitios esos dieciséis no están respondidos **igual**, el ICEC va a salir distinto, y con
él la EB-BIS, el IAE, los dominios 3 y 5, el riesgo integrado y las rutas R4 y R5. **Eso no sería un
hallazgo del cotejo: sería que los insumos no coincidían.** Vale la pena verificarlos uno a uno antes de
capturar nada.

**Y al revés, es la comprobación más fuerte del turno:** si el **ICEC de Atlas coincide con el de su
archivo** para el mismo paciente, el porte del LE8 queda verificado de punta a punta, contra su propia
implementación y no contra nuestra aritmética.

**Y la fecha:** la edad se calcula a la fecha de la consulta, no a hoy. Si generas en días distintos y el
paciente cumple años en medio, cambia. Genera los tres el mismo día y no hay nada que mirar.

---

## c) Qué entra en esta pasada y qué no

**Entran las CLÍNICAS**, que es donde el cotejo vale y donde el pase de diseño no las va a mover:

| Pestaña | Qué se mira |
| --- | --- |
| **Evaluación** | La encuesta como la ve el profesional, las alertas de entrada, la composición y el import BIS |
| **Diagnóstico** | Los indicadores con sus clasificaciones, el DFI con sus cinco dominios, la Diana, el radar, el fenotipo y las rutas |
| **Tratamiento** | El objetivo, la cadena calórica, la prescripción, la distribución por tiempos, la lista de intercambio y las rutas con sus nutracéuticos |

**NO entran los tres documentos**, y no es que se salten: **van después del pase de diseño** (gate 4 de
`LANZAMIENTO.md`). Son el **plan del paciente**, la **historia clínica imprimible** y el **reporte**, que
viven en la pestaña **Reporte / HC**.

La razón, escrita para no tener que rediscutirla: son **dos ejes sobre los mismos píxeles**. El cotejo
mira **QUÉ** se muestra (de él, su archivo manda) y el pase de diseño mira **CÓMO** (nuestro, manda
`BRAND.md`). Cotejarlos ahora sería cotejar dos veces, y lo que no conviene es mirarlos **sin decidir
cuál de las dos cosas se está mirando**: un hallazgo de forma en un documento que todavía va a
rediseñarse no es un hallazgo, es ruido que después hay que separar del real.

**La pestaña de Seguimiento tampoco entra**: no tiene contraparte en su archivo.

---

## Y al recorrer

**Por zonas, no todo al final**, que es como se construyó el cotejo del Nutricionista: cada tanda con su
smoke. Y con los tres criterios de `COTEJOS_VISUALES.md`:

- **Lo que él tiene y nosotros no** → probablemente falta. Es hallazgo accionable siempre.
- **Lo que tenemos y él no** → se defiende con su razón o se retira.
- **Lo que se ve distinto** → es forma, y ahí mandamos nosotros, salvo que la diferencia diga algo
  clínico.

**Y la lección de la vez pasada, que es la que más rinde:** el cotejo también saca **lo que NO está**, no
solo lo que se ve distinto. Su bloque de medidas editables faltaba hacía meses y nadie lo había notado;
de los tres hallazgos de aquella tanda, el de forma fue el chico.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
