-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CADA INTEGRANTE NACE CON SU VITRINA
--
-- EL BLOQUEO (Santiago, 2026-10-02): creo un profesional desde /admin y al mandarle remesa salio "Ese
-- Integrante no tiene ubicacion de inventario". No hay ninguna pantalla donde crearsela.
--
-- POR QUE PASO, y es lo que lo hace importante: las ubicaciones de los siete que SI la tienen se crearon en
-- un BACKFILL de la migracion 0120, para los profesionales que existian ese dia. Nada la crea para uno
-- posterior. ASI QUE ESTE CAMINO NUNCA SE HABIA EJERCITADO: el primer integrante nuevo iba a chocar con esto,
-- en el smoke o con CNV en produccion, y el sintoma no habria dicho que falta un paso de setup.
--
-- ── POR QUE UN TRIGGER Y NO UNA LINEA EN LA ACCION DE ADMIN ──
--
-- Porque un integrante SIN VITRINA NO PUEDE RECIBIR NADA: no es una opcion que alguien deba poder elegir ni
-- olvidar. Un profesional entra al sistema por un solo sitio (un insert en `professional_profiles`), y el
-- trigger cubre TODOS los caminos: la pantalla de admin, un SQL de operacion, el seed, y el import que se
-- escriba el año que viene. Arreglarlo solo en la accion de admin dejaria el hueco abierto en los demas, que
-- es exactamente la forma de los seis defectos de estas dos semanas.
--
-- ── EL NOMBRE ──
--
-- Se copia del perfil, igual que hizo el backfill de la 0120, y NO se sincroniza despues: las que existen
-- tampoco lo hacen, y una vitrina es un sitio fisico, no una etiqueta que persiga al nombre. Si un dia hay
-- que renombrarla, es una decision aparte.
--
-- El indice unico `loc_una_por_integrante` (0120) impide la segunda, asi que esto es idempotente por
-- construccion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_vitrina_del_integrante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO inventory_locations ("name", "kind", "professional_id")
  SELECT COALESCE(pr.full_name, 'Integrante'), 'integrante', NEW.id
    FROM profiles pr
   WHERE pr.id = NEW.profile_id
     AND NOT EXISTS (SELECT 1 FROM inventory_locations l WHERE l.professional_id = NEW.id);
  RETURN NULL;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.trg_vitrina_del_integrante() FROM anon, authenticated;--> statement-breakpoint

DROP TRIGGER IF EXISTS "integrante_nace_con_vitrina" ON "professional_profiles";--> statement-breakpoint
CREATE TRIGGER "integrante_nace_con_vitrina"
  AFTER INSERT ON "professional_profiles"
  FOR EACH ROW EXECUTE FUNCTION public.trg_vitrina_del_integrante();--> statement-breakpoint

-- ── Y EL BACKFILL, que es el que desbloquea al que Santiago acaba de crear ──
--
-- Mismo SELECT que la 0120. Si alguien creo profesionales entre esa migracion y esta, los cubre todos.
INSERT INTO "inventory_locations" ("name", "kind", "professional_id")
SELECT COALESCE(pr."full_name", 'Integrante'), 'integrante', pp."id"
  FROM "professional_profiles" pp
  LEFT JOIN "profiles" pr ON pr."id" = pp."profile_id"
 WHERE NOT EXISTS (SELECT 1 FROM "inventory_locations" l WHERE l."professional_id" = pp."id");
