import Link from "next/link";
import { Pencil } from "lucide-react";

// LAS DOS MEDIDAS DEL PROFESIONAL, MOSTRADAS EN ANTROPOMETRIA Y EDITADAS EN LAS CONDICIONES.
//
// DE DONDE SALE ESTA PIEZA (cotejo 2026-09-05, punto 4). Santiago pregunto por que el peso meta y la
// fuerza prensil viven al final de las condiciones de la toma, cuando el archivo de Gildardo los tiene en
// Antropometria. Verificado en su codigo, y lo dice su propio comentario: "lo que el profesional escribe a
// mano en Antropometria -cintura, cadera, dinamometria y peso meta- se guarda por paciente en cuanto lo
// teclea". O sea que en su pantalla van con la cintura y la cadera.
//
// POR QUE NO SE MUEVEN, y es la parte que costo ver: en SU archivo estan ahi porque las condiciones de la
// toma NO son un formulario aparte con su gate. En Atlas si lo son, y hoy el profesional llena las
// condiciones, la prensil y el peso meta EN UN SOLO GUARDADO, en un solo momento de la consulta. Moverlos
// partiria eso en dos guardados en dos subpestañas.
//
// Y hay un motivo tecnico que apunta al mismo lado: la fila de condiciones tiene `bis_condition_version_id`
// y `condition_answers` NOT NULL, y su writer hace un upsert de la fila entera. Un update parcial desde
// otra pantalla, con la fila todavia sin crear, afectaria CERO filas y el valor se perderia en silencio:
// el hazard del campo que deja de viajar.
//
// LA DECISION (Santiago, 2026-09-05): se MUESTRAN donde el los pone y se EDITAN donde se llenan. Queda
// declarado como DIV-18. Con dos cuidados que son los que hacen que esto no confunda:
//   · el enlace cae en el BLOQUE exacto (`#medidas-del-profesional`), no en la subpestaña entera;
//   · y se ve que aqui son de solo lectura, para que nadie intente escribirlos y no entienda por que no
//     puede. Por eso el rotulo lo dice y no hay campos: no son inputs deshabilitados, que se leen como
//     "esto deberia poder tocarse".

export function MedidasDelProfesionalResumen({
  evaluationId,
  pesoMetaKg,
  fuerzaPrensilKg,
}: {
  evaluationId: string;
  pesoMetaKg: number | null;
  fuerzaPrensilKg: number | null;
}) {
  const dato = (v: number | null, unidad: string) =>
    v == null ? "Sin registrar" : `${v} ${unidad}`;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Medidas del profesional
        </h4>
        {/* EL ENLACE VA AL BLOQUE, no a la subpestaña: `?etapa` y `?ev` colocan la pantalla y el `#` cae en
            el sitio donde estan los dos campos. Sin la etapa explicita, la pagina caeria a su default (la
            leccion del punto 5 de este mismo cotejo). */}
        <Link
          href={`/evaluaciones/${evaluationId}?etapa=evaluacion&ev=encuesta#medidas-del-profesional`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          <Pencil className="size-3" aria-hidden />
          Editar en las condiciones de la toma
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Se registran junto con las condiciones de la toma, en un solo guardado. Aquí solo se consultan.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Peso meta</dt>
          <dd className="text-sm font-semibold text-foreground">{dato(pesoMetaKg, "kg")}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Fuerza prensil</dt>
          <dd className="text-sm font-semibold text-foreground">{dato(fuerzaPrensilKg, "Kgf")}</dd>
        </div>
      </dl>
    </section>
  );
}
