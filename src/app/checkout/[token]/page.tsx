import Image from "next/image";

import { getCheckoutByToken } from "@/modules/payments/data/checkout-reader";
import { buildWompiCheckoutParams } from "@/modules/payments/services/payments-service";

export const metadata = { title: "Pago - Atlas" };

// Contenedor centrado de la superficie publica de pago (sin shell de la app).
function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 shadow-sm">
        <Image
          src="/brand/logo-horizontal.svg"
          alt="Atlas"
          width={140}
          height={28}
          priority
          unoptimized
          className="h-7 w-auto"
        />
        {children}
      </div>
    </main>
  );
}

// Pagina publica (sin sesion): el paciente abre el link y paga en Wompi por
// redirect. El token es el id opaco de la transaccion; la pagina no expone PII, solo
// el monto. El link vale 24h y solo sirve si la transaccion sigue pendiente.
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getCheckoutByToken(token);

  if (!view) {
    return (
      <CheckoutShell>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Link no disponible</h1>
        <p className="text-center text-sm text-muted-foreground">
          Este link de pago no existe, ya fue usado o vencio (vale 24 horas). Pide uno
          nuevo a tu profesional.
        </p>
      </CheckoutShell>
    );
  }

  const wompi = buildWompiCheckoutParams(view);
  const amountLabel = `${Number(view.amount).toLocaleString("es-CO")} ${view.currency}`;

  return (
    <CheckoutShell>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Pago de nutraceuticos</h1>
        <p className="text-sm text-muted-foreground">Total a pagar</p>
        <p className="text-3xl font-extrabold tracking-tight text-foreground">{amountLabel}</p>
      </div>

      {/* Web Checkout por redirect: el form firma con la clave de integridad y manda
          al checkout alojado de Wompi. Sin JS de cliente. */}
      <form action="https://checkout.wompi.co/p/" method="GET" className="w-full">
        <input type="hidden" name="public-key" value={wompi.publicKey} />
        <input type="hidden" name="currency" value={wompi.currency} />
        <input type="hidden" name="amount-in-cents" value={wompi.amountInCents} />
        <input type="hidden" name="reference" value={wompi.reference} />
        <input type="hidden" name="signature:integrity" value={wompi.signature} />
        <input type="hidden" name="redirect-url" value={wompi.redirectUrl} />
        <button
          type="submit"
          className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Pagar con Wompi
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Pago seguro procesado por Wompi.
      </p>
    </CheckoutShell>
  );
}
