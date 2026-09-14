"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// MIENTRAS EL PACIENTE PAGA CON EL QR, la pantalla se actualiza sola: el pago lo sella el aviso de Wompi, que
// llega al servidor y no a este navegador, y el profesional no tiene por que adivinar cuando recargar.
//
// Cada 5 segundos durante 10 minutos, y despues se detiene: una consulta no espera mas que eso, y una pagina
// olvidada abierta no tiene por que seguir pidiendo al servidor toda la tarde. El boton sigue sirviendo.
const CADA_MS = 5_000;
const DURANTE_MS = 10 * 60_000;

export function EsperandoPago() {
  const router = useRouter();
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!activo) return;
    const intervalo = setInterval(() => router.refresh(), CADA_MS);
    const fin = setTimeout(() => setActivo(false), DURANTE_MS);
    return () => {
      clearInterval(intervalo);
      clearTimeout(fin);
    };
  }, [activo, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {activo ? "Esperando el pago. La pantalla se actualiza sola." : "¿Ya pagó? Actualiza para ver el pago."}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={() => router.refresh()}>
        Actualizar
      </Button>
    </div>
  );
}
