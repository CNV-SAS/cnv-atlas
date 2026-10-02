-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- DESCARTAR UN PENDIENTE QUE NO TIENE SALIDA
--
-- EL PROBLEMA (Santiago, 2026-10-02): dos de los seis pendientes que manda el correo de las 7 y las 5 NO SE
-- PUEDEN CERRAR. No existe un estado que los apague:
--
--   · SIN SALDO: la venta se cobro y el saldo no alcanzo. Se arregla CONTANDO la vitrina, fuera de Atlas. La
--     venta se queda con stock_state = 'sin_saldo' para siempre; ningun acto en la pantalla la cambia.
--   · PAGADA SIN DESPACHAR: el producto salia de la bodega. Si ya se entrego por fuera (se lo llevo en la
--     mano, lo mando el laboratorio directo), nadie va a marcar un despacho que no ocurrio en Atlas.
--
-- Y "EN GESTION HASTA" NO ALCANZA, porque solo POSPONE: llegada la fecha vuelve igual, y ademas su enum ni
-- siquiera incluye estos dos tipos. Un aviso que no se puede quitar se vuelve ruido, y el dia que haya uno de
-- verdad nadie lo va a ver. Es el mismo argumento que ya esta escrito en el tope de 30 dias del sin_saldo.
--
-- ── POR QUE CON MOTIVO Y RESPONSABLE, Y NO UN SIMPLE BOTON ──
--
-- Porque descartar APAGA UN CONTROL sobre dinero y sobre unidades fisicas. "Ya lo revise" sin firma es
-- indistinguible de "me cansaba verlo en el correo". El motivo y quien lo escribio son lo que hace la
-- diferencia auditable, y por eso el motivo es obligatorio en la base (CHECK), no solo en la pantalla.
--
-- ── POR QUE CADUCA, QUE ES LA PIEZA QUE LO HACE SEGURO ──
--
-- Un descarte es un juicio SOBRE UN HECHO TAL COMO ESTABA, no un permiso permanente sobre la fila. Si el hecho
-- cambia (se agrega una linea, cambia el importe, el descuento se reintenta y vuelve a fallar con otro error,
-- la venta cambia de ubicacion o entra en revision), el juicio ya no cubre lo que hay ahora, y esconderlo seria
-- exactamente el agujero: descartar una vez para que nunca mas se avise de esa venta.
--
-- Asi que el descarte guarda la HUELLA del hecho y solo aplica mientras la huella siga igual. Si cambia, el
-- pendiente vuelve, con la nota de que se habia descartado y de que el hecho cambio.
--
-- ── Y POR QUE LA HUELLA LA CALCULA UNA SOLA FUNCION ──
--
-- Es la leccion de los seis defectos de estas dos semanas: una regla escrita en dos sitios diverge. Si el
-- escritor armara la huella en TypeScript y el lector la armara en SQL, bastaria un espacio de diferencia para
-- que el descarte NO APLICARA NUNCA (el pendiente nunca se calla) o, peor, para que calculada distinto nunca
-- CADUCARA. Una funcion, llamada por los dos lados.
--
-- NO SE OCULTA: el panel sigue mostrando la venta descartada, con quien la descarto, cuando y por que, y con
-- un boton para reactivarla. Lo que se calla es el correo y la franja de aviso, que es donde estaba el ruido.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA HUELLA DEL HECHO ──────────────────────────────────────────────────────────────────────────
--
-- Que entra en la huella es la decision clave: TODO lo que, si cambia, invalida el juicio. Lo comun a los dos
-- tipos (estado, importe, anulacion, lineas) mas lo propio de cada uno.
--
-- Un tipo DESCONOCIDO revienta a proposito. Si manana hay un tercer pendiente sin salida y alguien lo agrega al
-- CHECK sin decidir su huella, es mejor un error ruidoso que una huella vacia: una huella vacia aplicaria
-- siempre y no caducaria nunca, que es el peor de los dos fallos posibles.
CREATE OR REPLACE FUNCTION public.huella_del_pendiente(p_kind text, p_tx uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lineas text;
  v_base   text;
  v_t      record;
BEGIN
  SELECT t.status, t.amount, t.stock_state, t.stock_last_error, t.fulfillment_state, t.location_id,
         t.cancelled_at, t.review_reason
    INTO v_t
    FROM transactions t
   WHERE t.id = p_tx;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Las lineas, ordenadas: el mismo contenido tiene que dar la misma huella sin importar el orden del insert.
  SELECT coalesce(
           string_agg(ti.nutraceutical_id::text || 'x' || ti.quantity, ',' ORDER BY ti.nutraceutical_id::text),
           'sin_lineas')
    INTO v_lineas
    FROM transaction_items ti
   WHERE ti.transaction_id = p_tx;

  -- `status` ES UN ENUM: `coalesce(status, '')` intenta meter la cadena vacia en el enum y revienta con
  -- "invalid input value for enum transaction_status". Va a texto ANTES del coalesce. Lo encontro el candado.
  v_base := coalesce(v_t.status::text, '') || '|' || coalesce(v_t.amount::text, '') || '|'
         || CASE WHEN v_t.cancelled_at IS NULL THEN 'vigente' ELSE 'anulada' END || '|' || v_lineas;

  IF p_kind = 'sin_saldo' THEN
    -- El error del descuento entra: un reintento que vuelve a fallar por OTRA razon es un hecho nuevo.
    RETURN 'sin_saldo|' || v_base || '|' || coalesce(v_t.stock_state, '') || '|'
        || coalesce(v_t.stock_last_error, '');
  ELSIF p_kind = 'por_despachar' THEN
    -- La ubicacion entra porque ES el hecho ("sale de una bodega que no es la del profesional"), y la revision
    -- porque un pago en revision no se despacha: descartarlo antes de resolverla no cubre lo de despues.
    RETURN 'por_despachar|' || v_base || '|' || coalesce(v_t.fulfillment_state, '') || '|'
        || coalesce(v_t.location_id::text, '') || '|'
        || CASE WHEN v_t.review_reason IS NULL THEN 'sin_revision' ELSE 'en_revision' END;
  END IF;

  RAISE EXCEPTION 'huella_del_pendiente: tipo de pendiente sin huella definida (%). Decide que la compone antes de permitir descartarlo.', p_kind;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.huella_del_pendiente(text, uuid) FROM anon;--> statement-breakpoint

-- ── 2. EL DESCARTE ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pending_discards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  -- El motivo, obligatorio y con cuerpo: "ok" no explica nada a quien audite esto en marzo.
  "reason" text NOT NULL,
  -- La huella del hecho al descartarlo. La escribe huella_del_pendiente, nunca la pantalla.
  "fact_fingerprint" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Reactivar NO borra: deja constancia de que se descarto y de que alguien lo deshizo.
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  CONSTRAINT "pending_discards_kind_valido" CHECK ("kind" IN ('sin_saldo', 'por_despachar')),
  CONSTRAINT "pending_discards_motivo" CHECK (length(trim("reason")) >= 10),
  -- Las dos de la reactivacion van juntas o ninguna (mismo patron que la verificacion de la transferencia).
  CONSTRAINT "pending_discards_revocacion_completa"
    CHECK (("revoked_at" IS NULL) = ("revoked_by" IS NULL))
);--> statement-breakpoint

-- UNO VIGENTE POR (tipo, venta). Los revocados se acumulan: son el historial.
CREATE UNIQUE INDEX IF NOT EXISTS "pending_discards_uno_vigente"
  ON "pending_discards" ("kind", "transaction_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint

ALTER TABLE "pending_discards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "pending_discards_select" ON "pending_discards";--> statement-breakpoint
-- Lectura para los roles internos, igual que el resto de los avisos. La escritura pasa por la conexion de
-- sistema desde la server action, que es donde esta la policy que exige ver el ingreso.
CREATE POLICY "pending_discards_select" ON "pending_discards"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));
