"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { ComodatoFormState } from "../validations";

// Dispara el toast segun el estado retornado por la action. Exactamente uno de
// error/success/warning llega no-nulo. Se ignora el estado inicial (todo nulo) y
// se compara por referencia para no repetir el toast en cada render.
export function useComodatoToast(state: ComodatoFormState) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success(state.success);
  }, [state]);
}
