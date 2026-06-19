import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Pagina no encontrada - Atlas" };

// 404 con marca. Server Component: no necesita interactividad. Tono sobrio
// (BRAND.md): factual, sin dramatismo.
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-muted p-6 text-center">
      <Image
        src="/brand/logo-horizontal.svg"
        alt="Atlas"
        width={160}
        height={32}
        priority
        unoptimized
        className="h-8 w-auto"
      />
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Error 404
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          No encontramos esta pagina
        </h1>
        <p className="max-w-prose text-muted-foreground">
          La direccion no existe o ya no esta disponible. Verifica el enlace o
          vuelve al inicio.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}
