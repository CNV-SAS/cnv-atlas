"use client";

import { useActionState, useEffect, useRef } from "react";

import { preservarScroll } from "@/components/shared/preservar-scroll";

import { useEtapaActiva } from "@/modules/diagnoses/components/etapa-activa";

import { confirmIdentityAction } from "../actions";
import type { ConfirmIdentityState } from "../validations";

// CONFIRMACION DE IDENTIDAD SIN CLIC (2026-09-09, peticion de Gildardo via Santiago).
//
// EL PUNTO DE PARTIDA, y por que no se podia quitar el bloque sin mas: confirmar identidad NO era solo
// resolver el documento repetido. `confirmEvaluationIdentity` hace CUATRO cosas, y solo la primera es la
// que el profesional percibe:
//   1. Resuelve la ambiguedad de identidad (el nombre declarado contra el registrado).
//   2. SEGUNDO MURO del consentimiento: comprueba que la rama usada (menor con representante legal, o
//      adulto) sea coherente con la fecha de nacimiento REAL. Nada que ver con documentos repetidos.
//   3. Pasa la evaluacion de `draft` a `in_progress`, que es el GATE de todo lo de abajo: sin eso el
//      import BIS y el diagnostico se niegan a correr.
//   4. Audita `evaluation.identity_confirmed` con actor, correo e IP.
//
// LO QUE SE QUITA ES EL CLIC, NO EL ACTO. Cuando no hay nada que decidir (sin conflicto declarado y sin
// candidatos a duplicado), pedirle al profesional que pulse un boton para decir "si, es esta persona" no
// añade informacion: no ha visto nada que contrastar. Se confirma al abrir la evaluacion y el bloque
// desaparece. Cuando SI hay algo que decidir, la pagina monta el bloque completo y este componente no se
// usa: la decision sigue siendo humana.
//
// LOS CUATRO EFECTOS SE CONSERVAN, incluida la auditoria. Y el muro del consentimiento tambien: si falla,
// la accion NO confirma y el aviso aparece aqui, que es el caso que Santiago pidio que no pasara callado.
//
// LA SEGURIDAD NO DEPENDE DE ESTE COMPONENTE. La accion revalida en el servidor el conflicto, el estado y
// la coherencia de la rama, dentro de la transaccion. Un cliente manipulado no puede saltarse nada: lo
// unico que hace este archivo es pulsar por el profesional lo que el iba a pulsar de todas formas.
export function IdentidadAutomatica({ evaluationId }: { evaluationId: string }) {
  const [state, action] = useActionState(confirmIdentityAction, {
    error: null,
    confirmed: false,
  } satisfies ConfirmIdentityState);
  // UNA SOLA VEZ. En desarrollo React monta dos veces a proposito (StrictMode), y sin esto la accion se
  // dispararia dos veces: la segunda seria inocua (el guard de estado la rechaza con "ya fue confirmada")
  // pero dejaria un intento de mas en el log del servidor.
  const disparado = useRef(false);

  // ═══ SOLO DESDE LA PESTAÑA QUE SE ESTA VIENDO (2026-09-10) ═══
  //
  // LO ENCONTRO EL BARRIDO del disparo del diagnostico, no un smoke, y es la misma forma con otra
  // consecuencia. Este bloque vive dentro de `EntradaEvaluacion`, que se renderiza en DOS pestañas
  // (Encuesta y Antrop. & BIS). Mientras cambiar de pestaña desmontaba la anterior, solo existia UNA
  // instancia a la vez; desde que una etapa visitada no se desmonta, pueden existir LAS DOS.
  //
  // QUE PASARIA SIN ESTA GUARDA: dos instancias, dos efectos, dos confirmaciones. La segunda la rechaza el
  // guard de estado del servidor con "ya fue confirmada", y este componente pinta el error en un recuadro
  // de advertencia. O sea que el profesional veria "No se pudo confirmar la identidad automáticamente"
  // sobre una identidad que SI se confirmo. Un aviso falso sobre un acto clinico.
  //
  // Y NO CAMBIA LA CONDUCTA QUERIDA ("se confirma sola al abrir"): sin diagnostico la pestaña que se abre
  // es Encuesta, asi que su instancia esta activa al cargar y dispara igual que antes.
  const activa = useEtapaActiva();
  useEffect(() => {
    if (!activa || disparado.current) return;
    disparado.current = true;
    const datos = new FormData();
    datos.set("evaluationId", evaluationId);
    // AQUI NO HAY CLIC, pero la pagina si esta donde el profesional la dejo: esta accion se dispara
    // sola al entrar a la etapa. Sin el guard, un salto al inicio ocurriria sin que el hubiera pulsado
    // nada, que es la version mas desconcertante del mismo defecto.
    preservarScroll();
    action(datos);
  }, [activa, action, evaluationId]);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // AL CONFIRMAR SE REFRESCA **UNA** VEZ, Y LA HACE LA ACCION  ·  2026-11-15
  //
  // HACE FALTA REFRESCAR: la pagina se rindio con la evaluacion en `draft`, asi que las condiciones de
  // la toma y el import BIS llegaron apagados, y sin refresco el profesional veria una pantalla que le
  // dice que no puede importar cuando ya puede.
  //
  // LO QUE SE QUITA ES EL SEGUNDO CICLO. `confirmIdentityAction` ya revalida `/ani-bis-e` y la ruta de
  // esta consulta, asi que su respuesta trae la pagina re-renderizada; este efecto la pedia OTRA VEZ.
  // Dos ciclos no solo duplican el trabajo: compiten, y el payload que acaba aplicandose puede ser el
  // de antes. Es el defecto que Santiago reporto en el panel del diagnostico (smoke del 2026-11-15) y
  // estaba vivo aqui tambien, en la misma forma escrita a mano. Candado: `refresco-una-sola-vez`,
  // que desde hoy barre tambien los refrescos a mano y no solo los dos hooks.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  // EN SILENCIO CUANDO SALE BIEN. Un aviso de "identidad confirmada" para algo que el profesional no pidio
  // es ruido: le cuenta un tramite, no un hecho clinico. Queda en el audit, que es donde importa.
  if (!state.error) return null;

  return (
    <div className="rounded-lg border border-clinical-warning bg-clinical-warning-bg p-4">
      <p className="text-sm font-semibold text-clinical-warning">
        No se pudo confirmar la identidad automáticamente
      </p>
      <p className="mt-1 text-sm text-foreground">{state.error}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        La evaluación queda en borrador hasta que se resuelva: no se puede importar la medición ni generar
        el diagnóstico.
      </p>
    </div>
  );
}
