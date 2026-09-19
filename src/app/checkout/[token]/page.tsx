import Image from "next/image";

import { reportServerError } from "@/lib/observability/report-error";
import { getCheckoutByToken, type CheckoutView } from "@/modules/payments/data/checkout-reader";
import { buildWompiCheckoutParams } from "@/modules/payments/services/payments-service";

export const metadata = { title: "Pago - VITACELLEBIS" };

// Contenedor centrado de la superficie publica de pago (sin shell de la app). La marca que ve el paciente
// es la del PRODUCTO (VITACELLEBIS) con quien le cobra (CNV, con su NIT), no la de la herramienta del
// profesional: ver el porque en el bloque de arriba.
function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/brand/vitacellebis.png"
            alt="VITACELLEBIS"
            // LAS MEDIDAS SON LAS REALES DEL ARCHIVO (1632x465). Iban 480x120, que es otra proporcion, y
            // con `w-auto` el navegador calcula el ancho con la proporcion DECLARADA: por eso se veia
            // estirado. El tamaño no era el problema, la deformacion si.
            width={1632}
            height={465}
            priority
            unoptimized
            // DOS VECES el tamaño inicial (Santiago, segunda vuelta): es la marca que el paciente tiene
            // que reconocer antes de pagar, y a tres veces quedaba angosta en un telefono.
            className="h-20 w-auto"
          />
          <p className="text-center text-[11px] leading-tight text-muted-foreground">
            CONNECTED NUTRITION VENTURES S.A.S.
            <br />
            NIT 902045562-3
          </p>
        </div>
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

  // ═══ SI LA LECTURA FALLA, EL PACIENTE VE QUE HACER, NO UN ERROR GENERICO (2026-09-14) ═══
  //
  // La API de Supabase respondio 502 de forma intermitente al abrir este link, y la pagina caia en "algo salio
  // mal". Un paciente que ve eso se va; uno que ve "intenta de nuevo en unos segundos" y tiene el boton, lo
  // intenta. Solo se captura la LECTURA, que es lo pasajero: un error de configuracion (una llave faltante,
  // abajo) no se disfraza de "intenta de nuevo".
  //
  // SE SIGUE REPORTANDO A SENTRY, con el area "checkout.leer-link": sin el throw ya no llega como error sin
  // manejar, y la frecuencia de este fallo es justo lo que se esta investigando.
  let view: CheckoutView | null;
  try {
    view = await getCheckoutByToken(token);
  } catch (e) {
    reportServerError("checkout.leer-link", e);
    return (
      <CheckoutShell>
        <h1 className="text-xl font-bold tracking-tight text-foreground">No pudimos cargar tu link de pago</h1>
        <p className="text-center text-sm text-muted-foreground">
          Es un problema pasajero de nuestro lado. Intenta de nuevo en unos
          segundos.
        </p>
        {/* Un enlace a la misma pagina y no un boton con JavaScript: funciona en cualquier telefono. */}
        <a
          href={`/checkout/${encodeURIComponent(token)}`}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Intentar de nuevo
        </a>
        <p className="text-center text-xs text-muted-foreground">
          Si sigue sin cargar, avísale a tu profesional.
        </p>
      </CheckoutShell>
    );
  }

  if (!view) {
    return (
      <CheckoutShell>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Link no disponible</h1>
        <p className="text-center text-sm text-muted-foreground">
          Este link de pago no existe, ya fue usado o venció (vale 24 horas). Pide uno
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
        <h1 className="text-xl font-bold tracking-tight text-foreground">Pago de nutracéuticos</h1>
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
        {/* Firmado junto con el monto: la pagina de Wompi deja de cobrar cuando vence el link. */}
        <input type="hidden" name="expiration-time" value={wompi.expirationTime} />
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
