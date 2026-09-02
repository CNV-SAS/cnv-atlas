"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { preservarScroll } from "./preservar-scroll";
import { toast } from "sonner";

// Estado generico de formularios con useActionState: exactamente uno de
// error/success/warning queda no-nulo por accion.
export type FormToastState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

// Dispara el toast correcto cuando cambia el estado. Ignora el estado inicial
// (todo nulo) y compara por referencia para no repetir el toast en cada render.
// EL SALTO AL INICIO EN LA PRIMERA ACCION DE CADA RUTA. Los tres hooks lo deshacen, incluido este que ni
// refresca: la causa es INVOCAR la server action (navega con ScrollBehavior.Default), no el refresco, que
// usa NoScroll. Por eso el arreglo va aqui, en el mecanismo unico por donde pasan los 78 formularios, y no
// en el panel donde se noto. Ver el porque completo en `preservar-scroll.ts`.
export function useFormToast(state: FormToastState) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    preservarScroll();
    if (state.error) toast.error(state.error);
    else if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success(state.success);
  }, [state]);
}

// Igual que useFormToast, pero para formularios que DESAPARECEN al tener éxito (su item deja la lista tras la
// acción, p. ej. confirmar una remesa: deja de estar pendiente). Si la ACCIÓN hace `revalidatePath`, la lista
// se recompone y el formulario se DESMONTA antes de que este efecto dispare el toast, y el toast se pierde
// (nunca se llama a `toast.xxx`; sonner lo muestra en un portal, así que una vez llamado persiste). La
// solución: la acción NO revalida; aquí se dispara el toast (que ya persiste) y LUEGO se refresca la lista con
// `router.refresh()`, en ese orden. Así el formulario sigue montado cuando se llama al toast, y se ve siempre.
export function useFormToastAndRefresh(state: FormToastState) {
  const router = useRouter();
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    preservarScroll();
    if (state.error) {
      toast.error(state.error);
      return; // error: nada cambió en el servidor, no hay que refrescar
    }
    if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success(state.success);
    else return; // estado inicial u otro: nada que hacer
    router.refresh(); // refresca la lista DESPUÉS de disparar el toast (que ya está en el portal)
  }, [state, router]);
}

// Como useFormToastAndRefresh, pero refresca SOLO en success (warning y error preservan el formulario). Para
// formularios que se REMONTAN por un `key` derivado del dato GUARDADO (p. ej. el panel de tratamiento, keyed
// por la firma de lo guardado). Dos razones por las que la variante importa:
//  - En success hay que refrescar para que el key cambie y el form re-derive del servidor. Si la acción
//    revalidara ella misma, el remonte correría contra el efecto del toast y el toast se perdería (misma
//    carrera que arriba); por eso la acción NO revalida y el refresh se hace aquí, DESPUÉS del toast.
//  - En un WARNING de concurrencia (stale_write) NO se debe refrescar: traería el cambio del otro profesional,
//    movería el key y remontaría el form, DESCARTANDO lo que este escribió, que es justo lo que el stale_write
//    preserva para que lo reaplique. El mensaje le pide recargar a mano cuando decida.
export function useFormToastRefreshOnSuccess(state: FormToastState) {
  const router = useRouter();
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    preservarScroll();
    if (state.error) {
      toast.error(state.error);
      return;
    }
    if (state.warning) {
      toast.warning(state.warning);
      return; // sin refresh: preserva la edición en curso
    }
    if (state.success) {
      toast.success(state.success);
      router.refresh(); // refresca DESPUÉS del toast (que ya está en el portal), para re-derivar del servidor
    }
  }, [state, router]);
}
