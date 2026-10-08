import { z } from "zod";

import { cantidadTecleada, importeTecleado } from "@/core/pesos";

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
        quantity: cantidadTecleada(1, 100_000),
      }),
    )
    .min(1)
    .max(50),
  /**
   * COBRAR PIDIENDO DESPACHO DESDE LA BODEGA (2026-09-26). Toda la venta sale de la bodega central en vez de la
   * vitrina del profesional, y queda pendiente de despacho.
   *
   * PASA POR EL SCHEMA y no solo por el FormData porque es entrada externa: mueve stock de CNV y decide de que
   * ubicacion sale. El servidor ademas comprueba que de verdad haga falta (ver el service).
   */
  desdeLaBodega: z.coerce.boolean().optional(),
  /**
   * POR QUE la compra no sale de ninguna consulta (2026-09-29). Obligatorio cuando no se elige tratamiento:
   * una compra suelta es un hecho legitimo (el que compra sin haber pasado por consulta), y negarlo
   * obligaria a inventar un vinculo. Lo que no puede pasar es que quede suelta SIN QUE NADIE LO DIGA, que
   * es lo que pasaba hasta hoy.
   */
  ventaSueltaMotivo: z.string().trim().max(200).optional(),
  /**
   * El profesional CONFIRMO que vende algo que esa consulta no prescribio (2026-09-30). La venta queda atada
   * y contada aparte: que estuviera fuera del plan se DERIVA de sus lineas, no se guarda en una columna.
   */
  fueraDelPlanConfirmado: z.coerce.boolean().optional(),
  /**
   * ENVIO A DOMICILIO (0190, sin flete desde el 2026-10-05). Ciudad y direccion van juntas o no va ninguna:
   * un domicilio sin direccion no se puede despachar, y la base tambien lo prohibe con un CHECK.
   *
   * NO VIAJA NINGUNA CIFRA, porque ya no hay ninguna: el paciente le paga el envio al mensajero, asi que
   * Atlas no cobra flete ni lo sella. Lo que el servidor si necesita es el CELULAR para coordinar la entrega.
   *
   * LA CIUDAD ES TEXTO LIBRE a proposito: era un desplegable de ciudades habilitadas, y ese porton existia
   * para no perder dinero en un envio sin tarifa. Sin flete no hay destino que le cueste a CNV, y un
   * desplegable incompleto solo le niega el envio a quien vive donde nadie alcanzo a cargar.
   */
  domicilio: z
    .object({
      // ── CIUDAD Y DIRECCION DEJAN DE SER OBLIGATORIAS (legal, 2026-10-08) ──────────────────────────
      //
      // La direccion la pide QUIEN COORDINA el envio, no el profesional en consulta: CNV ya tiene que llamar al
      // paciente para confirmarle el valor del envio, asi que pedirsela en esa llamada no agrega friccion.
      //
      // EL INVARIANTE NO SE PIERDE, SE MUDA al momento en que es verdad: no se puede marcar ENTREGADA una venta
      // a domicilio sin direccion (CHECK `transactions_domicilio_entregado_con_direccion` de la 0213, mas el
      // rechazo con mensaje en `registrarEntrega`). Antes la regla era "nace con direccion", que con esta
      // decision es imposible de cumplir.
      //
      // SE QUEDAN COMO OPCIONALES Y NO SE BORRAN: cuando el profesional SI la tiene (el paciente delante), poder
      // anotarla le ahorra una llamada a CNV. Quitar el campo seria perder eso sin ganar nada.
      ciudad: z.string().trim().max(120).optional(),
      departamento: z.string().trim().max(120).optional(),
      // VACIA SE ADMITE, pero una direccion ESCRITA A MEDIAS no: si alguien teclea tres letras, eso no es una
      // direccion y aceptarla seria peor que no tenerla (pasaria el porton de la entrega con basura).
      direccion: z
        .string()
        .trim()
        .max(300)
        .refine((v) => v === "" || v.length >= 5, "Escribe la dirección completa, o déjala vacía para que CNV la pida al coordinar.")
        .optional(),
      /**
       * EL CELULAR ES LO UNICO QUE NO SE PUEDE DEJAR PARA DESPUES, y esa es la razon de que siga exigiendose
       * cuando el paciente no tiene uno registrado: todo el plan de legal descansa en que CNV LLAMA al paciente
       * para pedirle la direccion y confirmarle el valor del envio. Sin numero no hay llamada, y entonces no hay
       * forma de conseguir la direccion despues.
       *
       * Ausente = se usa el que el paciente tenga registrado.
       */
      celular: z.string().trim().min(7, "Escribe un celular para coordinar la entrega.").max(40).optional(),
    })
    .optional(),
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
  // Se vende algo que esa consulta NO prescribió: NO se creó, el profesional confirma. La venta queda atada
  // y contada aparte, que es lo que permite medir "compran fuera del plan" (2026-09-30).
  outOfPlanWarning: string | null;
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
  // Igual que en el checkout: se vende algo que esa consulta no prescribió y el profesional confirma.
  outOfPlanWarning: string | null;
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

// El numero de la nota credito manual en Alegra (p. ej. NC3).
export const notaCreditoManualSchema = z.object({
  transactionId: dbUuid,
  numero: z.string().trim().min(2, "Escribe el número de la nota crédito.").max(60),
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

// ═══ LAS REVERSAS (Bloque 3b, sesion 1) ═══

// Abrir un contracargo: la referencia de la disputa, lo que el banco debito de VERDAD (casi nunca es el monto
// de la venta: suele traer la cuota de manejo de la disputa) y la fecha del debito, que puede no saberse aun.
export const abrirContracargoSchema = z.object({
  transactionId: dbUuid,
  referencia: z.string().trim().min(2, "Escribe la referencia de la disputa.").max(120),
  // SE LEE COMO LO TECLEA UNA PERSONA (2026-09-25). Era `Number()` sobre el texto, asi que "150.000" pasaba
  // como 150 y quedaba registrado un debito de ciento cincuenta pesos: de ahi al aviso de conciliacion, que
  // decia "difiere en 149.850" y mandaba a cuadrar una diferencia que no existia. Y el string crudo seguia
  // hasta el SQL como `::numeric`, asi que Postgres leia lo mismo: dos parsers de acuerdo en la cifra
  // equivocada. Ahora entra ya convertido a numero.
  montoDebitado: importeTecleado({ min: 1 }),
  debitadoEn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha del débito no es válida.")
    .optional()
    .or(z.literal("")),
});

// Resolver la disputa: quien la resuelve deja la referencia de la respuesta del banco, porque esa transicion
// mueve dinero (contabilidad, 2026-09-16: el mismo criterio de la lista de revision).
export const resolverReversaSchema = z.object({
  reversaId: dbUuid,
  referencia: z.string().trim().min(2, "Escribe la referencia de la respuesta del banco.").max(120),
});

export const notaCreditoDeReversaSchema = z.object({
  reversaId: dbUuid,
  numero: z.string().trim().min(2, "Escribe el número de la nota crédito.").max(60),
});
