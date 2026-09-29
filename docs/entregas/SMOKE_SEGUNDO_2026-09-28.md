# Segundo smoke · lo construido el 26 y el 28

**Para Santiago, 2026-09-28.** **Este NO reemplaza al `SMOKE_UNICO_2026-09-26.md`**: son dos recorridos
distintos y conviene no mezclarlos. El único cubre lo comercial acumulado, la depuración y el perfil; este
cubre **lo que se construyó después de que empezaras a correrlo**.

**Antes de empezar:** migraciones **185 en el repo**. La 0184 está pendiente en la nube.

**Cinco partes. Las dos primeras son de la pantalla de Tratamiento y se prueban juntas.**

---

## Parte 1 · La ficha de LUVIA, tal cual su archivo

1. En una evaluación con diagnóstico, ve a **Tratamiento → sección 2 → "¿Quieres prescribir un producto
   diferente para el tratamiento del paciente?"**.
2. **Compara línea por línea con su HTML.** Tiene que decir:
   - `1 scoop (15 g) en un vaso con agua · Polvo · 600 g` (antes decía "15 g · polvo")
   - la descripción con **los ingredientes**: *"...a base de arroz con avena, linaza, psyllium y probióticos"*
   - **⚠ Alérgenos: Contiene avena** (antes: "avena", sin el "Contiene", y sin símbolo)
   - `INVIMA RSA-0019736-2022 · Laboratorio Naturex S.A.S. · Titular de marca: Centro de Nutrición Integral
     Katherine Ruiz S.A.S.`
3. **Lo único que su ficha NO tiene es el titular de marca**, y va a propósito: §7.7 obliga a mostrarlo (quien
   pone su marca se presume productor). **No reemplaza a Naturex, se suma.** Son dos hechos distintos y el
   modelo comercial pide expresamente no confundirlos.
4. **El diseño:** la línea de posología va en acento, el alérgeno en ámbar, y el registro pequeño y apagado.
   Si se ve plano otra vez, avísame.

## Parte 2 · Sin dosis ni días, y sin el botón clínico

1. En **sección 2**, agrega un nutracéutico recomendado. **Qué NO tiene que haber:** los campos "Dosis" y
   "Días", ni el botón "No lo recomiendo por razón clínica".
2. **Qué tiene que verse en su lugar:** debajo del nombre, **su posología del catálogo**, por ejemplo
   `30 mL/día · 1 vez al día · línea líquida`. Es la de la tabla de Gildardo, igual para todos los pacientes.
3. Guarda, y **abre el informe del paciente**. Tiene que decir la posología, **no** "LUVIA: 1 durante 1 días".
4. **El control de una consulta VIEJA:** si tienes una prescripción anterior donde alguien tecleó algo, el
   informe de ESA consulta sigue diciendo lo que se tecleó. No se reescribe el pasado.

## Parte 3 · El desplegable y el bloque del paciente

1. **Sección 2 → "¿Quieres prescribir un nutracéutico que el modelo no recomendó?"**: el desplegable **no debe
   traer** los que ya están arriba en "El modelo recomienda", ni LUVIA (que vive en su propio bloque).
2. **Sección 1 → "Rutas de atención"**: en pantalla **ya NO debe salir** el bloque "Tus suplementos" con texto
   dirigido al paciente ("salen de tu propia medición").
3. **Pero sí debe salir al imprimir.** Pulsa el botón de imprimir de esa hoja y compruébalo en la vista previa:
   ahí el bloque tiene que estar. Esa parte de la decisión del 19 no cambió; lo que cambió es a quién se le
   muestra en pantalla.

## Parte 4 · Vender desde la bodega

1. Con un nutracéutico prescrito **del que no tengas unidades** y que sí haya en bodega, en el bloque de venta
   aparece **"Cobrar y pedir que CNV lo despache desde la bodega"**.
2. **Antes de cobrar** tiene que decir que el paciente **no se lleva el producto hoy** y que el aviso le llega a
   un administrador.
3. Cóbralo. La venta dice **"Sale de la bodega de CNV: falta despacharla"**.
4. **EL CONTROL QUE IMPORTA.** Como **admin**, mira el correo de pendientes de ventas: tiene que aparecer
   **"Ventas pagadas cuyo producto sale de la bodega y falta despachar"**. Si no está, el resto no sirve.
5. Registra la entrega: el aviso **desaparece**.
6. **Y que no haga ruido:** una venta de tu propia vitrina, pagada y sin entregar, **no** aparece en ese aviso.

## Parte 5 · El aviso de arriba y el arranque

1. Con `ATLAS_FASE=lanzamiento` en Vercel, el aviso de arriba dice **"Operación real: lo que registres aquí
   cuenta..."**, y **ya no** "Entorno de pruebas. Nada de lo que registres aquí es real".
2. **El control que importa de ese texto:** dice que **actualices antes de repetir**, porque repetir un cobro
   puede duplicarlo. Es la frase que evita el daño, no el "puede haber errores".
3. **Sin la variable no sale ningún aviso**, y eso es correcto: es mejor callar que decirle "esto no es real" a
   alguien que está atendiendo.

---

## Qué reportar

Lo mismo que en el otro: lo que viste y **lo que no viste**. Y si algo se ve distinto de lo escrito aquí,
mándame la pantalla: el texto de esta guía es la afirmación que se está probando.
