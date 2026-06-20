import { z } from "zod";

// Validaciones de pagos. Ids con z.guid() (no z.uuid(): rechazaria los UUIDs fijos
// del seed; hallazgo de B4). Cantidades con coerce porque la UI las envia como
// strings de FormData.

const dbUuid = z.guid();

// Crear un checkout: paciente + lineas de orden. El precio unitario NO viene del
// cliente, se sella en el servidor desde el catalogo de nutraceuticos.
export const createCheckoutSchema = z.object({
  patientId: dbUuid,
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

// Envelope del evento de Wompi. Es entrada externa, asi que pasa por Zod (CLAUDE.md);
// solo se modela lo que usamos. La autenticidad la da la firma HMAC, no este schema.
export const wompiEventSchema = z.object({
  event: z.string(),
  timestamp: z.number(),
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
};
