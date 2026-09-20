import Image from "next/image";

export const metadata = { title: "Gracias - Atlas Pacientes" };

// Pantalla de cierre tras enviar la encuesta. Estatica y publica: no depende del
// token (que pudo quedar consumido) ni expone datos.
export default function GraciasPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/logo-horizontal.svg"
            alt="Atlas"
            width={140}
            height={28}
            priority
            unoptimized
            className="h-7 w-auto"
          />
          <span className="text-lg font-semibold tracking-tight text-muted-foreground">
            Pacientes
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Gracias, recibimos tus respuestas
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu profesional de salud revisará tu información y dará continuidad a tu
            atención. Ya puedes cerrar esta ventana.
          </p>
        </div>
      </div>
    </main>
  );
}
