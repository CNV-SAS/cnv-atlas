-- Movimiento `reincorporacion` (devolucion fisica, 3b sesion 2): sale de cuarentena (-) y entra al lote vendible (+), con quien verifico.
-- UN SOLO ENUNCIADO por archivo: `ALTER TYPE ... ADD VALUE` no corre dentro de una transaccion.
ALTER TYPE "nutraceutical_movement_type" ADD VALUE IF NOT EXISTS 'reincorporacion';
