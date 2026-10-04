"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { marcarProfesionalDePruebaFormAction, type MarcaFormState } from "../actions";

const INICIAL: MarcaFormState = { error: null, success: null, warning: null };

// ═══ MARCAR UNA CUENTA DE PRUEBA, Y REVERTIRLO (Santiago, 2026-10-04) ═══
//
// La columna existe desde la 0199 y solo se escribia por SQL. Con pacientes ya habia botón, y la asimetría se
// notaba justo cuando más se usa: durante un smoke, alternando una cuenta entre real y de prueba.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta dentro de pantallas que ya tienen formularios, y
// un `<form>` dentro de otro lo descarta el navegador. Los campos se arman a mano y no llevan `name`.
export function MarcaDePruebaForm({
  professionalId,
  esDePrueba,
}: {
  professionalId: string;
  esDePrueba: boolean;
}) {
  const [state, action, pending] = useActionState(marcarProfesionalDePruebaFormAction, INICIAL);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  const enviar = (marcar: boolean) => {
    const fd = new FormData();
    fd.set("professionalId", professionalId);
    fd.set("esDePrueba", marcar ? "true" : "false");
    fd.set("motivo", motivo);
    ejecutarAccion(action, fd);
  };

  // YA MARCADO: se dice lo que eso significa y se ofrece revertirlo. Sin la explicación, "de prueba" se lee
  // como una etiqueta y no como lo que es: sus cifras no cuentan en ninguna parte.
  if (esDePrueba) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 text-sm">
        <p className="text-muted-foreground">
          <strong className="text-foreground">Es una cuenta de prueba.</strong> Sus ventas, su margen y sus
          pacientes no cuentan en las cifras de la organización, y se le ofrecen los productos de prueba para
          cobrar y prescribir. Su inventario sí sigue siendo real: las unidades que tenga están en su vitrina.
        </p>
        <Button
          key="desmarcar-profesional"
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => enviar(false)}
          className="self-start"
        >
          {pending ? "Cambiando..." : "Ya no es cuenta de prueba"}
        </Button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <Button
        key="abrir-marca-prueba"
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
        className="self-start"
      >
        Marcar como cuenta de prueba
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        Sus ventas, su margen y sus pacientes dejarán de contar en las cifras de la organización. Su inventario
        no se toca: las unidades que tenga siguen en su vitrina, porque son reales.
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-marca-prueba" className="text-xs">
          Por qué es una cuenta de prueba
        </Label>
        {/* SIN `name`, a propósito: este bloque vive dentro de una pantalla con formularios y un campo con
            nombre viajaría en ESE envío. */}
        <Input
          id="motivo-marca-prueba"
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por ejemplo: cuenta del smoke, no atiende pacientes reales"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button key="marcar-profesional" type="button" size="sm" disabled={pending || motivo.trim().length < 5} onClick={() => enviar(true)}>
          {pending ? "Marcando..." : "Marcar"}
        </Button>
        <Button
          key="cancelar-marca-profesional"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
