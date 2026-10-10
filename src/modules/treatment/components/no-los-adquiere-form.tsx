import { formatDate } from "@/lib/format/date";

// ═══ LA NOTA VIEJA DE "EL PACIENTE NO LOS ADQUIERE": SOLO LECTURA (2026-10-10, migración 0214) ═══
//
// ── QUÉ ERA ESTO, Y POR QUÉ YA NO SE ESCRIBE ────────────────────────────────────────────────────
//
// Era un botón para registrar que el paciente no se llevaba los nutracéuticos recomendados. Se retiró el
// 2026-10-10 por el argumento que Santiago trajo de la reunión con la integrante que más vende: *"una cosa es
// prescribir un producto... y otra cosa es que el paciente quiera comprar o no."*
//
// Medía lo que no servía. Si el paciente adquiere, LO DICE LA VENTA (Dirección cuenta "comprado en N
// consultas" desde las transacciones), así que un campo que pregunta lo mismo y lo responde de memoria solo
// puede contradecir al hecho. Y su respuesta caduca: el paciente puede comprarlos la semana siguiente.
//
// Lo reemplaza `SinPrescripcionForm`, que registra otra cosa: el criterio clínico de NO prescribir, que es del
// profesional y no deja rastro en ninguna otra parte.
//
// ── POR QUÉ SE QUEDA LA LECTURA ─────────────────────────────────────────────────────────────────
//
// Hay consultas cerradas con este registro, y es parte de su historia clínica. Lo escrito antes NO se
// reinterpreta (no pasa a leerse como criterio clínico, que era otra cosa) y tampoco se esconde: esconderlo
// dejaría una consulta que se cerró por esa vía pareciendo cerrada por nada. Es el mismo criterio con el que
// se congeló la columna en la base, con su COMMENT.
//
// NO ES UN COMPONENTE CLIENTE: ya no tiene estado ni acción, solo pinta un dato. Lo importa una sección
// cliente, así que viaja igual en su bundle; lo que se gana es que no declara interactividad que no tiene.
export function NoLosAdquiereForm({
  /** El motivo que se escribió entonces. Cadena vacía si se registró sin texto. */
  yaRegistrado,
  /** Cuándo se registró, para poder decir cuál de los dos hechos es el último. */
  registradoEn,
  /** La venta pagada MÁS RECIENTE posterior al "no", si la hay. */
  ventaPosteriorEn,
}: {
  yaRegistrado: string;
  registradoEn?: string | null;
  ventaPosteriorEn?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        Quedó registrado{registradoEn ? ` el ${formatDate(registradoEn)}` : ""} que el paciente no los adquiere
        por ahora
        {yaRegistrado.trim() !== "" ? <>: &ldquo;{yaRegistrado}&rdquo;</> : null}. Si cambia de decisión y se
        los lleva, regístralo con la venta.
      </p>
      {/* ═══ LOS DOS HECHOS CONVIVEN, Y LA PANTALLA DICE CUÁL ES EL ÚLTIMO (Santiago, 2026-10-02) ═══

          Registrar "no los adquiere" y después venderle NO es una contradicción que haya que resolver
          borrando una de las dos: son DOS HECHOS EN DOS MOMENTOS, y los dos son verdad. El "no" fue la
          decisión de esa consulta y la compra ocurrió después.

          Borrar la nota al vender perdería el dato que la nota existe para capturar (que el modelo recomendó
          algo y en ese momento no se lo llevó). Dejarla sola haría que la pantalla contradijera a la venta.
          Así que se quedan las dos y se dice CUÁL ES LA MÁS NUEVA, que es lo único que faltaba. */}
      {ventaPosteriorEn ? (
        <p className="px-3 text-xs text-attention">
          Después, el {formatDate(ventaPosteriorEn)}, sí compró. Lo último que pasó es la compra; la nota de
          arriba fue la decisión de ese momento y se conserva.
        </p>
      ) : null}
    </div>
  );
}
