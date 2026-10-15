-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA CUENTA DE DISTRIBUCION QUE QUEDO PAGADA: SE ANOTA, NO SE RETIRA  ·  2026-10-15
--
-- ═══ EL CASO (Santiago, 2026-10-15) ═══
--
-- El script de arranque dejo UNA cuenta de distribucion viva, y es la PAGADA. Textual suyo: *"efectivamente
-- es de una venta de prueba; todo lo que se ha hecho hoy en cuanto a ventas, ya sea de modalidad de comision
-- o distribucion, ha sido de pruebas; no ha movido dinero real ni generado factura real."*
--
-- ═══ POR QUE NO SE RETIRA, Y NO ES UNA LIMITACION SINO LA REGLA ═══
--
-- anularCuentaDistribucion se niega con una cuenta pagada, y el trigger distribucion_statements_inmutable
-- (0215) lo impide por debajo en las DOS direcciones: no se puede poner superseded_at en una pagada, y no se
-- puede devolver paid_at a nulo. Su razon esta escrita ahi: *"un pago registrado contra un documento que
-- dice no existir es peor que una cuenta mal emitida."*
--
-- ESO SE QUEDA COMO ESTA. Abrirle una puerta para esta fila dejaria el mecanismo sin la unica garantia que
-- tiene: que un pago registrado no se reescribe. Una fila incomoda no vale ese cambio.
--
-- ═══ LO QUE SI SE PUEDE, Y ES LO QUE HACE ESTE SCRIPT ═══
--
-- Dejar ESCRITO que fue del periodo de pruebas. No niega el acto (la cuenta se emitio y el pago se registro,
-- y las dos cosas pasaron); dice de que etapa es. Con eso, en seis meses la pregunta "¿por que hay una cuenta
-- pagada antes del arranque?" se responde sola.
--
-- DOS SITIOS, porque hoy ninguno de los dos alcanza solo:
--   · paid_note, que es el campo de la propia fila. HOY NINGUNA PANTALLA LO MUESTRA: la anotacion vive en
--     los datos, que es donde se va a hacer la pregunta;
--   · y una fila en clinical_audit_log, que es el registro que SI se consulta y que es append-only.
--
-- ⚠ LAS VENTAS NO SE TOCAN. Ya quedaron marcadas como de prueba por el script de arranque, asi que no cuentan
--   en ninguna cifra. Esto es solo el documento.
--
-- ⚠ NO EN EL EDITOR SQL DE SUPABASE. Alla revento con "syntax error at or near aid_at" (2026-10-15): el
--   editor parte el texto y un comentario cortado a mitad de palabra se vuelve una sentencia. Ademas no
--   sostiene la transaccion, asi que el rollback del final no protegeria nada.
--
-- COMO SE CORRE (en PowerShell, con el DATABASE_URL de la nube exportado):
--   node scripts/aplicar-migracion.mjs scripts/ANOTAR_LA_CUENTA_PAGADA_DEL_PERIODO_DE_PRUEBAS.sql
--   ... y con --commit cuando el ensayo diga "SIN ERRORES" y el NOTICE muestre la cuenta correcta.
--
-- Y ES OPCIONAL: la cuenta ya no aparece en ninguna pantalla operativa y sus ventas ya estan marcadas. Esto
-- solo deja escrito de que etapa fue, para quien lo pregunte en seis meses.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) PARAMETROS ───────────────────────────────────────────────────────────────────────────────
create temporary table _anotacion(correo text, nota text) on commit drop;
insert into _anotacion values (
  'gilurgi69@gmail.com',
  'Cuenta del periodo de PRUEBAS, anterior al arranque del 2026-10-15. El pago se registro en Atlas durante las pruebas: no hubo dinero real ni factura real (la facturacion de esa etapa se hizo a mano en Alegra). No se retira porque una cuenta pagada no se retira (0215); queda anotada.'
);

do $$
declare v_id uuid;
begin
  select p.id into v_id from profiles p join _anotacion a on true where lower(p.email) = lower(a.correo);
  if v_id is null then
    raise exception 'No hay ningun perfil con ese correo. Revisa el parametro correo del bloque (0).';
  end if;
end $$;

