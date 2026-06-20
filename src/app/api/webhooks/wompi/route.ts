import { NextResponse, type NextRequest } from "next/server";

import * as Sentry from "@sentry/nextjs";

import { verifyEventSignature, type WompiEvent } from "@/lib/wompi/signatures";
import { processWompiWebhook } from "@/modules/payments/services/payments-service";
import { wompiEventSchema } from "@/modules/payments/validations";

// Webhook de Wompi: POST /api/webhooks/wompi. Llega sin sesion (el proxy excluye
// /api). La seguridad es la firma HMAC (WOMPI_EVENTS_SECRET) mas la idempotencia
// del servicio; no se rate-limita (SECURITY.md). Node runtime: usa node:crypto y BD.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    // Sin secret no se puede verificar nada: es un error de configuracion.
    return NextResponse.json({ error: "config" }, { status: 500 });
  }

  // Cuerpo crudo: la firma se calcula sobre los valores del evento tal como llegan.
  const raw = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Verifica la firma ANTES de confiar en cualquier campo del payload.
  if (!verifyEventSignature(payload as WompiEvent, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Ya autenticado: valida la forma con Zod para extraer los campos con seguridad.
  const parsed = wompiEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await processWompiWebhook(parsed.data);
  } catch (e) {
    // Falla al procesar: 500 para que Wompi reintente. La idempotencia (gate de
    // payment_webhook_events + sellado por status='pending') evita doble efecto.
    Sentry.captureException(e, { tags: { area: "wompi-webhook" } });
    return NextResponse.json({ error: "processing" }, { status: 500 });
  }

  // 200: evento recibido. Incluye duplicados ya procesados, que no hacen nada.
  return NextResponse.json({ received: true });
}
