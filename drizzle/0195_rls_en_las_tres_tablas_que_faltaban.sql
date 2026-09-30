-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RLS EN LAS TRES TABLAS QUE NACIERON SIN ELLA  ·  2026-09-29  ·  CRITICO, EN PRODUCCION
--
-- Supabase lo reporto sobre el proyecto REAL: "Anyone with your project URL can read, edit, and delete all
-- data in this table". Las tres:
--
--   · commission_settlements  -> lo que se le paga a cada Integrante, con su base, su retencion y su neto
--   · professional_modalities -> bajo que regimen opera cada uno
--   · professional_attachments -> sus documentos, INCLUIDO EL RUT (nombre, NIT, direccion)
--
-- ── POR QUE NACIERON ASI, Y POR QUE VAN A VOLVER A NACER ASI SI NO SE BARRE ──
--
-- Drizzle CREA la tabla y NO enciende RLS: hay que escribirlo a mano en cada migracion. Y eso ya estaba
-- aprendido, escrito en el candado de `patient_contraindications` ("Drizzle crea la tabla pero NO enciende
-- RLS"). Lo que faltaba es que ese candado es POR TABLA: comprueba dos tablas, una por una, y no alcanza a la
-- tercera ni a la decima.
--
-- Es exactamente la misma forma que el `z.uuid()` de esta mañana: una regla escrita seis veces que no llego al
-- septimo archivo. Por eso junto a esta migracion va un candado que BARRE TODA la base: cada tabla de `public`
-- con RLS encendida y con al menos una politica, con lista explicita de excepciones deliberadas.
--
-- ── EL ALCANCE DE CADA POLITICA ──
--
-- LAS TRES SE LEEN IGUAL: CNV entera (admin, direccion, soporte) y el Integrante LO SUYO. Y las tres se
-- ESCRIBEN SOLO POR LA APLICACION: el escritor entra como dueño de la tabla y no pasa por RLS, asi que NO se
-- crea ninguna politica de escritura. Sin politica de escritura, PostgREST no deja escribir a nadie, que es
-- justo lo que se quiere: una liquidacion no se edita desde el navegador.
--
-- Y EL INTEGRANTE VE LO SUYO PORQUE LO NECESITA: su liquidacion es su cuenta de cobro, su modalidad gobierna
-- como le pagan, y sus adjuntos son documentos que el subio. Ocultarselos no protege nada.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LAS LIQUIDACIONES ───
ALTER TABLE "commission_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "commission_settlements_select" ON "commission_settlements";--> statement-breakpoint
CREATE POLICY "commission_settlements_select" ON "commission_settlements"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte')
    OR public.is_own_professional_profile("professional_id")
  );--> statement-breakpoint

-- ─── 2. LA MODALIDAD ───
ALTER TABLE "professional_modalities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "professional_modalities_select" ON "professional_modalities";--> statement-breakpoint
CREATE POLICY "professional_modalities_select" ON "professional_modalities"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte')
    OR public.is_own_professional_profile("professional_id")
  );--> statement-breakpoint

-- ─── 3. LOS ADJUNTOS, QUE INCLUYEN EL RUT ───
--
-- LA FILA NO ES EL DOCUMENTO: lo que guarda es la RUTA en un bucket privado. Aun asi es lo mas sensible de
-- las tres, porque la ruta mas el `original_name` ya dicen que documentos tiene una persona, y el bucket se
-- abre con una URL firmada que sale de aqui.
ALTER TABLE "professional_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "professional_attachments_select" ON "professional_attachments";--> statement-breakpoint
CREATE POLICY "professional_attachments_select" ON "professional_attachments"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte')
    OR public.is_own_professional_profile("professional_id")
  );
