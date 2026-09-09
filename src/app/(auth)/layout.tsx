import Image from "next/image";

// Layout de las paginas de auth: marca minima (logo sobre el formulario),
// centrado. El shell completo por rol vive en el grupo (app).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6">
      {/* "ATLAS CNV", igual que el shell (2026-09-09). Esta es la puerta del PROFESIONAL: el paciente
          nunca pasa por aqui (entra por `/encuesta/<token>`, que dice "Atlas Pacientes"). Que las dos
          puertas se nombren distinto es justo lo que se venia a conseguir. */}
      <div className="flex items-center gap-2">
        <Image
          src="/brand/logo-horizontal.svg"
          alt="Atlas"
          width={160}
          height={32}
          priority
          unoptimized
          className="h-8 w-auto"
        />
        <span className="text-xl font-semibold tracking-tight text-muted-foreground">CNV</span>
      </div>
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        {children}
      </main>
    </div>
  );
}
