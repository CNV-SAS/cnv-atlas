-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- DOS VERIFICACIONES DEL 2026-10-03
--
-- SOLO LECTURA.
--   (1) ¿Los lotes del laboratorio tienen su fecha REAL, o una inventada a un año?
--   (2) ¿De quien es el link anulado a mano que /direccion sigue contando?
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (1) LA FECHA DE CADA LOTE, y si parece puesta por defecto ──
--
-- POR QUE IMPORTA: un lote creado sin fecha recibe vencimiento A UN AÑO (`ubicacion-y-lote.ts`). Si los
-- cinco del laboratorio hubieran entrado asi, FEFO estaria ordenando por una fecha falsa y el aviso de 60
-- dias sonaria un año antes de tiempo.
--
-- LO QUE DEBERIA SALIR, segun `scripts/carga-inventario-inicial.sql`, que las inserto con la fecha real:
--   MULTI-CELL BASE    lote 19826     vence 2028-07-18
--   OMEGA COMPLEX      lote 20226     vence 2028-07-22
--   CURCUMIN BIOACTIV  lote 20526     vence 2028-07-25
--   D3-K2 OSTEO        lote 19726     vence 2028-07-17
--   LUVIA              lote 04197232  vence 2028-07-10
--
-- La columna `sospechosa` marca los que vencen a MENOS de 13 meses de haberse creado, que es la firma del
-- valor por defecto. Un lote real puede caer ahi legitimamente (un producto de vida corta); es una señal
-- para mirar, no un veredicto.
select n.name                                   as producto,
       l.code                                   as lote,
       l.expires_on                             as vence,
       l.received_on                            as recibido,
       l.created_at::date                        as creado,
       (l.expires_on - l.created_at::date) < 400 as sospechosa,
       coalesce((select sum(i.stock_quantity) from nutraceutical_inventory i where i.lot_id = l.id), 0) as unidades
  from lots l
  join nutraceuticals n on n.id = l.nutraceutical_id
 where coalesce(n.is_test, false) = false
 order by sospechosa desc, n.name, l.expires_on;

-- ── (2) EL LINK ANULADO A MANO que /direccion cuenta ──
--
-- LA PREGUNTA DE FONDO: esa seccion YA excluye las ventas de prueba (`and not t.cuenta_como_de_prueba`,
-- dentro de `corte`). Si el link sigue contando, es porque su venta NO esta marcada, y eso significa que su
-- paciente tampoco lo esta.
--
-- Asi que no hace falta borrar nada: si de verdad era un paciente de prueba, MARCARLO lo saca de esta cifra
-- y de todas las demas, por el mismo camino que va a usar el barrido del arranque. Y si el paciente es real,
-- la cifra esta bien: dice que alguien armo un link y se equivoco, que es justo para lo que existe.
select t.id,
       t.created_at,
       t.amount,
       t.status,
       t.cancelled_at,
       t.cancelled_by_sale_id is not null as reemplazado_por_otro_cobro,
       t.cuenta_como_de_prueba            as la_venta_cuenta_como_de_prueba,
       p.document_number                  as documento_paciente,
       p.is_test                          as paciente_marcado_a_mano,
       p.cuenta_como_de_prueba            as paciente_cuenta_como_de_prueba,
       p.test_proposed_at is not null     as paciente_propuesto_sin_confirmar,
       pr.full_name                       as profesional,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos
  from transactions t
  left join patients p on p.id = t.patient_id
  left join professional_profiles pp on pp.id = t.professional_id
  left join profiles pr on pr.id = pp.profile_id
 where t.status = 'failed' and t.cancelled_at is not null and t.cancelled_by_sale_id is null
 order by t.created_at desc;
