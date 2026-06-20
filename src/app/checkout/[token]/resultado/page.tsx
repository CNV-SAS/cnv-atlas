import Image from "next/image";

export const metadata = { title: "Pago recibido - Atlas" };

// Pagina de retorno tras el pago en Wompi. La confirmacion real llega por el webhook
// (no por esta redireccion, que el paciente podria no completar). Mensaje informativo.
export default function CheckoutResultPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <Image
          src="/brand/logo-horizontal.svg"
          alt="Atlas"
          width={140}
          height={28}
          priority
          unoptimized
          className="h-7 w-auto"
        />
        <h1 className="text-xl font-bold tracking-tight text-foreground">Recibimos tu pago</h1>
        <p className="text-sm text-muted-foreground">
          Estamos confirmando la transaccion con Wompi. Puedes cerrar esta ventana; tu
          profesional vera la confirmacion en Atlas.
        </p>
      </div>
    </main>
  );
}
