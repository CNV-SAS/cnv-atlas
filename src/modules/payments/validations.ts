import { z } from "zod";

// Validaciones de pagos. Ids con z.guid() (no z.uuid(): rechazaria los UUIDs fijos
// del seed; hallazgo de B4). Cantidades con coerce porque la UI las envia como
// strings de FormData.

const dbUuid = z.guid();

// Crear un checkout: paciente + lineas de orden. El precio unitario NO viene del
// cliente, se sella en el servidor desde el catalogo de nutraceuticos.
export const createCheckoutSchema = z.object({
  patientId: dbUuid,
  // El tratamiento del que nace la venta (pestaña Tratamiento). Sin el, es la venta de `/pagos`: el paciente
  // que vuelve solo a comprar. Con el, el servidor comprueba que sea de ese paciente y que lo vendido este
  // prescrito.
  treatmentId: dbUuid.optional(),
  items: z
    .array(
      z.object({
        nutraceuticalId: dbUuid,
        quantity: z.coerce.number().int().positive().max(100_000),
      }),
    )
    .min(1)
    .max(50),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

// Venta en efectivo: como el checkout, mas un idempotencyKey que genera el CLIENTE (uno por intento de
// venta) para que un doble-clic no cobre dos veces. El writer deduplica por esa clave.
export const registerCashSaleSchema = createCheckoutSchema.extend({
  idempotencyKey: dbUuid,
});
export type RegisterCashSaleInput = z.infer<typeof registerCashSaleSchema>;

// Envelope del evento de Wompi. Es entrada externa, asi que pasa por Zod (CLAUDE.md);
// solo se modela lo que usamos. La autenticidad la da la firma HMAC, no este schema.
export const wompiEventSchema = z.object({
  event: z.string(),
  timestamp: z.number(),
  // EL AMBIENTE DEL PAGO, segun Wompi: "test" en sandbox, "prod" en produccion (docs.wompi.co, eventos). Es
  // la fuente del hecho y el sellado lo usa para corregir el de la venta (Bloque 3). Opcional para no romper
  // el sellado si un evento no lo trae; un valor desconocido se rechaza, no se adivina.
  environment: z.enum(["test", "prod"]).optional(),
  signature: z.object({
    checksum: z.string(),
    properties: z.array(z.string()),
  }),
  data: z.object({
    transaction: z.object({
      id: z.string(),
      reference: z.string(),
      status: z.string(),
      amount_in_cents: z.number(),
      currency: z.string(),
      // EL INSTRUMENTO con que pago el paciente (CARD, PSE, NEQUI, BANCOLOMBIA_TRANSFER...). Wompi lo manda
      // en CADA evento y este esquema no lo declaraba, asi que Zod lo eliminaba antes de guardar: el dato
      // llegaba autenticado y se tiraba. Hace falta para el medio de pago DIAN de la factura y para la
      // comision, que no es la misma por instrumento. Opcional porque un evento sin el no debe romper el
      // sellado del pago, que es lo que no se puede perder.
      payment_method_type: z.string().max(40).optional(),
      // Y EL TIPO DE TARJETA, que `payment_method_type` no dice: para Wompi las dos son "CARD". Viaja en
      // `payment_method.extra.card_type`. Se declara SOLO lo que se usa (no el objeto entero, que trae
      // datos del titular de la tarjeta que no hay por que guardar).
      payment_method: z
        .object({
          extra: z.object({ card_type: z.string().max(20).optional() }).partial().optional(),
        })
        .partial()
        .optional(),
    }),
  }),
});
export type WompiEventInput = z.infer<typeof wompiEventSchema>;

// Estado del formulario de creacion de checkout (useActionState). checkoutUrl lleva
// el link que el profesional comparte con el paciente cuando la creacion fue ok.
export type PaymentFormState = {
  error: string | null;
  success: string | null;
  checkoutUrl: string | null;
  // Aviso de checkout duplicado vivo: NO se creó, el profesional confirma con "Generar de todos modos".
  duplicateWarning: string | null;
};

// Estado del formulario de venta en efectivo (useActionState). Al exito confirma con el monto sellado.
// duplicateWarning: hay una venta en efectivo IDENTICA reciente; NO se registro, el profesional confirma
// con "Registrar de todos modos" (mismo patron que el checkout duplicado).
export type CashSaleFormState = {
  error: string | null;
  success: string | null;
  duplicateWarning: string | null;
  // El paciente tiene un link de pago PENDIENTE con alguno de estos productos: NO se registro. El profesional
  // confirma con "Anular el link y cobrar en efectivo" (decision (b) de Santiago, 2026-09-14).
  pendingLinkWarning: string | null;
};

// Estado de los botones que actuan sobre UNA venta (anular el link, entregar, resolver una revision). Tiene
// la forma de `FormToastState`.
export type AccionDeVentaState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

export const accionDeVentaSchema = z.object({ transactionId: dbUuid });

// La version del Integrante: texto libre corto. Minimo 10 caracteres para que no se resuelva con un "ok".
export const versionDelIntegranteSchema = z.object({
  transactionId: dbUuid,
  version: z.string().trim().min(10, "Cuenta en una o dos frases qué pasó en la consulta.").max(1000),
});

// El comprobante de la devolucion en Wompi (la referencia que da el panel de Wompi).
export const comprobanteDeDevolucionSchema = z.string().trim().min(3, "Escribe el comprobante de la devolución.").max(200);

// Estado del boton de reintentar facturas. Lleva `warning` porque `useFormToastRefreshOnSuccess` lo
// espera, y porque un reintento puede salir a medias: unas emitidas y otras no.
export type RetryFormState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};
