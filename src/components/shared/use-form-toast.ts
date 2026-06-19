"use client";

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
