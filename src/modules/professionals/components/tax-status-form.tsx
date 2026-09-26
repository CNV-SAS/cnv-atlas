"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveBankAccountAction, saveMisDatosAction, saveTaxIdentityAction } from "../actions";
import type { TaxStatusFields, TaxStatusFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: TaxStatusFormState = { error: null, success: false };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// Formularios del integrante (rediseño A2). Solo lo que SABE: tipo de persona, documento (adaptado), RUT si
// lo tiene, y cuenta bancaria. Los campos certificados (declarante, IVA, obligado) los llena CNV al
// verificar el RUT, no van aqui. onSubmit + startTransition (no prop `action`): incluye el archivo y evita
// el auto-reset de React 19.
//
// SON DOS FORMULARIOS DESDE QUE EL PERFIL TIENE PESTAÑAS (2026-09-25), uno por pestaña. Lo que ataba las dos
// mitades (la validacion del titular y la marca de "dio su parte") se resolvio en el servidor; ver el
// comentario de `validations.ts`. Aqui lo unico que queda del corte es que el aviso de exito es distinto en
// cada uno, porque lo que pasa despues de guardar es distinto: lo tributario se verifica, la cuenta no.

/** Aviso por `toast` sin repetirlo en cada re-render. Los dos formularios lo comparten. */
function useAvisoDeGuardado(state: TaxStatusFormState, exito: string) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success(exito);
  }, [state, exito]);
}

export function TaxIdentityForm({
  professionalId,
  current,
}: {
  professionalId: string;
  current: TaxStatusFields;
}) {
  const [state, action, pending] = useActionState(saveTaxIdentityAction, initial);
  const [personType, setPersonType] = useState<"" | "natural" | "juridica">(current.personType ?? "");
  const [hasRut, setHasRut] = useState<"" | "true" | "false">(
    current.hasRut == null ? "" : current.hasRut ? "true" : "false",
  );
  useAvisoDeGuardado(state, "Recibimos tus datos. Los estamos verificando.");

  const isJuridica = personType === "juridica";
  const rutRequired = isJuridica || hasRut === "true"; // juridica siempre tiene RUT

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Label htmlFor="personType" className="text-xs">
          Tipo de persona
        </Label>
        <select
          id="personType"
          name="personType"
          required
          value={personType}
          onChange={(e) => setPersonType(e.target.value as "" | "natural" | "juridica")}
          className={`${selectClass} sm:w-64`}
        >
          <option value="" disabled>
            Selecciona
          </option>
          <option value="natural">Persona natural</option>
          <option value="juridica">Persona jurídica</option>
        </select>
      </div>

      {/* Documento adaptado: natural pide tipo (CC/CE) + numero; juridica pide NIT + DV. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isJuridica ? (
          <>
            <input type="hidden" name="idType" value="NIT" />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="idNumber" className="text-xs">
                NIT
              </Label>
              <Input id="idNumber" name="idNumber" required defaultValue={current.idNumber ?? ""} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="idDv" className="text-xs">
                Dígito de verificación
              </Label>
              <Input id="idDv" name="idDv" required inputMode="numeric" maxLength={2} defaultValue={current.idDv ?? ""} className="h-9 w-24" />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="idType" className="text-xs">
                Tipo de documento
              </Label>
              <select
                id="idType"
                name="idType"
                required
                defaultValue={current.idType === "CE" ? "CE" : "CC"}
                className={selectClass}
              >
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="idNumber" className="text-xs">
                Número de documento
              </Label>
              <Input id="idNumber" name="idNumber" required defaultValue={current.idNumber ?? ""} className="h-9" />
            </div>
          </>
        )}
      </div>

      {/* RUT: juridica siempre tiene. Natural: se pregunta, con el EMPUJON junto a la pregunta (antes de
          elegir "No"), para que se sienta util y no burocratico. */}
      {isJuridica ? (
        <input type="hidden" name="hasRut" value="true" />
      ) : (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Tu RUT</legend>
          <p className="text-sm text-muted-foreground">
            Si prestas servicios profesionales, probablemente ya tienes RUT. Puedes descargarlo del portal de
            la DIAN. Con tu RUT, tu clasificación queda tomada del documento y no de lo que recuerdes.
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="hasRut" value="true" checked={hasRut === "true"} onChange={() => setHasRut("true")} required className="accent-primary" />
              Sí tengo RUT
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="hasRut" value="false" checked={hasRut === "false"} onChange={() => setHasRut("false")} required className="accent-primary" />
              No tengo
            </label>
          </div>
        </fieldset>
      )}

      {rutRequired ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="rutFile" className="text-xs">
            RUT (archivo PDF)
          </Label>
          {current.rutUploaded ? (
            <p className="text-xs text-muted-foreground">
              Ya tienes un RUT cargado (
              <a href={`/rut/${professionalId}`} target="_blank" rel="noreferrer" className="text-primary underline">
                verlo
              </a>
              ). Solo súbelo de nuevo si cambió.
            </p>
          ) : null}
          <Input
            id="rutFile"
            name="rutFile"
            type="file"
            accept="application/pdf"
            required={!current.rutUploaded}
            className="h-9 py-1.5"
          />
          <span className="text-xs text-muted-foreground">Solo PDF (el que descargas de la DIAN).</span>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Guardar mis datos tributarios"}
      </Button>
    </form>
  );
}

