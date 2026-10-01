-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- MAPEAR LA CUENTA A LA QUE LLEGAN LAS TRANSFERENCIAS  ·  se corre una vez por ambiente
--
-- QUE DESBLOQUEA: el boton "Verifiqué el extracto: el pago entró" necesita saber a que cuenta de Alegra
-- apuntar el pago. Sin ella dice que falta, en vez de apuntarlo a la del efectivo, que diria que la plata
-- esta en el bolsillo de alguien cuando ya llego al banco.
--
-- EL ID SALE DE LA URL DE LA CUENTA EN ALEGRA. Santiago abrio "Banco 1" y la URL termina en /id/3, asi que
-- en SANDBOX es 3. EN PRODUCCION SON OTROS: los tres (efectivo, transferencia y pasarela) se releen con
-- `node scripts/leer-alegra.mjs` con las credenciales de produccion puestas en la ventana.
--
-- ── LO QUE ESTO NO HACE, Y ES LO IMPORTANTE ──
--
-- NO vuelve automatico el registro del pago. La cola sigue sin apuntar las transferencias: la factura sale y
-- el pago espera a que una persona lo confirme. Esta cuenta es a donde apunta ESA persona cuando pulsa el
-- boton. La regla sigue siendo la misma: la automatizacion no afirma el pago, lo afirma quien lo vio.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. VER lo que hay hoy. La fila del ambiente en uso es la que importa.
SELECT id, env, bank_account_efectivo_id, bank_account_pasarela_id, bank_account_transferencia_id
  FROM alegra_config;

-- 2. MAPEARLA. Cambiar el 3 si el ambiente es otro.
UPDATE alegra_config
   SET bank_account_transferencia_id = 3,
       updated_at = now()
 WHERE env = 'sandbox';

-- 3. COMPROBAR: la columna ya no puede quedar nula en el ambiente en uso.
SELECT env, bank_account_transferencia_id FROM alegra_config;
