"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { registrarDestinoFormAction } from "../actions";
import type { AccionDeVentaState } from "../validations";

const INICIAL: AccionDeVentaState = { error: null, success: null, warning: null };

// ═══ PEDIR LA DIRECCION Y REGISTRARLA, DESDE EL PANEL DE ENVIOS (legal, 2026-10-08) ═══
//
// AQUI ES DONDE SE CUMPLE LA DECISION: *"la dirección la captura quien coordina el envío, no el profesional en
// consulta"*. Quien lee esta tabla es quien va a llamar al paciente para confirmarle el valor del envío, así que
// la dirección se escribe en el mismo momento en que se pregunta.
//
// Y ES LA SUPERFICIE QUE EL PORTON NECESITA: no se puede marcar entregada una venta a domicilio sin dirección.
// Sin este formulario, el portón habría dejado toda venta desde la bodega imposible de entregar.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta dentro de una tabla que vive en una pantalla con
// formularios, y un `<form>` dentro de otro lo descarta el navegador, con dos síntomas que no apuntan al
// anidamiento. Campos SIN `name` y controlados; los botones en `type="button"`.
export function RegistrarDestinoForm({
  transactionId,
  faltaCelular,
}: {
  transactionId: string;
  /** El envío tampoco tiene celular: entonces hay que pedir los dos en la misma llamada. */
  faltaCelular: boolean;
}) {
  const [state, action, pending] = useActionState(registrarDestinoFormAction, INICIAL);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [celular, setCelular] = useState("");

  if (!abierto) {
    return (
      <Button key="abrir-destino" type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Registrar la dirección
      </Button>
    );
  }

  const listo = ciudad.trim() !== "" && direccion.trim().length >= 5 && (!faltaCelular || celular.trim() !== "");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-left">
      <p className="max-w-prose text-xs text-muted-foreground">
        Llama al paciente, confírmale el valor del envío y anota a dónde va. Mientras no tenga dirección{" "}
        <strong className="text-foreground">no se puede marcar como entregada</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {/* SIN `name`, a propósito: este bloque vive dentro de una pantalla con formularios y un campo con
            nombre viajaría en ESE envío. */}
        <Input
          aria-label="Ciudad de destino"
          placeholder="Ciudad"
          maxLength={120}
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          className="h-9 w-40"
          autoFocus
        />
        <Input
          aria-label="Departamento"
          placeholder="Departamento"
          maxLength={120}
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          className="h-9 w-40"
        />
        <Input
          aria-label="Dirección de entrega"
          placeholder="Calle, número, apartamento, barrio"
          maxLength={300}
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="h-9 min-w-[16rem] flex-1"
        />
        {faltaCelular ? (
          <Input
            aria-label="Celular para coordinar"
            inputMode="tel"
            placeholder="Celular"
            maxLength={40}
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            className="h-9 w-40"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          key="guardar-destino"
          type="button"
          size="sm"
          disabled={pending || !listo}
          onClick={() => {
            const fd = new FormData();
            fd.set("transactionId", transactionId);
            fd.set("ciudadDestino", ciudad);
            fd.set("departamentoDestino", departamento);
            fd.set("direccionEntrega", direccion);
            if (faltaCelular) fd.set("celularEntrega", celular);
            ejecutarAccion(action, fd);
          }}
        >
          {pending ? "Guardando..." : "Guardar el destino"}
        </Button>
        <Button
          key="cancelar-destino"
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
