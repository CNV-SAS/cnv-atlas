import { formatDateTime } from "@/lib/format/date";

// ═══ EL COTEJO CON WOMPI: QUE HACER CON CADA VENTA (Bloque 3b, sesion 3) ═══
//
// Modulo PURO: recibe lo que Atlas tiene y lo que Wompi dice, y decide. Sin base, sin red, sin reloj propio.
//
// EL HUECO QUE CIERRA: Wompi reintenta su webhook 3 veces en 24 horas y despues no mas. Una venta cobrada cuyo
// webhook se perdio queda `pending` para siempre: sin sellar, sin factura, sin comision y sin que nadie se entere
// (paso el 2026-09-15 con la base saturada, con plata de prueba).
//
// Y LA REGLA QUE MANDA AQUI: ante la duda NO se sella. Recuperar un pago es escribir plata; si algo no cuadra
// (sobre todo el monto), esto no lo arregla solo, lo deja anotado para que una persona lo mire. Una venta sellada
// por error cuesta mucho mas que una que espera un dia.

export type EstadoEnAtlas = "esperando" | "pagada";

export type VentaDeAtlas = {
  id: string;
  estado: EstadoEnAtlas;
  /** El monto de Atlas, en pesos, como lo guarda la venta. */
  monto: string;
  /** La transaccion de Wompi con la que se sello el pago, si Atlas la sabe. */
  wompiId?: string | null;
  /** Cuando se creo la venta, para poder nombrarla en pantalla. */
  creada?: string | null;
};

export type FilaDeWompi = {
  id: string;
  reference?: string | null;
  status: string;
  amount_in_cents?: number | null;
  payment_method_type?: string | null;
  payment_method?: Record<string, unknown> | null;
};

export type ARecuperar = {
  ventaId: string;
  wompiId: string;
  metodo: string | null;
  tipoDeTarjeta: string | null;
};

export type Discrepancia = {
  ventaId: string;
  wompiId: string | null;
  motivo: string;
  /** Para poder NOMBRAR la venta en pantalla: sin esto el aviso dice "2 no cuadran" y nadie sabe cuales. */
  monto?: string | null;
  cuando?: string | null;
};

/**
 * EL AVISO, AGRUPADO POR CAUSA Y CON LAS VENTAS NOMBRADAS (Santiago, 2026-09-18). Con dos casos iguales, el aviso
 * repetia la misma frase dos veces y no decia cuales eran; con diez seria ilegible. Se agrupa por motivo, se
 * nombran las primeras con su monto y su hora, y el resto se remite al panel, que las tiene todas.
 */
export function resumirDiscrepancias(ds: Discrepancia[], tope = 3): string[] {
  const grupos = new Map<string, Discrepancia[]>();
  for (const d of ds) grupos.set(d.motivo, [...(grupos.get(d.motivo) ?? []), d]);
  return [...grupos.entries()].map(([motivo, dels]) => {
    const nombradas = dels
      .slice(0, tope)
      .map((d) => {
        const monto = d.monto ? `${Number(d.monto).toLocaleString("es-CO")} COP` : "una venta";
        return d.cuando ? `${monto} del ${formatDateTime(d.cuando)}` : monto;
      })
      .join(" y ");
    const resto = dels.length - Math.min(dels.length, tope);
    const cuantas = dels.length === 1 ? "1 venta" : `${dels.length} ventas`;
    return `${cuantas}: ${motivo} ${nombradas}${resto > 0 ? `, y ${resto} más (están en el panel)` : ""}`;
  });
}

export type Cotejo = { recuperar: ARecuperar[]; discrepancias: Discrepancia[] };

/**
 * Lo que la pantalla muestra de la ultima corrida. VIVE AQUI, en el modulo neutro, y no en el repositorio: el
 * panel es un componente cliente, y un `import { formatDateTime } from "@/lib/format/date";

import type` desde un modulo `server-only` lo borra tsc sin avisar pero
 * deja la arista viva para el bundler (CLAUDE.md, frontera A).
 */
