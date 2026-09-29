-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL INTEGRANTE COMO AGENTE RETENEDOR  ·  2026-09-29
--
-- LO PIDE EL MODELO, textual (§4.1): "Atlas debe registrar que Integrantes son agentes retenedores para
-- anticipar el neto esperado por factura y alimentar la proyeccion de caja".
--
-- POR QUE ES UN CAMPO NUEVO Y NO SE DEDUCE DE LOS QUE HAY: los tributarios que ya existen dicen si DECLARA
-- RENTA, si es RESPONSABLE DE IVA y si esta OBLIGADO A FACTURAR. Ser agente de RETENCION es otra casilla del
-- RUT (el codigo 07) y no se sigue de ninguna de las tres. Deducirlo de "responsable de IVA" le practicaria
-- retenciones a CNV que nadie practico, o al reves, y las dos descuadran la proyeccion de caja.
--
-- VA EN EL GRUPO CERTIFICADO, no en lo que el Integrante declara: como `tax_is_vat_responsible`, lo llena
-- quien VERIFICA el RUT en CNV. El Integrante no sabe fiablemente si tiene el codigo 07.
--
-- NULO = sin verificar, y entonces NO se anticipa retencion. Asumir que si retiene mostraria un neto
-- esperado menor que el real; asumir que no, uno mayor. Se elige el que no promete plata que no va a llegar:
-- sin dato, se calcula sin retencion y la cifra se rotula como lo que es, una proyeccion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "tax_is_withholding_agent" boolean;--> statement-breakpoint

COMMENT ON COLUMN "professional_profiles"."tax_is_withholding_agent" IS
  'Agente de retencion (codigo 07 del RUT). Lo certifica quien verifica el RUT, no lo declara el Integrante. Bajo Distribucion practica retefuente por compra de bienes del 2,5% a CNV sobre facturas que superen 27 UVT (modelo §4.1).';
