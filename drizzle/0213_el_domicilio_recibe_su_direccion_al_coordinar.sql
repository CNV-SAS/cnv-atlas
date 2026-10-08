-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL DOMICILIO NACE SIN DIRECCION Y NO SE ENTREGA SIN ELLA  ·  decision de legal, 2026-10-08
--
-- ═══ DE DONDE SALE ═══
--
-- En el punto 10 del primer smoke, una venta desde la bodega quedo con `delivery_mode = 'en_consulta'`: lo
-- contrario del hecho, porque la propia pantalla le dice al profesional que el paciente NO se lleva el producto
-- hoy. Y la columna no es cosmetica: de ella cuelgan quien ve la venta en "Envios por coordinar" y si se le
-- calcula el retracto. Asi que esa venta no la veia quien tenia que enviarla, no tenia retracto, y aun asi se
-- pudo marcar ENTREGADA sin que existiera una direccion en ninguna parte.
--
-- ═══ LAS DOS DECISIONES DE LEGAL QUE ESTA MIGRACION HABILITA ═══
--
-- 1. EL RETRACTO APLICA A TODA VENTA QUE NO SE ENTREGA EN EL MOMENTO, incluida la de bodega. Textual: "en
--    terreno discutible el Estatuto del Consumidor se interpreta a favor del consumidor. Conceder el retracto
--    en un caso donde quizas no era obligatorio cuesta poco, negarlo donde si lo era cuesta mucho".
--
-- 2. LA DIRECCION LA CAPTURA QUIEN COORDINA EL ENVIO, no el profesional en consulta. Su argumento: con la
--    decision del flete, CNV tiene que llamar al paciente de todos modos para confirmarle el valor del envio,
--    asi que pedirle la direccion en esa llamada no agrega friccion.
--
-- ═══ POR QUE EL CHECK TENIA QUE MOVERSE, Y NO SOLO AFLOJARSE ═══
--
-- `transactions_domicilio_completo` (0190) exigia direccion y ciudad en TODA venta a domicilio, desde que nace.
-- Con la decision 2 eso es imposible de cumplir: la venta nace antes de que nadie pida la direccion.
--
-- PERO EL INVARIANTE NO DESAPARECE, SE MUDA AL MOMENTO EN QUE ES VERDAD: una venta a domicilio no se puede
-- ENTREGAR sin direccion. Eso es lo que legal llamo lo mas grave del hallazgo ("el sistema permitio cerrar el
-- ciclo de una entrega que nadie sabia a donde iba") y pidio como validacion DURA, no como aviso.
--
-- DOS CAPAS, igual que en el retiro de una consulta: el servicio lo rechaza con una frase que dice QUE HACER
-- (`sin_direccion` en `registrarEntrega`), y este CHECK lo impide aunque alguien llegue por SQL. La frase es
-- para la persona. El CHECK es para que no exista el camino.
--
-- NO ROMPE NINGUNA FILA EXISTENTE: las ventas a domicilio que ya estan entregadas traen direccion y ciudad,
-- porque hasta hoy el CHECK viejo las obligaba a tenerlas desde que nacian.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_domicilio_completo";--> statement-breakpoint

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_domicilio_entregado_con_direccion" CHECK (
    "delivery_mode" IS DISTINCT FROM 'domicilio'
    OR "fulfillment_state" IS DISTINCT FROM 'entregado'
    OR ("shipping_address" IS NOT NULL AND "shipping_city" IS NOT NULL)
  );--> statement-breakpoint

COMMENT ON CONSTRAINT "transactions_domicilio_entregado_con_direccion" ON "transactions" IS
  'Una venta a domicilio puede NACER sin direccion (la pide quien coordina el envio, decision de legal del 2026-10-08), pero no se puede marcar ENTREGADA sin ella: cerrar el ciclo de una entrega sin saber a donde fue el producto es el camino que este CHECK cierra. El servicio lo rechaza antes con un mensaje que dice que hacer; esto lo impide tambien por SQL.';
