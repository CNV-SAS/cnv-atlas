"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
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
export function useFormToast(state: FormToastState) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
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
