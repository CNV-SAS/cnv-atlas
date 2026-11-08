-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RLS EN LAS DOS TABLAS DEL INSTRUMENTO  ·  2026-11-07
--
-- LO ENCONTRO EL CANDADO `rls-en-todas-las-tablas`, que es exactamente para lo que existe: una tabla
-- nueva nace SIN RLS, y en Supabase eso significa que cualquiera con la URL del proyecto y la clave
-- anonima la lee y la escribe. No es teorico: la clave anonima viaja en el cliente.
--
-- LAS MISMAS POLITICAS QUE `survey_versions` Y `survey_questions` (0003), porque es el mismo contenido:
-- el cuestionario no es dato de paciente (no hay nada que proteger en el enunciado de una pregunta), asi
-- que cualquiera con sesion lo LEE; escribirlo es cambiar el instrumento clinico, y eso es de `admin`.
--
-- Y QUIEN SIRVE LA ENCUESTA PUBLICA NO PASA POR AQUI: el intake lee con service_role, porque el paciente
-- no tiene sesion. Es el mismo camino que ya usaba `survey_questions`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.survey_instruments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.survey_instrument_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "survey_instruments_select" ON public.survey_instruments
  FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "survey_instruments_write" ON public.survey_instruments
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint

CREATE POLICY "survey_instrument_items_select" ON public.survey_instrument_items
  FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "survey_instrument_items_write" ON public.survey_instrument_items
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
