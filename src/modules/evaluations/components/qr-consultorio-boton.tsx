"use client";

import { QrCode } from "lucide-react";
import { useState, useTransition } from "react";

import { preservarScroll } from "@/components/shared/preservar-scroll";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { generateBaseSurveyQrAction } from "../actions";

// EL QR EN UNA CAPA, SIN PASAR POR CREAR UN PACIENTE (Santiago, 2026-09-10).
//
// POR QUE ES SU PROPIO BOTON Y NO UN ENLACE A OTRA PANTALLA: enseñar el QR es un acto de DIEZ SEGUNDOS que
// ocurre con el paciente delante ("escanea esto"). Mandarlo a una pantalla de creacion de pacientes para
// que ahi despliegue un bloque es hacerle atravesar un formulario que no va a llenar.
//
// Y GRANDE, que es la unica razon de que sea una capa y no un desplegable: esto se escanea desde el
// telefono del paciente a medio metro. Un QR de 200 px dentro de una tarjeta se escanea mal; a pantalla
// completa, no.
//
// SE GENERA AL ABRIR, no al cargar la pantalla: es una llamada al servidor que la mayoria de las veces
// nadie necesita.
export function QrConsultorioBoton() {
  const [abierto, setAbierto] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  function abrir() {
    setAbierto(true);
    if (qr || cargando) return; // El QR es ESTABLE: una vez generado no hace falta pedirlo otra vez.
    // El guard del scroll: invocar una server action navega con ScrollBehavior.Default.
    preservarScroll();
    empezar(async () => {
      const r = await generateBaseSurveyQrAction();
      setError(r.error);
      setQr(r.qrDataUrl);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={abrir}>
        <QrCode className="size-4" aria-hidden />
        Mostrar QR de consultorio
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR de consultorio</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              El paciente lo escanea con su teléfono, responde la encuesta, y la evaluación queda
              atribuida a ti. El código es estable: no cambia.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {qr ? (
              <>
                {/* Data URL generado en servidor (solo la URL del token opaco, sin PII). `next/image` no
                    aporta sobre un data URL local. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt="QR del enlace de consultorio"
                  width={320}
                  height={320}
                  className="rounded-lg bg-white p-3"
                />
                <a
                  href={qr}
                  download="qr-consultorio.png"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Descargar para imprimir
                </a>
              </>
            ) : (
              <p className="py-10 text-sm text-muted-foreground">
                {cargando ? "Generando el código..." : "Sin código todavía."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
