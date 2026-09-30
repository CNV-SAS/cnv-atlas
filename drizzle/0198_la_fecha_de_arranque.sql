-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA FECHA DE ARRANQUE: DESDE CUANDO LAS CIFRAS CUENTAN LA OPERACION REAL
--
-- EL PROBLEMA (Santiago, 2026-09-30): el dia que entren las llaves reales, las tarjetas de Direccion y de
-- Inicio van a arrastrar todo lo de antes: las ventas de los smokes, las de Profesional Demo, las de Maria
-- Camila y las mias. No son cifras equivocadas, son cifras de OTRA COSA, y mezcladas con la operacion real
-- hacen imposible leer como va el negocio.
--
-- POR QUE UNA FECHA Y NO UN BORRADO. Borrar iria contra la regla 14 (ninguna cuenta clinica se recicla) y
-- ademas fallaria A MEDIAS: las ventas se irian y los movimientos de inventario no, porque son append-only
-- por trigger. La vitrina quedaria con saldo sin ventas que lo expliquen, y un borrado a medias miente mas
-- que no borrar. Aqui no se borra NADA: el historial queda entero y auditable, y lo que cambia es que se
-- CUENTA.
--
-- ── LO QUE ESTA FECHA NO PUEDE TOCAR, Y ES LA LINEA IMPORTANTE ──
--
-- NO recorta lo que se le DEBE a alguien. Una comision anterior al arranque sigue siendo plata que hay que
-- pagarle al Integrante, y la liquidacion la tiene que seguir viendo. Lo que se recorta es la CIFRA DE
-- RESUMEN de las pantallas ("como va la operacion"), que es otra pregunta. Por eso la liquidacion, la
-- cuenta del Integrante y su comision pendiente quedan FUERA de este corte, cada una con su razon escrita
-- en el candado.
--
-- NULL = no hay arranque todavia y se cuenta todo, que es exactamente el comportamiento de hoy. Se pone el
-- dia de las llaves reales, y no antes: ponerla temprano escondería operacion de verdad.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "commercial_config"
  ADD COLUMN IF NOT EXISTS "fecha_de_arranque" date;--> statement-breakpoint

COMMENT ON COLUMN "commercial_config"."fecha_de_arranque" IS
  'Dia desde el que las cifras de resumen cuentan la operacion real. NULL = se cuenta todo. No borra nada ni afecta lo que se le debe a alguien.';
