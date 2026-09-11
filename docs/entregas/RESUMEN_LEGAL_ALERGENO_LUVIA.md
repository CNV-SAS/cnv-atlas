# El alérgeno de LUVIA: consulta al asesor legal y su respuesta

**Consulta:** equipo Atlas, vía Santiago Uribe · **Respuesta:** asesor legal de CNV
**Fecha:** 11 de septiembre de 2026 · **Estado: CERRADA.** Lo decidido está implementado.

**Este archivo existe porque su ausencia costó una acusación falsa.** La respuesta anterior del asesor
sobre este mismo tema llegó, se destiló directamente en la §7.7 del modelo comercial y **nunca se archivó
como documento**. Dos semanas después, al buscarla, no se encontró y se concluyó que no existía. La regla
que sale de ahí vive en `DECISIONES_LEGALES.md`: **toda respuesta del asesor se archiva antes de
destilarla en ningún otro lado.**

---

## Lo que se consultó

Atlas tenía delante dos instrucciones que se contradecían sobre un mismo control.

**La §7.7 del modelo comercial**, redactada sobre un dictamen suyo anterior, exigía que Atlas **bloqueara
activamente** la recomendación de un producto con alérgenos a un paciente con intolerancia declarada, con
confirmación afirmativa del profesional y registro de quién la dio. El principio: *"ante un reclamo, un
sistema que tenía el dato y no lo usó es mucho más difícil de defender que uno que nunca lo tuvo."*

**Dirección Científica instruyó lo contrario**, dos veces (27 de agosto y 11 de septiembre): sin bloqueo,
sin confirmación y sin registro, porque traducir un ingrediente a una alergia es contenido clínico que su
modelo no tiene, y porque *"un bloqueo que parece proteger y no protege no le quita la responsabilidad a
CNV: la esconde detrás de una pantalla que el profesional aprende a creerle."*

El hecho concreto: **LUVIA** es producto de tercero en consignación, su ficha declara **avena**, hay
**84 unidades** ya repartidas entre siete Integrantes, y Atlas captura las alergias e intolerancias que el
paciente declara en la P43 y la P44. **El sistema tiene los dos datos.**

---

## La respuesta: el principio confundía dos cosas

El asesor **rectificó su propia recomendación**, y el argumento es el que decide:

> El principio colapsaba dos cosas distintas: **USAR el dato** y **BLOQUEAR con el dato.**

Bloquear obliga a Atlas a afirmar que la alergia del paciente y el alérgeno del producto son
incompatibles. **Eso es una inferencia clínica.** Y un sistema que infiere clínicamente **contradice el
Anexo 3 y el consentimiento que los pacientes ya firmaron**, donde Atlas declara que no diagnostica y que
el profesional interpreta.

**Construir el bloqueo no cerraría un flanco: abriría uno nuevo contra documentos ya firmados.**

La yuxtaposición usa el dato sin inferir con él, que es lo que el principio original pedía de verdad.

### El texto que reemplaza a la §7.7, literal

> **Alérgenos.** Cuando un producto declare alérgenos y el paciente haya declarado alergias o
> intolerancias, Atlas presenta ambas declaraciones juntas en el momento de la recomendación, sin
> clasificarlas ni inferir equivalencias entre ellas. La valoración de compatibilidad corresponde al
> profesional tratante. Atlas no bloquea ni condiciona la recomendación.

### Y una precisión suya que es la parte fina

**Se muestra la lista COMPLETA de lo que el producto declara**, no solo lo que coincide con lo del
paciente: así el profesional ve ingredientes que un filtro nunca le habría mostrado.

---

## Las dos autoridades coinciden, por caminos distintos

Eso es lo que hace sólida la conclusión, y conviene dejarlo escrito porque no era el desenlace esperado.

| | Por qué no se bloquea |
| --- | --- |
| **Asesor legal** | Bloquear exige inferir clínicamente, y eso contradice el consentimiento firmado |
| **Dirección Científica** | Traducir un ingrediente a una alergia es contenido clínico que el modelo no tiene, y un cruce parcial esconde la responsabilidad |

Y las dos coinciden también en lo que **sí** debe pasar: que el profesional vea lo que el paciente declaró
y decida él.

---

## Lo que quedó implementado

| | |
| --- | --- |
| Alergias e intolerancias del paciente | Se muestran textuales, como las declaró |
| Lo que el producto declara | Se muestra **completo**, no solo lo que coincide |
| Las dos, juntas | En el momento de la recomendación |
| Clasificación, equivalencias, inferencia | **Ninguna** |
| Bloqueo, confirmación, registro de override | **Ninguno** |
| Titular de marca del producto de tercero | En ficha, reporte y factura (§7.7, nunca estuvo en disputa) |

**Una condición de diseño que no está en el texto y sin la cual se rompe:** el bloque aparece cuando el
paciente declaró algo **y** el producto declara algo, **no cuando coinciden**. Si apareciera solo al
coincidir, su sola presencia sería una clasificación, y el cruce volvería por la puerta de atrás: el
profesional aprendería que "si sale el aviso, hay problema", que es exactamente la pantalla que el
profesional aprende a creerle.

---

## Lo que sigue abierto, y no es del asesor

Son de CNV, y con LUVIA ya vendiéndose:

1. **Aviso por escrito a los siete Integrantes** de que LUVIA contiene avena. Cierra la ventana de las 84
   unidades ya repartidas sin depender de nada más.
2. **Registro sanitario de LUVIA y su titularidad**, sin verificar.
3. **Acuerdo escrito con el proveedor**, inexistente (§7.8).

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
