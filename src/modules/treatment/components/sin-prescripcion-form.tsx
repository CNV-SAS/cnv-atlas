"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format/date";

import {
  registrarSinPrescripcionAction,
  retirarSinPrescripcionAction,
  type TreatmentActionState,
} from "../actions";

const INICIAL: TreatmentActionState = { error: null, success: null, warning: null };

// ═══ "NO PRESCRIBO NUTRACÉUTICOS": EL CRITERIO CLÍNICO (Santiago, 2026-10-10. Migración 0214) ═══
//
// ── DE DÓNDE SALE, Y POR QUÉ NO ES UN CAMBIO DE REDACCIÓN ────────────────────────────────────────
//
// Lo trajo de la reunión con la integrante que más vende, y el argumento es de fondo. Textual suyo: *"una cosa
// es prescribir un producto, que básicamente eso lo hacen los integrantes, y otra cosa es que el paciente
// quiera comprar o no quiera comprar algún producto."*
//
// Y la segunda mitad, que es la que decide: *"no me parece correcto registrar por qué un paciente no se lleva
// un producto cuando puede ser por precio y muchas razones"*, y además puede comprarlo después.
//
// ── QUÉ MEDÍA EL BLOQUE QUE ESTO REEMPLAZA ──────────────────────────────────────────────────────
//
// "El paciente no los adquiere por ahora" preguntaba si el PACIENTE adquiere, y eso Atlas YA LO SABE POR UN
// HECHO: Dirección mide "comprado en N consultas" desde las VENTAS. Un campo que pregunta lo mismo y lo
// responde de memoria solo puede contradecir a la venta, y ya pasó: el aviso "después, el día X, sí compró"
// existe porque la nota y la venta se contradecían.
//
// LO QUE NO TENÍAMOS POR NINGÚN LADO es esto: que el profesional evaluó y decidió NO prescribir. No deja
// rastro en ninguna otra parte, y es lo que de verdad alimenta la investigación, porque que el modelo
// recomiende algo y el profesional no lo prescriba ES el dato.
//
// ── POR QUÉ VA JUNTO A "GUARDAR PRESCRIPCIÓN" Y NO SOBRE LOS RECOMENDADOS ───────────────────────
//
// El bloque viejo vivía sobre la lista de recomendados, porque hablaba de ELLOS. Este habla de TODA la
// prescripción, y es la otra forma de cerrarla: o se prescribe algo, o se registra que no se prescribe nada.
// Las dos salidas van en el mismo sitio, que es donde el profesional termina.
//
// ── POR QUÉ ESTO NO ES UN <form> ────────────────────────────────────────────────────────────────
//
// Se monta DENTRO del formulario de la prescripción, y un `<form>` dentro de otro es HTML INVÁLIDO: el
// navegador DESCARTA la etiqueta interna, así que sus campos y su botón pasan a ser del formulario de AFUERA.
// Es el hazard 7 de CLAUDE.md, y nos costó un bloqueo real el 2026-10-02 con sus dos síntomas (pulsar
// "Registrar" guardaba la prescripción, y la recarga de esa otra acción saltaba a otra pestaña).
//
// Así que: sin `<form>` propio, los campos SIN `name` (con `name` seguirían viajando en el envío de afuera,
// que es la mitad que no se ve), controlados, y la acción por `ejecutarAccion`, que es el camino que el
// proyecto ya tiene para los botones sin formulario. Los botones, `type="button"`.
//
// ═══ PODER ARREPENTIRSE: EL BOTÓN YA NO DESAPARECE (Santiago, 2026-11-16) ═══
//
// Textual suyo: *"si alguien prescribe un nutracéutico, el botón no vuelve a aparecer, y ya no hay forma de
// arrepentirse."* Y era exacto, por dos piezas que por separado parecían tener razón:
//
//   1. ESTE BLOQUE SE ESCONDÍA con cualquier línea prescrita, incluida una de LUVIA, que NO es un
//      nutracéutico de CNV. O sea que una prescripción de solo producto externo dejaba el pendiente del
//      cierre abierto (arreglo del 16 de noviembre) y a la vez escondía la única forma de cerrarlo. Es el
//      pendiente que el profesional no puede resolver, que es lo peor que le puede pasar a una lista de
//      pendientes: enseña a no leerla.
//   2. VOLVER A CERO ESTABA FRENADO: quitar las líneas y pulsar Guardar chocaba con "no hay nada que guardar
//      todavía", un aviso pensado para la consulta que no ha prescrito NADA. Con una prescripción guardada,
//      vaciar la grilla SÍ es un cambio (borrarla), y ahora se guarda.
//
// LOS TRES ESTADOS, Y QUE SE PUEDA IR DE CUALQUIERA A CUALQUIERA:
//
//   sin decidir  →  prescrito        guardar con al menos un nutracéutico de CNV
//   sin decidir  →  no prescribo     este bloque
//   prescrito    →  sin decidir      quitar las líneas y guardar
//   prescrito    →  no prescribo     lo anterior, y entonces este bloque (la pantalla lo dice al pulsarlo)
//   no prescribo →  prescrito        prescribir LEVANTA el registro, en la misma transacción
//   no prescribo →  sin decidir      "Retirar este registro"
//
// POR QUÉ "PRIMERO QUÍTALOS" Y NO UNA CONFIRMACIÓN QUE LOS QUITE: Santiago dio las dos opciones. La primera
// encaja con lo que ya existe y la segunda no. Borrar una prescripción guardada es una escritura clínica con
// su propia firma de concurrencia (si otro profesional la cambió, el guardado la rechaza sin pisarla);
// hacerla de paso, dentro de otra acción y con una confirmación, se saltaría esa firma y escondería dentro de
// "no prescribo" el borrado de lo que otra persona acaba de prescribir.
//
// Y LA FORMA LA FIJÓ ÉL EL 2026-10-10, para el aviso de al lado: *"mejor mantenerlo activo y que salga un
// toast o mensaje... esto me parece mejor."* Un botón que desaparece no dice por qué desapareció. Así que el
// botón se queda SIEMPRE a la vista y, cuando no aplica, se pulsa y lo explica.
export function SinPrescripcionForm({
  evaluationId,
  /** Lo ya registrado, si el profesional ya decidió no prescribir. null = todavía no. */
  yaRegistrado,
  /**
   * NUTRACÉUTICOS DE CNV EN LO GUARDADO. Un producto de tercero (LUVIA) no cuenta: no es un nutracéutico, así
   * que no contradice el criterio. La cuenta sale del módulo neutro `producto-de-tercero`, el mismo que parte
   * el catálogo arriba y el mismo que decide el pendiente del cierre.
   */
  deCnvGuardados,
  /**
   * Y LOS DE LA GRILLA, que es estado del NAVEGADOR. Van las dos fuentes porque ofrecer el registro con líneas
   * a punto de guardarse invita a una consulta que afirma las dos cosas (Santiago, 2026-10-10: *"esto es
   * falso, no se pueden quitar de la prescripción"* salía justo de mirar una sola).
   */
  deCnvEnGrilla,
}: {
  evaluationId: string;
  yaRegistrado: { motivo: string; at: string } | null;
  deCnvGuardados: number;
  deCnvEnGrilla: number;
}) {
  const [state, action, pending] = useActionState(registrarSinPrescripcionAction, INICIAL);
  const [retiro, retirar, retirando] = useActionState(retirarSinPrescripcionAction, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [confirmarRetiro, setConfirmarRetiro] = useState(false);
  const [motivo, setMotivo] = useState("");
  useFormToastRefreshOnSuccess(state);
  useFormToastRefreshOnSuccess(retiro);

  // YA REGISTRADO: se dice, y la única acción que se ofrece es RETIRARLO. No se ofrece escribir otro motivo
  // encima: el segundo pisaría al primero sin que nadie lo note, que es la razón por la que esto no se volvía
  // a ofrecer. Retirar y volver a registrar son dos actos, y cada uno queda en el audit log.
  if (yaRegistrado) {
    return (
      <div className="flex max-w-prose flex-col gap-2 rounded-md border border-dashed border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          Registraste el {formatDate(yaRegistrado.at)} que no prescribes nutracéuticos en esta consulta:{" "}
          &ldquo;{yaRegistrado.motivo}&rdquo;
        </p>
        {confirmarRetiro ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              Al retirarlo, la consulta vuelve a quedar sin decidir sobre los nutracéuticos y el pendiente del
              cierre se abre otra vez. Queda registrado quién lo retiró y cuándo.
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                key="confirmar-retiro"
                type="button"
                variant="outline"
                disabled={retirando}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("evaluationId", evaluationId);
                  ejecutarAccion(retirar, fd);
                }}
              >
                {retirando ? "Retirando..." : "Sí, retirar"}
              </Button>
              <Button
                key="cancelar-retiro"
                type="button"
                variant="ghost"
                disabled={retirando}
                onClick={() => setConfirmarRetiro(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmarRetiro(true)}>
              Retirar este registro
            </Button>
          </div>
        )}
      </div>
    );
  }

  // CON NUTRACÉUTICOS DE CNV NO SE REGISTRA, Y SE DICE POR QUÉ. Decir las dos cosas sobre la misma consulta
  // deja a quien la lea después sin saber cuál creer, y es la historia clínica. El servidor lo RE-COMPRUEBA
  // dentro de la transacción, porque una guarda que solo vive en la pantalla se salta invocando la acción.
  const hayDeCnv = deCnvGuardados > 0 || deCnvEnGrilla > 0;

  if (!abierto) {
    return (
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        No prescribo nutracéuticos
      </Button>
    );
  }

  if (hayDeCnv) {
    return (
      <div className="flex max-w-prose flex-col gap-2 rounded-md border border-clinical-warning/40 bg-muted/30 p-3">
        <p className="text-sm">
          {deCnvGuardados > 0
            ? "Esta consulta ya tiene nutracéuticos de CNV en la prescripción guardada. Para registrar que no prescribes, quita esas líneas de la prescripción y pulsa Guardar prescripción; entonces vuelve aquí."
            : "Tienes nutracéuticos de CNV en la prescripción, sin guardar. Quítalos de la lista, o guárdalos si son los que le indicaste, y vuelve aquí."}
        </p>
        {/* LO QUE NO ES UN NUTRACÉUTICO NO ESTORBA, y se dice, porque es justo el caso que traía el defecto:
            con una LUVIA prescrita y ningún nutracéutico, esto no aparece y el registro se puede hacer. */}
        <span className="text-xs text-muted-foreground">
          Un producto externo (de otra marca) no cuenta: no es un nutracéutico de CNV y no impide registrar tu
          criterio.
        </span>
        <div>
          <Button
            key="entendido-sin-prescripcion"
            type="button"
            variant="ghost"
            onClick={() => setAbierto(false)}
          >
            Entendido
          </Button>
        </div>
      </div>
    );
  }

  const registrar = () => {
    const fd = new FormData();
    fd.set("evaluationId", evaluationId);
    fd.set("motivo", motivo);
    ejecutarAccion(action, fd);
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-sin-prescripcion" className="text-xs">
          Por qué no prescribes nutracéuticos en esta consulta
        </Label>
        <Input
          id="motivo-sin-prescripcion"
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Tu criterio clínico: por ejemplo, prefiero ajustar primero la alimentación"
          autoFocus
        />
        {/* SE DICE EL MÍNIMO ANTES DE PULSAR, no después en un error: el motivo es lo único que esto registra,
            y un "escribe al menos 5 caracteres" tras enviar se lee como un obstáculo y no como lo que es. */}
        <span className="text-xs text-muted-foreground">
          Queda en la historia clínica de esta consulta, con tu nombre y la fecha.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button key="registrar-sin-prescripcion" type="button" disabled={pending} onClick={registrar}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
        <Button
          key="cancelar-sin-prescripcion"
          type="button"
          variant="ghost"
          onClick={() => setAbierto(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