export type UltimaCorrida = {
  ranAt: string;
  origen: string;
  revisadas: number;
  recuperadas: number;
  discrepancias: number;
  /** Las discrepancias de esa corrida, para que la pantalla diga CUALES no cuadraron y por que. */
  detalle: Discrepancia[];
  falloPor: string | null;
};

const APROBADA = "APPROVED";
/** Estados de Wompi que contradicen una venta que Atlas tiene por pagada. */
const CONTRADICEN = new Set(["VOIDED", "DECLINED", "ERROR"]);

/** Wompi habla en centavos y Atlas en pesos. Se comparan en centavos, sin decimales de por medio. */
function centavosDe(montoEnPesos: string): number | null {
  const n = Number(montoEnPesos);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function tipoDeTarjeta(fila: FilaDeWompi): string | null {
  const extra = fila.payment_method?.extra as { card_type?: unknown } | undefined;
  return typeof extra?.card_type === "string" ? extra.card_type : null;
}

/**
 * Empareja por la REFERENCIA, que es el id de la venta en Atlas. Devuelve que sellar y que dejar anotado.
 *
 * `filas` son las transacciones que Wompi reporto en el rango; una venta sin fila no es un problema (el paciente
 * no pago, que es lo normal en un link que nadie uso).
 */
export function cotejar(ventas: VentaDeAtlas[], filas: FilaDeWompi[]): Cotejo {
  const porReferencia = new Map<string, FilaDeWompi[]>();
  for (const f of filas) {
    if (!f.reference) continue;
    porReferencia.set(f.reference, [...(porReferencia.get(f.reference) ?? []), f]);
  }

  const recuperar: ARecuperar[] = [];
  const discrepancias: Discrepancia[] = [];

  for (const venta of ventas) {
    const suyas = porReferencia.get(venta.id) ?? [];
    const aprobada = suyas.find((f) => f.status === APROBADA);

    if (venta.estado === "esperando") {
      if (!aprobada) continue; // Nadie pago: nada que recuperar.
      const esperado = centavosDe(venta.monto);
      if (esperado === null || aprobada.amount_in_cents == null || aprobada.amount_in_cents !== esperado) {
        // NO SE SELLA. Cobrar una cifra y sellar otra descuadra el ingreso, la comision y la factura.
        discrepancias.push({
          ventaId: venta.id,
          wompiId: aprobada.id,
          motivo: `Wompi aprobó ${aprobada.amount_in_cents ?? "?"} centavos y la venta dice ${esperado ?? "?"}. No se selló: revísala a mano.`,
          monto: venta.monto,
          cuando: venta.creada ?? null,
        });
        continue;
      }
      recuperar.push({
        ventaId: venta.id,
        wompiId: aprobada.id,
        metodo: aprobada.payment_method_type ?? null,
        tipoDeTarjeta: tipoDeTarjeta(aprobada),
      });
      continue;
    }

    // La venta esta PAGADA en Atlas. Si Wompi dice otra cosa, el dinero se fue: es el contracargo o la anulacion
    // de la sesion 1. Aqui solo se anota y se avisa; revertir es de esa sesion.
    //
    // SE MIRA LA TRANSACCION QUE PAGO, no "que no haya ninguna aprobada" (smoke del 2026-09-17): al anular, Wompi
    // deja la fila con estado VOIDED, y si ademas hubiera otro intento aprobado del mismo link, la version
    // anterior daba la anulacion por buena y no avisaba. Cuando Atlas sabe cual fue su transaccion, esa manda;
    // cuando no (ventas viejas, sin el id guardado), se cae a la regla anterior.
    const contradice = venta.wompiId
      ? suyas.find((f) => f.id === venta.wompiId && CONTRADICEN.has(f.status))
      : suyas.find((f) => CONTRADICEN.has(f.status)) ?? null;
    if (contradice && (venta.wompiId || !aprobada)) {
      discrepancias.push({
        ventaId: venta.id,
        wompiId: contradice.id,
        motivo: `Atlas la tiene pagada y Wompi dice ${contradice.status}.`,
        monto: venta.monto,
        cuando: venta.creada ?? null,
      });
    }
  }

  return { recuperar, discrepancias };
}
