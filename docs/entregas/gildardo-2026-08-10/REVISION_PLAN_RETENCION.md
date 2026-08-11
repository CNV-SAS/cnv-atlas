# Revisión contable del PLAN_RETENCION.md — Decisiones y correcciones

**Estado:** Decisiones cerradas. Listo para construir.
**Documento origen:** PLAN_RETENCION.md
**Fecha:** 2026-08-12

---

## Veredicto general

El plan está bien armado y el diagnóstico es correcto: pedir el RUT en lugar de que el integrante adivine sus condiciones tributarias es la decisión acertada, y el riesgo identificado es real (si el integrante contesta mal, ante la DIAN responde CNV).

Se aprueba con **tres correcciones**, una de ellas de fondo (la decisión A/A2/B).

---

## 1. Decisión A/A2/B → **A2**, no A

**Decisión tomada: opción A2.** Una persona designada verifica el RUT y llena los campos certificados **en el momento en que el integrante lo sube**, no al liquidar.

### Por qué no A

La opción A (derivar los campos al liquidar) tiene un problema de **tiempo y escala** que no estaba contemplado:

- Liquidar es un proceso **mensual y contra reloj**: se cierra el corte, se calculan comisiones, se paga.
- Si en ese momento hay que abrir 10, 30 o 100 PDFs de RUT para clasificar a cada integrante, la liquidación se convierte en un cuello de botella **que se repite todos los meses**.
- Con integrantes nuevos entrando continuamente, siempre habrá RUTs sin leer justo cuando corre el reloj.

### Por qué A2

- Mueve el trabajo al momento en que **alguien sube el RUT**, que es un evento disperso en el tiempo y **sin presión de calendario**.
- Se lee **una sola vez** y queda clasificado de forma permanente.
- La liquidación solo **consulta datos ya listos**.
- El trabajo total es el mismo; la diferencia es que A lo concentra en el peor momento y A2 lo distribuye.

**Ventaja adicional de negocio:** permite decirle al integrante *"tus datos están verificados, tu comisión sale en la próxima liquidación"*, en vez de dejarlo en incertidumbre hasta el día del pago.

**Sobre la objeción de "más trabajo por adelantado":** con 10 integrantes, leer un RUT toma dos minutos. No es carga real todavía, y cuando lo sea, el proceso ya estará rodado.

### Sobre la opción B

Bien descartada. El OCR de un PDF de la DIAN es frágil y además vuelve a apoyarse en la confirmación del integrante, que es justo lo que se quería evitar.

---

## 2. Falta: trazabilidad y vigencia del RUT

El plan cubre subir el RUT y derivar los campos, pero **no registra quién lo revisó, cuándo, ni con qué versión del documento**. Esto importa porque **el RUT cambia**: un integrante puede volverse responsable de IVA en marzo y la clasificación queda desactualizada.

### Campos a agregar en `professional_profiles`

| Campo | Descripción |
|---|---|
| `rut_verificado_por` | Quién de CNV leyó y clasificó el RUT |
| `rut_verificado_en` | Fecha de la verificación |
| `rut_fecha_documento` | Fecha de generación que trae el propio RUT |

### Regla de vigencia

**Si el RUT tiene más de un año, solicitar uno actualizado.** Es práctica estándar en áreas de compras y protege a CNV si la DIAN pregunta por qué se retuvo al 10% a alguien que era declarante.

---

## 3. Dependencia crítica no señalada: el documento soporte

El plan marca "natural sin RUT → documento soporte, dictamen" como pendiente, pero **subestima el bloqueo**.

La secuencia real es:

1. Integrante sin RUT → no puede facturarle a CNV
2. CNV debe emitirle **documento soporte electrónico**
3. **Pero el DS todavía no está habilitado en Alegra**

Resultado: esos integrantes quedarían sin poder cobrar aunque hayan completado todo lo demás. **El bloqueo no sería de datos, sería de CNV.**

> **Acción:** habilitar el documento soporte electrónico en Alegra **antes de la primera liquidación de comisiones**. No es tarea paralela, es dependencia.

---

## 4. Matiz sobre "natural con RUT"

El plan lo trata como si fuera opcional. En la práctica, **una persona natural que presta servicios profesionales y recibe comisiones de forma habitual normalmente ya tiene RUT**, aunque no sea responsable de IVA. Que no lo tenga es la excepción, no la regla, en profesionales de salud con consulta privada.

**Recomendación:** no hacerlo obligatorio (se perderían integrantes legítimos), pero incluir un texto que empuje:

> "Si prestas servicios profesionales, probablemente ya tienes RUT. Puedes descargarlo del portal de la DIAN."

Muchos lo tienen y no saben dónde está. Ese empujón evita clasificarlos innecesariamente en la ruta de documento soporte.

---

## 5. Cuenta bancaria: reglas confirmadas y ampliadas

**Confirmado:** el titular debe ser el mismo integrante, sin excepciones.

**Se agregan dos reglas:**

1. **Validar el documento del titular**, no solo que el nombre se parezca. El número de documento del titular de la cuenta debe coincidir con el del integrante.
2. **Si el integrante es persona jurídica**, la cuenta debe estar a nombre de esa jurídica (NIT), **no del representante legal**.

> Esta segunda regla viene de dos incidentes reales de CNV (Aminogram y Biozen/Pharmazen): **quien recibe el dinero debe ser quien emite el soporte.** Cuando no coincide, se requiere documentación adicional para sostener la operación ante la DIAN.

---

## 6. Corrección sobre el bloqueo del desarrollo

El plan dice "NO construir hasta luz verde del contable". **Eso no es necesario.**

De los cuatro puntos que el plan deja para la contadora:

| Punto | ¿Es de la contadora? |
|---|---|
| Quién deriva los campos del RUT (A/A2/B) | **No.** Decisión de proceso interno. Ya está cerrada: A2. |
| Campos de cuenta bancaria y regla de titular | **No.** Decisión de proceso interno. Ya está cerrada. |
| Lógica del RUT requerido | **No.** Decisión de proceso interno. Ya está cerrada. |
| **Tarifa de retención (10%, 11% o tabla 383)** | **Sí.** Único punto que requiere su concepto. |

La tarifa se necesita para **calcular** la primera retención, que es un momento **posterior** a la construcción del formulario.

> **Conclusión: se puede construir ya.** No bloquear el desarrollo esperando a la contadora.

---

## Resumen de cambios al plan

| Punto | Cambio |
|---|---|
| Decisión A/A2/B | **A2**, no A. Verificar al subir el RUT, no al liquidar. |
| Trazabilidad | Agregar `rut_verificado_por`, `rut_verificado_en`, `rut_fecha_documento` + vigencia de 1 año |
| Dependencia | Habilitar documento soporte en Alegra **antes** de la primera liquidación |
| RUT en persona natural | Texto que empuje a buscarlo; la mayoría ya lo tiene |
| Cuenta bancaria | Validar documento del titular. Persona jurídica → cuenta de la jurídica |
| Bloqueo | Construir ya. Solo la tarifa es de la contadora y llega después |

Lo demás del plan (prioridades ALTA/MEDIA/BAJA, validaciones cruzadas, DV, sin defaults, fecha límite, copia) se aprueba tal como está.
