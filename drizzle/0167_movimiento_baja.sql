-- Movimiento `baja` (devolucion fisica, 3b sesion 2): sale de cuarentena (-) contra gasto, con el motivo escrito.
-- UN SOLO ENUNCIADO por archivo: `ALTER TYPE ... ADD VALUE` no corre dentro de una transaccion.
ALTER TYPE "nutraceutical_movement_type" ADD VALUE IF NOT EXISTS 'baja';