export function BankAccountForm({ current }: { current: TaxStatusFields }) {
  const [state, action, pending] = useActionState(saveBankAccountAction, initial);
  useAvisoDeGuardado(state, "Cuenta guardada.");

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Aquí giramos tu margen. El titular debe ser la misma persona o empresa que lo recibe, por requisito
        tributario: quien recibe el dinero debe ser quien emite el soporte.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bankName" className="text-xs">
            Banco
          </Label>
          <Input id="bankName" name="bankName" required defaultValue={current.bankName ?? ""} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bankAccountType" className="text-xs">
            Tipo de cuenta
          </Label>
          <select id="bankAccountType" name="bankAccountType" required defaultValue={current.bankAccountType ?? ""} className={selectClass}>
            <option value="" disabled>
              Selecciona
            </option>
            <option value="ahorros">Ahorros</option>
            <option value="corriente">Corriente</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bankAccountNumber" className="text-xs">
            Número de cuenta
          </Label>
          <Input id="bankAccountNumber" name="bankAccountNumber" required defaultValue={current.bankAccountNumber ?? ""} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bankAccountHolderName" className="text-xs">
            Titular de la cuenta (nombre)
          </Label>
          <Input id="bankAccountHolderName" name="bankAccountHolderName" required defaultValue={current.bankAccountHolderName ?? ""} className="h-9" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="bankAccountHolderDocument" className="text-xs">
            Documento del titular (debe ser el tuyo)
          </Label>
          <Input id="bankAccountHolderDocument" name="bankAccountHolderDocument" required defaultValue={current.bankAccountHolderDocument ?? ""} className="h-9 sm:w-72" />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Guardar mi cuenta"}
      </Button>
    </form>
  );
}

/**
 * Sus datos de contacto: lo unico de la pestaña "Mis datos" que el edita.
 *
 * SEPARADO DE LOS DATOS FIJOS a proposito. Los tres campos de arriba (nombre, correo, profesion) los pone un
 * administrador y se ven como datos; si estuvieran en el mismo formulario habria que deshabilitarlos, y un
 * campo deshabilitado dentro de un formulario invita a intentar escribirlo. Aqui el formulario contiene solo lo
 * que de verdad se puede guardar.
 */
export function MisDatosForm({
  current,
}: {
  current: { phone: string | null; officeAddress: string | null; officeCity: string | null };
}) {
  const [state, action, pending] = useActionState(saveMisDatosAction, initial);
  useAvisoDeGuardado(state, "Datos guardados.");

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="phone" className="text-xs">
            Celular
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={current.phone ?? ""}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="officeCity" className="text-xs">
            Ciudad del consultorio
          </Label>
          <Input id="officeCity" name="officeCity" defaultValue={current.officeCity ?? ""} className="h-9" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="officeAddress" className="text-xs">
            Dirección del consultorio
          </Label>
          <Input
            id="officeAddress"
            name="officeAddress"
            defaultValue={current.officeAddress ?? ""}
            className="h-9"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Guardar mis datos"}
      </Button>
    </form>
  );
}
