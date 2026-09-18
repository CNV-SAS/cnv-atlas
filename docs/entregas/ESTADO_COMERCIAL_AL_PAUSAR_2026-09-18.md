# Dónde queda lo comercial al pausarlo (2026-09-18)

Lo comercial se pausa aquí para pulir el flujo científico, que es lo que Gildardo necesita presentar. Este documento existe para **retomarlo sin reconstruirlo**: qué está cerrado, qué quedó a medias y qué espera a una persona.

**La regla que sigue viva:** los Integrantes no mueven inventario ni ventas hasta que todo esté listo. Orden pactado: cerrar los bloques → 2b (Alegra producción) → Supabase Pro y Vercel Pro → Integrantes.

## Lo cerrado, con su smoke pasado

| Bloque | Estado |
|---|---|
| 0 · Purga y corte | Hecho (2026-09-11) |
| 1 · Cimientos | Hecho. La carga inicial corrió en la nube: 1.810 unidades en 8 ubicaciones |
| 2a · Alegra en sandbox | Hecho (2026-09-13). Factura DIAN aprobada con sus líneas reales |
| 3 · La venta nace en Tratamiento | Hecho (2026-09-15), migraciones 0138-0144, smoke de cierre pasado |
| A · Avisos | Hecho y cerrado (2026-09-16), migración 0145, smoke pasado |
| 3b sesión 3 · Cotejo con Wompi | Hecha (2026-09-16), migración 0146, smoke pasado |
| 3b sesión 1 · Contracargos y anulaciones | Hecha (2026-09-17), migración 0147, smoke pasado salvo el detalle de abajo |

**Migraciones aplicadas en la nube: 148.**

## Lo que quedó a medias

1. **3b sesión 1, último repaso del smoke.** Las dos reversas del smoke quedaron **abiertas** en la nube (`anulacion_wompi`, del 17 y del 18). Falta volver a pulsar **Buscar pagos sin registrar** después del último push para ver el texto corregido, y la limpieza del producto de prueba. No bloquea nada.
2. **3b sesión 2 · La devolución física: NO construida.** Es lo único del 3b que falta. Sus decisiones ya están tomadas por contabilidad (ver `PLAN_BLOQUES_INVENTARIO_VENTAS.md`, D-3b-3): ubicación de **"devueltas pendientes de verificación"**, que no es vendible, y la reincorporación al lote como **decisión humana registrada**, nunca automática. Y el tipo de movimiento `devolucion` que ya existe **no sirve**: significa "el Integrante devuelve a CNV", así que la devolución de una venta lleva su propio tipo.
3. **2b · Alegra a producción: preparado y esperando.** Guía en `docs/entregas/GUIA_2B_PASO_A_PRODUCCION.md`.

## Lo que espera a una persona, no a código

- **Cláusula del Anexo 2:** que CNV pueda descontar de liquidaciones futuras y que, sin ellas, el Integrante reintegre. Sin eso, la reversión de una comisión ya liquidada no es exigible.
- **Buzón de disputas de Wompi** apuntando a facturación. **Urgente:** una disputa sin respuesta a tiempo **se pierde por silencio**.
- **Acuerdo de LUVIA:** el contracargo sobre producto de tercero deja a CNV devolviendo el total habiendo pagado ya al proveedor.
- **La retención de Wompi en un contracargo:** verificar si se ajusta en el desembolso o queda a favor de CNV.
- **Supabase Pro y Vercel Pro**, antes del primer Integrante (ver `LANZAMIENTO.md`). Vercel Pro es necesario por licencia: Hobby prohíbe el uso comercial.

## Dos cosas que van a seguir pasando mientras esté pausado

- **El correo de las 7 a. m. llega todos los días** con la venta del **12/9** como vencida (paciente real que no se factura contra sandbox). Se va con la purga de ventas de prueba, que se hace después de la venta controlada del 2b.
- **El cotejo con Wompi corre cada mañana** y verá las dos reversas abiertas. Ya no alerta por ellas (solo la primera vez), así que no genera ruido.

## Lo aprendido que conviene no volver a descubrir

- **Wompi NO avisa al anular una transacción.** El único camino es el cotejo. Verificado el 2026-09-17.
- **Su listado de transacciones no está documentado**; lo que sabemos salió de `scripts/sondeo-wompi-consulta.mjs` y está escrito en la cabecera de `src/lib/wompi/client.ts`.
- **`DATABASE_URL` en Vercel va por el Transaction pooler (6543)**, nunca por el de sesión: con el de sesión se agotan los 15 cupos y /pagos deja de cargar. Incidente del 2026-09-15, escrito en `DEPLOY.md`.
- **El campo `disbursement` de Wompi viene vacío en sandbox.** Queda por verificar en producción; el cálculo del margen no se diseña contando con él.
- **Un lector que pide "todo" sin acotar devuelve como mucho 1.000 filas y no avisa de lo que corta** (PostgREST). Hoy no se alcanza en producción, pero es la causa de dos fallas que parecían defectos del código.

## Por dónde se retoma

Por la **sesión 2 del 3b**, con sus decisiones ya tomadas. Después, el **2b**. El plan vive en `docs/PLAN_BLOQUES_INVENTARIO_VENTAS.md`, que está al día.
