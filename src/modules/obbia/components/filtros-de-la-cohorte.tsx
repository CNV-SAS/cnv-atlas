import { CAMPOS_DEL_FILTRO, type FiltroDeCohorte } from "../services/filtro-de-la-cohorte";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS FILTROS DE LA COHORTE  ·  2026-11-04
//
// ═══ UN FORMULARIO GET, SIN UNA LINEA DE JAVASCRIPT ═══
//
// Su modulo CNVResearch filtra en vivo. Aqui el formulario es un `<form method="get">`: el navegador arma
// la URL y la pantalla vuelve a rendirse en el servidor. Se pierde el "en vivo" y se gana que una cohorte
// filtrada SE PUEDA CITAR POR ENLACE, que en investigacion vale mas.
//
// Y POR ESO ESTE COMPONENTE NO ES DE CLIENTE: no tiene estado ni handlers. Los `defaultValue` vienen del
// filtro ya leido de la URL, asi que al volver de un envio los campos se ven como se dejaron.
//
// ═══ LAS OPCIONES SON LAS DE LA COHORTE ENTERA, NO LAS DE LA FILTRADA ═══
//
// Si los desplegables se construyeran con la cohorte YA filtrada, elegir "Medellin" dejaria un desplegable
// de ciudades con una sola opcion y no habria forma de cambiar de ciudad sin borrar la URL a mano. Las
// opciones salen del universo completo; lo que el filtro cambia son las CIFRAS, no las salidas.
//
// ═══ "VISTA" VIAJA EN UN CAMPO OCULTO ═══
//
// El formulario es un GET: lo que no este en un campo no sobrevive al envio. Sin esto, filtrar desde la
// pestana de Exportar devolveria al Resumen, que es la clase de cosa que se siente como un defecto aunque
// no haya nada roto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type OpcionesDelFiltro = {
  paises: string[];
  ciudades: string[];
  profesionales: { id: string; nombre: string }[];
};

const campo =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";
const rotulo = "flex flex-col gap-1 text-xs text-muted-foreground";

export function FiltrosDeLaCohorte({
  filtro,
  opciones,
  vista,
  descripcion,
}: {
  filtro: FiltroDeCohorte;
  opciones: OpcionesDelFiltro;
  vista: string;
  descripcion: string[];
}) {
  return (
    <form
      method="get"
      action="/obbia"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <input type="hidden" name="vista" value={vista} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Filtrar la cohorte</h2>
        {/* QUE HAY PUESTO, EN PALABRAS, y no solo en los campos: la frase es la misma que va al ALCANCE
            del archivo que se descarga, asi que lo que la pantalla dice y lo que el registro de la
            entrega afirma no pueden divergir. */}
        {descripcion.length > 0 ? (
          <p className="text-xs text-foreground">
            Filtrada por <strong>{descripcion.join(" · ")}</strong>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin filtros: la cohorte completa</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={rotulo}>
          País
          <select name="pais" defaultValue={filtro.pais ?? ""} className={campo}>
            <option value="">Todos</option>
            {opciones.paises.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className={rotulo}>
          Ciudad
          <select name="ciudad" defaultValue={filtro.ciudad ?? ""} className={campo}>
            <option value="">Todas</option>
            {opciones.ciudades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className={rotulo}>
          Sexo
          <select name="sexo" defaultValue={filtro.sexo ?? ""} className={campo}>
            <option value="">Ambos</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </label>

        <label className={rotulo}>
          Profesional
          <select name="profesional" defaultValue={filtro.profesional ?? ""} className={campo}>
            <option value="">Todos</option>
            {opciones.profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* LA EDAD, A LA FECHA DE LA MEDICION (es la misma regla que el consolidado y la tarjeta): una
            cohorte que envejece sola entre dos miradas no es una cohorte. */}
        <label className={rotulo}>
          Edad desde
          <input
            type="number"
            name="edadDesde"
            min={0}
            max={120}
            defaultValue={filtro.edadDesde ?? ""}
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Edad hasta
          <input
            type="number"
            name="edadHasta"
            min={0}
            max={120}
            defaultValue={filtro.edadHasta ?? ""}
            className={campo}
          />
        </label>
        <label className={rotulo}>
          Consultas desde
          <input type="date" name="desde" defaultValue={filtro.desde ?? ""} className={campo} />
        </label>
        <label className={rotulo}>
          Consultas hasta
          <input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} className={campo} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            name="conBis"
            value="1"
            defaultChecked={filtro.soloConBis}
            className="h-4 w-4 rounded border-border"
          />
          Solo con bioimpedancia
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            name="conEspectro"
            value="1"
            defaultChecked={filtro.soloConEspectro}
            className="h-4 w-4 rounded border-border"
          />
          Solo con espectro Z5-Z500
        </label>
        <div className="ml-auto flex items-center gap-3">
          {/* "QUITAR LOS FILTROS" ES UN ENLACE, no un boton que limpie los campos: limpiar campos deja la
              URL puesta, y entonces la pantalla sigue filtrada mientras el formulario dice que no. Un
              enlace a la pestana sin parametros es la unica forma que no puede mentir. */}
          <a
            href={`/obbia?vista=${vista}`}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Quitar los filtros
          </a>
          <button
            type="submit"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Aplicar
          </button>
        </div>
      </div>
      {/* Los nombres de los campos son los que lee `filtroPedido`. Si alguien renombra uno aqui y no
          alla, el filtro deja de aplicarse SIN ERROR: el candado compara las dos listas. */}
      <p className="hidden" data-campos={CAMPOS_DEL_FILTRO.join(",")} />
    </form>
  );
}