-- ── (1) QUE CUENTAS ALCANZA: LAS PAGADAS DE ANTES DEL ARRANQUE ───────────────────────────────────
--
-- SE ELIGEN POR LA FECHA DEL CORTE Y NO POR UN ID PEGADO A MANO: un uuid copiado a mano es la clase de dato
-- que se pega mal una vez y nadie lo nota. La frontera es la misma que usa todo lo demas
-- (commercial_config.fecha_de_arranque), asi que si manana aparece otra del periodo de pruebas, este
-- script la cubre sin editarlo.
--
-- Y NO ALCANZA A NINGUNA POSTERIOR AL ARRANQUE: esas son reales y anotarlas seria mentir al reves.
create temporary table _cuentas on commit drop as
select s.id, s.professional_id, s.corte_desde, s.corte_hasta, s.paid_at, s.paid_amount
  from distribucion_statements s
 where s.paid_at is not null
   and s.superseded_at is null
   -- SI LA FECHA NO ESTA FIJADA, NO ALCANZA A NINGUNA. El fallback seguro es el VACIO y no el TODO:
   -- con infinity este script habria anotado como "de pruebas" cualquier cuenta pagada, incluidas las
   -- reales del futuro, y una anotacion falsa en un documento de cobro es peor que no tener anotacion.
   and s.corte_hasta < coalesce(
         (select c.fecha_de_arranque from commercial_config c limit 1),
         '-infinity'::date
       );

do $$
declare r record; n int;
begin
  select count(*) into n from _cuentas;
  raise notice '--- CUENTAS PAGADAS ANTERIORES AL ARRANQUE: % ---', n;
  if n = 0 then
    raise notice 'Ninguna. O ya se anotaron, o la fecha de arranque no esta fijada todavia (y entonces este script no puede saber cual es "antes").';
  end if;
  for r in select * from _cuentas loop
    raise notice 'cuenta % | corte % a % | pagada el % por %',
      r.id, r.corte_desde, r.corte_hasta, r.paid_at::date, r.paid_amount;
  end loop;
end $$;

-- ── (2) LA ANOTACION EN LA PROPIA FILA ───────────────────────────────────────────────────────────
--
-- Solo paid_note. El trigger de inmutabilidad deja pasar este UPDATE (no toca el corte, ni la emision, ni
-- paid_at, ni superseded_at), y eso es exactamente la frontera que queremos respetar.
--
-- SE CONCATENA EN VEZ DE PISAR: si alguien habia escrito una nota al registrar el pago, es un dato de esa
-- persona y no se borra.
update distribucion_statements s
   set paid_note = case
         when s.paid_note is null or btrim(s.paid_note) = '' then (select nota from _anotacion)
         else s.paid_note || ' // ' || (select nota from _anotacion)
       end
 where s.id in (select id from _cuentas)
   -- IDEMPOTENTE: correrlo dos veces no apila la misma frase dos veces.
   and coalesce(s.paid_note, '') not like '%periodo de PRUEBAS, anterior al arranque%';

-- ── (3) Y LA FILA DE AUDITORIA, QUE ES LA QUE SE CONSULTA ────────────────────────────────────────
insert into clinical_audit_log (actor_id, actor_email, event, entity_type, entity_id, payload)
select (select p.id from profiles p join _anotacion a on true where lower(p.email) = lower(a.correo)),
       (select correo from _anotacion),
       'distribucion.cuenta_anotada_como_del_periodo_de_pruebas',
       'distribucion_statements',
       c.id::text,
       jsonb_build_object(
         'corte_desde', c.corte_desde,
         'corte_hasta', c.corte_hasta,
         'pagada_el', c.paid_at,
         'monto_registrado', c.paid_amount,
         'nota', (select nota from _anotacion),
         'por_que_no_se_retira', 'Una cuenta pagada no se retira (trigger distribucion_statements_inmutable, 0215): un pago registrado contra un documento que dice no existir es peor que una cuenta mal emitida.'
       )
  from _cuentas c;

-- ── (4) LO QUE QUEDO ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '--- DESPUES ---';
  for r in select s.id, s.paid_note from distribucion_statements s where s.id in (select id from _cuentas) loop
    raise notice 'cuenta % | nota: %', r.id, r.paid_note;
  end loop;
end $$;

rollback;
-- commit;
