-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL CUPO DE CREDITO: 3.000.000 (Santiago, 2026-10-06)
--
-- ═══ POR QUE ES UN SCRIPT Y NO UNA MIGRACION ═══
--
-- Es un VALOR DE NEGOCIO, no estructura. El modelo comercial lo pide explicito (principio 2: "nada de valores
-- fijos en el codigo... cupos de credito"), y una migracion que lo escribiera lo volveria parte del esquema:
-- cambiarlo exigiria otra migracion, cuando lo que Santiago pidio es poder cambiarlo sin tocar codigo.
--
-- ═══ Y LA CIFRA ES PROVISIONAL, CON SU RAZON ═══
--
-- Textual de Santiago: "todavia no sabemos que cantidad es razonable para bloquear a alguien. Hoy podemos
-- decir 3 millones, pero mañana puede haber gente que los haga muy rapido, y bloquear por eso no seria buena
-- opcion".
--
-- POR ESO EL CUPO AVISA Y NO BLOQUEA. Al pasarlo, admin ve que ese Integrante ya debe mas de su tope y decide
-- el si le despacha. La mora SI sigue suspendiendo despachos, que es otra regla y no tiene umbral que adivinar.
--
-- SE REVISA cuando haya dos o tres quincenas reales de Katherine: su cifra propia dice cual es el tope
-- razonable. La desviacion frente al modelo esta anotada en MODELO_COMERCIAL §4.
--
-- ═══ QUE MIDE EL SALDO QUE SE COMPARA CONTRA ESTO ═══
--
-- Lo VENDIDO y no pagado, que incluye lo que todavia no se ha facturado (corregido el 2026-10-06). Es lo que
-- pidio el asesor legal: "el cupo cubre el saldo ya vendido y no pagado". Antes solo contaba lo facturado, y
-- asi el aviso llegaba una quincena tarde.
--
-- SOLO APLICA A DISTRIBUCION: en Comision el Integrante no le debe nada a CNV, asi que su cupo no se mira.
--
-- COMO SE CORRE (contra la nube, en el SQL editor de Supabase):
--   psql "<cadena>" -f scripts/PONER_EL_CUPO_DE_CREDITO_2026-10-06.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) A QUIEN SE LE PONE: a los que operan bajo DISTRIBUCION ───────────────────────────────────
--
-- SOLO A LOS QUE NO TENGAN UNO, con el `is null`: si alguien ya tiene un cupo propio decidido, este script no
-- se lo pisa. Un script que sobreescribe decisiones anteriores es como se pierde un ajuste que alguien hizo a
-- proposito.
update professional_profiles pp
   set credit_limit = 3000000
 where pp.credit_limit is null
   and exists (
     select 1 from professional_modalities m
      where m.professional_id = pp.id
        and m.modality = 'distribucion'
        and m.valid_from <= (now() at time zone 'America/Bogota')::date
        and (m.valid_to is null or m.valid_to > (now() at time zone 'America/Bogota')::date)
   );

-- ── (B) COMPROBAR QUE QUEDO, Y EL SALDO DE CADA UNO ─────────────────────────────────────────────
--
-- `saldo_pendiente` es la MISMA aritmetica del codigo (base descontada al peso, IVA al peso sobre ella), con
-- las dos mitades: lo facturado sin pagar y lo vendido sin facturar.
select p.full_name                                  as integrante,
       pp.credit_limit::numeric                     as cupo,
       coalesce((
         select sum(round(ti.base_amount - ti.commission_amount)
                  + round(round(ti.base_amount - ti.commission_amount) * 0.19))
           from transaction_items ti
           join transactions t on t.id = ti.transaction_id
           left join distribucion_statements s on s.id = t.distribucion_statement_id
          where ti.modality = 'distribucion'
            and ti.sealed_at is not null
            and t.professional_id = pp.id
            and ((s.id is not null and s.paid_at is null and s.replaced_by_id is null)
                 or t.distribucion_statement_id is null)
       ), 0)                                        as saldo_pendiente
  from professional_profiles pp
  join profiles p on p.id = pp.profile_id
 where exists (
   select 1 from professional_modalities m
    where m.professional_id = pp.id and m.modality = 'distribucion'
      and m.valid_from <= (now() at time zone 'America/Bogota')::date
      and (m.valid_to is null or m.valid_to > (now() at time zone 'America/Bogota')::date)
 )
 order by 1;
