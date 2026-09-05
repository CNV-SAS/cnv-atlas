// HISTORIA CLINICA de la consulta (bloques 1 a 3 de catorce). Modulo NEUTRO: presentacional puro, lo
// renderiza la page server. Porte de la HC del v8 (capturas 2026-08-24), con las divergencias anotadas
// donde ocurren.

import type { HcAntecedenteResuelto } from "../data/hc-antecedentes-map";

// Encabezado de seccion: mayusculas espaciadas, como en su HC.
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">{children}</section>
  );
}

// Celda etiqueta/valor. El valor en negrita, como en su HC.
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2.5">
      <span className="text-[11px] text-muted-foreground">{etiqueta}</span>
      <span className="text-sm font-semibold text-foreground">{valor}</span>
    </div>
  );
}

export type HcDatosPaciente = {
  paciente: string;
  edad: number | null;
  sexo: string | null;
  pesoKg: number | null;
  tallaCm: number | null;
  fecha: string;
  profesional: string;
  ocupacion: string | null;
};

const SIN_DATO = "No se registró";

export function HcDatosDelPaciente({ datos }: { datos: HcDatosPaciente }) {
  const edadSexo = [
    datos.edad != null ? `${datos.edad}a` : null,
    datos.sexo === "F" ? "Femenino" : datos.sexo === "M" ? "Masculino" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pesoTalla = [
    datos.pesoKg != null ? `${datos.pesoKg} kg` : null,
    datos.tallaCm != null ? `${datos.tallaCm} cm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tarjeta>
      <TituloSeccion>Datos del paciente</TituloSeccion>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Paciente" valor={datos.paciente || SIN_DATO} />
        <Dato etiqueta="Edad / Sexo" valor={edadSexo || SIN_DATO} />
        <Dato etiqueta="Peso / Talla" valor={pesoTalla || SIN_DATO} />
        <Dato etiqueta="Fecha" valor={datos.fecha} />
        <Dato etiqueta="Profesional" valor={datos.profesional || SIN_DATO} />
        <Dato etiqueta="Ocupación" valor={datos.ocupacion || SIN_DATO} />
      </div>
    </Tarjeta>
  );
}

export function HcMotivoDeConsulta({ motivos }: { motivos: string[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Motivo de consulta</TituloSeccion>
      {motivos.length > 0 ? (
        // DIVERGENCIA deliberada: su HTML concatena las opciones SIN separador ("Control de
        // pesoRendimiento deportivo"). Se unen con coma; es un defecto de su prototipo, no un formato.
        <p className="text-sm text-foreground">{motivos.join(", ")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{SIN_DATO}</p>
      )}
    </Tarjeta>
  );
}

// Aviso de PROCEDENCIA. No es un error del sistema y no debe leerse como tal: es informacion sobre de
// donde viene el dato. Por eso va en tono neutro (borde y fondo de la superficie, no ambar ni rojo) y
// dice las dos mitades: el paciente lo declaro, y el diagnostico no lo uso.
function AvisoProcedencia() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Los datos marcados con <ProcedenciaMarca /> los declaró el paciente en la encuesta y están
      registrados, pero el diagnóstico no los tuvo en cuenta: hoy no alimentan el motor clínico. Tenlos
      presentes al prescribir.
    </p>
  );
}

function ProcedenciaMarca() {
  return (
    <span className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
      solo registro
    </span>
  );
}

export function HcAntecedentes({
  grupos,
}: {
  grupos: { titulo: string; filas: HcAntecedenteResuelto[] }[];
}) {
  const hayMarcados = grupos.some((g) => g.filas.some((f) => f.declaradoNoConsumido && !f.ausente));
  return (
    <Tarjeta>
      <TituloSeccion>Antecedentes personales</TituloSeccion>
      {grupos.map((g) => {
        // Una fila AUSENTE (la pregunta no existe en esta version de la encuesta) no se pinta: pintarla
        // vacia diria "no se registró" de algo que nunca se preguntó. Un grupo que queda sin filas
        // desaparece entero.
        // AUSENTE: la pregunta no existe en esta version. SOLO-NINGUNA: su guarda (una seccion que solo
        // diria "Ninguna" no se pinta). Un grupo que se queda sin filas desaparece entero.
        const filas = g.filas.filter((f) => !f.ausente && !f.soloNinguna);
        if (filas.length === 0) return null;
        return (
          <div key={g.titulo} className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {g.titulo}
            </span>
            {filas.map((f) =>
              f.comoLista ? (
                <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                  {f.valores.length > 0 ? (
                    f.valores.map((v) => (
                      <span
                        key={v}
                        className="rounded border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground"
                      >
                        {v}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">{SIN_DATO}</span>
                  )}
                  {f.declaradoNoConsumido ? <ProcedenciaMarca /> : null}
                </div>
              ) : (
                <div key={f.id} className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {f.etiqueta}
                    {f.declaradoNoConsumido ? <ProcedenciaMarca /> : null}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {f.valores.length > 0 ? f.valores.join(", ") : SIN_DATO}
                  </span>
                </div>
              ),
            )}
          </div>
        );
      })}
      {hayMarcados ? <AvisoProcedencia /> : null}
    </Tarjeta>
  );
}

// Bloques 5 a 7: los tres parrafos del diagnostico. NO se recalculan aqui: los deriva la pagina del
// snapshot sellado (dfiNarrativeFromOutput) y del parrafo de dieta, que es lo mismo que ve el
// Diagnostico. La HC los REUNE, no los vuelve a producir.
//
// Cuando no se pueden emitir (snapshot anterior al porte, o encuesta incompleta), se muestra el MOTIVO en
// vez de un vacio mudo: la seccion aparece con su titulo y dice por que esta vacia. Omitirla haria que el
// documento pareciera completo cuando le falta algo.
function Parrafo({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  if (texto && texto.trim() !== "") {
    return <p className="text-sm leading-relaxed text-foreground">{texto}</p>;
  }
  return <p className="text-sm italic text-muted-foreground">{motivo ?? "No se registró"}</p>;
}

export function HcResumenDiagnostico({
  profesionLabel,
  texto,
  motivo,
}: {
  profesionLabel: string;
  texto: string | null;
  motivo: string | null;
}) {
  return (
    <Tarjeta>
      {/* La PROFESION va en el titulo, como en su HC: el resumen es del profesional que atiende, no uno
          solo. Sale del dato que ya tenemos, nunca cableado. */}
      <TituloSeccion>Resumen diagnóstico · {profesionLabel}</TituloSeccion>
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <Parrafo texto={texto} motivo={motivo} />
      </div>
    </Tarjeta>
  );
}

export function HcDiagnosticoFuncional({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Diagnóstico funcional integrado (DFI)</TituloSeccion>
      <Parrafo texto={texto} motivo={motivo} />
    </Tarjeta>
  );
}

export function HcMetaTerapeutica({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Meta terapéutica</TituloSeccion>
      <Parrafo texto={texto} motivo={motivo} />
    </Tarjeta>
  );
}

// Bloques 8, 9, 13 y 14. Los cuatro salen de datos ya sellados o ya leidos; ninguno recalcula.

export function HcObjetivoTratamiento({ texto }: { texto: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Objetivo del tratamiento</TituloSeccion>
      {texto && texto.trim() !== "" ? (
        <p className="text-base font-semibold text-primary">{texto}</p>
      ) : (
        // "No se registró" y no "no aplica": el objetivo SIEMPRE deberia estar en una consulta con
        // prescripcion; si falta, falta de verdad.
        <p className="text-sm text-muted-foreground">{SIN_DATO}</p>
      )}
    </Tarjeta>
  );
}

export type HcRuta = { id: string; label: string; activacion: string; prioritaria?: boolean };

export function HcRutasActivadas({ rutas }: { rutas: HcRuta[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Rutas de intervención activadas</TituloSeccion>
      {rutas.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rutas.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/40 p-3">
              <span className="text-sm font-semibold text-primary">
                {r.id} — {r.label}
              </span>
              <p className="text-xs text-muted-foreground">Indicador: {r.activacion}</p>
            </div>
          ))}
        </div>
      ) : (
        // Aqui SI es "no aplica": ninguna ruta activada es un resultado clinico valido, no un hueco.
        <p className="text-sm text-muted-foreground">
          No se activó ninguna ruta de intervención en esta evaluación.
        </p>
      )}
    </Tarjeta>
  );
}

// OBSERVACIONES DEL PROFESIONAL, por instruccion suya (§8.3, 2026-08-26 Parte 2): "Deben aparecer en la
// historia. Y POR CONSULTA, NO POR PACIENTE".
//
// Lo que el diagnostico en su archivo: "notas_profesional aparece UNA SOLA VEZ en todo el archivo,
// ESCRIBIENDO. Nadie la lee, y con onConflict: 'documento' cada control borra el anterior. Lo que el
// profesional escribe hoy se pierde DOS VECES: se sobrescribe y no se muestra".
//
// EN ATLAS SOLO PASABA LA MITAD, y esa mitad estaba viva: las notas SI se guardan bien (tabla propia por
// tratamiento, append-only, con auditoria; no se sobrescriben), pero NO SE MOSTRABAN en ninguna parte
// fuera del panel de tratamiento. O sea que no se perdian, pero tampoco llegaban al documento que es
// probatorio. La otra mitad de su defecto, la del onConflict, nunca la tuvimos.
//
// POR CONSULTA se cumple por construccion: cuelgan del tratamiento de ESTA evaluacion, no del paciente.
export type HcObservacion = { id: string; note: string; fecha: string };

export function HcObservaciones({ observaciones }: { observaciones: HcObservacion[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Observaciones del profesional</TituloSeccion>
      {observaciones.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {observaciones.map((o) => (
            <li key={o.id} className="border-l-2 border-border pl-3">
              <p className="whitespace-pre-line text-sm text-foreground">{o.note}</p>
              <p className="pt-1 text-xs text-muted-foreground">{o.fecha}</p>
            </li>
          ))}
        </ul>
      ) : (
        // No dice "sin observaciones" a secas: en un documento probatorio, un bloque vacio sin explicar
        // deja la duda de si el profesional no escribio nada o si el sistema no lo trajo.
        <p className="text-sm text-muted-foreground">
          El profesional no registró observaciones en esta consulta.
        </p>
      )}
    </Tarjeta>
  );
}

export function HcProximaConsulta({ fecha }: { fecha: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Próxima consulta</TituloSeccion>
      {fecha ? (
        <p className="text-xl font-bold tabular-nums text-primary">{fecha}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin fecha registrada</p>
      )}
    </Tarjeta>
  );
}

export function HcFirmaYFecha({ profesional, fecha }: { profesional: string; fecha: string }) {
  return (
    <Tarjeta>
      <TituloSeccion>Firma y fecha</TituloSeccion>
      {/* Linea EN BLANCO para firmar en papel, como en su HC: no es firma grafica ni acto de firma con
          marca de tiempo, es el pie de un documento que se imprime. */}
      <div className="h-8 border-b border-border" />
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{profesional || "Profesional de salud"}</span>
        {/* DIVERGENCIA deliberada: su archivo usa la fecha de IMPRESION (new Date()). Una historia clinica
            impresa tres meses despues quedaria fechada tres meses tarde, junto a datos de otra consulta.
            Aqui va la fecha de la EVALUACION. */}
        <span className="text-xs text-muted-foreground">{fecha}</span>
      </div>
    </Tarjeta>
  );
}

// Bloque 10: PLAN NUTRICIONAL. Las ocho celdas de su HC. Siete salen del protocolo sellado; el SODIO no.
export type HcPlanNutricional = {
  /** Limite de sodio del motor de prescripcion. null = el paciente no tiene condicion que lo pida. */
  sodioMax?: number | null;
  geb: number | null;
  get: number | null;
  kcalObjetivo: number | null;
  proteinaG: number | null;
  proteinaGKg: number | null;
  carbohidratosG: number | null;
  grasasG: number | null;
  /** El % que FIJA el profesional; los gramos son su consecuencia. Ver `hc-composicion`. */
  grasasPct: number | null;
  actividadFisica: string | null;
};

export function HcPlanNutricional({
  plan,
  desviaciones = [],
}: {
  plan: HcPlanNutricional | null;
  /**
   * Cifras prescritas fuera de lo que sugiere el diagnostico (P-109). Vacio = no hubo, o no se pudo
   * comparar. Por defecto vacio para que un llamador que no las pase no rompa, pero el candado del
   * SITIO DE LLAMADA verifica que los dos documentos las pasen: el defecto aqui seria la omision.
   */
  desviaciones?: { macro: string; cifra: string; texto: string }[];
}) {
  if (!plan) {
    return (
      <Tarjeta>
        <TituloSeccion>Tratamiento · plan nutricional</TituloSeccion>
        <p className="text-sm text-muted-foreground">
          Esta evaluación todavía no tiene una prescripción nutricional.
        </p>
      </Tarjeta>
    );
  }
  const n = (v: number | null, u: string) => (v == null ? SIN_DATO : `${Math.round(v)} ${u}`);
  return (
    <Tarjeta>
      <TituloSeccion>Tratamiento · plan nutricional</TituloSeccion>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="GEB (Mifflin)" valor={n(plan.geb, "kcal")} />
        <Dato etiqueta="GET" valor={n(plan.get, "kcal")} />
        <Dato etiqueta="Objetivo" valor={plan.kcalObjetivo == null ? SIN_DATO : `${Math.round(plan.kcalObjetivo)} kcal/día`} />
        <Dato
          etiqueta="Proteínas"
          valor={
            plan.proteinaG == null
              ? SIN_DATO
              : `${Math.round(plan.proteinaG)} g/día${plan.proteinaGKg != null ? ` (${plan.proteinaGKg} g/kg)` : ""}`
          }
        />
        <Dato etiqueta="Carbohidratos" valor={plan.carbohidratosG == null ? SIN_DATO : `${Math.round(plan.carbohidratosG)} g/día`} />
        {/* Los gramos Y el porcentaje: el % es la decision y los gramos su consecuencia. */}
        <Dato
          etiqueta="Grasas"
          valor={
            plan.grasasG == null
              ? SIN_DATO
              : `${Math.round(plan.grasasG)} g/día${plan.grasasPct == null ? "" : ` (${plan.grasasPct} %)`}`
          }
        />
        {/* SODIO: YA SE CALCULA. Estuvo en "Pendiente" con un texto que decia "se emitira cuando se
            incorpore el motor de prescripcion nutricional", cierto cuando se escribio y falso desde el
            2026-08-31, cuando ese motor se conecto. Nadie volvio a esta linea: la misma forma que el
            congelamiento vencido de P-50, y la razon por la que un texto que AFIRMA UN ESTADO tiene que
            derivarlo y no declararlo.
            Sin valor sale el guion de "no aplica", como el resto: el motor solo prescribe limite de sodio
            cuando hay condicion que lo pida (HTA, ERC, alteracion hidrica). */}
        <Dato
          etiqueta="Sodio"
          valor={plan.sodioMax == null ? SIN_DATO : `< ${plan.sodioMax.toLocaleString("es-CO")} mg/día`}
        />
        <Dato etiqueta="Actividad física" valor={plan.actividadFisica ?? SIN_DATO} />
      </div>
      {/* CONSTANCIA DE LAS CIFRAS FUERA DE LA REFERENCIA (P-109, porte de su bloque de la HC).
          Su punto 3 del 3-sep: "lo que se escriba fuera del rango queda en la historia clínica con el
          rango, la condición y la razón. No bloquea y no alarma: deja constancia de que fue una decisión."

          POR ESO VA EN `attention` Y NO EN LA CAPA CLINICA: el eje aquí es OPERATIVO, no un veredicto
          sobre el paciente. Pintarlo de rojo clínico diría que la prescripción está mal, y no lo está:
          la cifra la decide el profesional y esto solo registra que la decidió apartándose de lo
          sugerido. Es el mismo criterio del panel de asesoría y del aviso de ciencia anterior. */}
      {desviaciones.length > 0 ? (
        <div className="mt-3 rounded-lg border border-attention bg-attention-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-attention">
            Decisión del profesional: cifras fuera de la referencia
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {desviaciones.map((d) => (
              <li key={d.macro} className="text-xs text-foreground">
                <span className="font-medium">
                  {d.macro} {d.cifra}:
                </span>{" "}
                {d.texto}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Tarjeta>
  );
}

// Bloque 11: RECOMENDACIONES. Bloques condicionales por diagnostico; el que todavia no se puede emitir
// aparece CON SU TITULO diciendo que espera. La seccion existe y se ve que le falta algo, en vez de
// parecer completa.
//
// EL MOTIVO SE CORRIGIO (barrido del 2026-09-01, segundo hallazgo de la misma forma en tres dias): decia
// "se emite con el motor de prescripcion nutricional", y ese motor lleva conectado desde el 31. Al
// arreglarlo la primera vez se corrigio el COMENTARIO del codigo y no el TEXTO DE PANTALLA, que es el que
// alguien lee. Lo que de verdad espera es cual formula de gasto manda (P-32/P-35): su bloque imprime un
// objetivo calorico, y los dos motores calculan uno distinto.
export type HcRecomendacion = { titulo: string; items: string[]; pendiente?: boolean };

export function HcRecomendaciones({ bloques }: { bloques: HcRecomendacion[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Recomendaciones</TituloSeccion>
      {bloques.map((b) => (
        <div key={b.titulo} className="flex flex-col gap-1">
          <span className="text-sm font-bold text-primary">{b.titulo}</span>
          {b.pendiente ? (
            <span className="text-xs italic text-muted-foreground">
              Pendiente: este bloque cita un objetivo calórico, y los dos motores calculan uno distinto.
              Se emite cuando la Dirección Científica defina cuál manda.
            </span>
          ) : (
            <ul className="ml-4 list-disc text-sm text-foreground">
              {b.items.map((i) => (
                <li key={i} className="leading-relaxed">
                  {i}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Tarjeta>
  );
}

// Bloque 12: REMISIONES Y DERIVACIONES. Las de ESTA consulta. Los examenes solicitados NO son seccion
// aparte: viajan dentro del texto de la remision ("Estudios sugeridos: ..."), como en su HC.
export type HcRemision = {
  id: string;
  destino: string;
  motivo: string;
  fecha: string;
  retorno: string | null;
};

export function HcRemisiones({ remisiones }: { remisiones: HcRemision[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Remisiones y derivaciones</TituloSeccion>
      {remisiones.length > 0 ? (
        <div className="flex flex-col gap-2">
          {remisiones.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{r.destino}</span>
                <span className="text-xs text-muted-foreground">
                  {r.retorno ? `Regresó el ${r.retorno}` : "Sin retorno registrado"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{r.motivo}</p>
              <span className="text-xs text-muted-foreground">Remitido el {r.fecha}</span>
            </div>
          ))}
        </div>
      ) : (
        // "No aplica", no "no se registró": no remitir es una decisión clínica válida y frecuente.
        <p className="text-sm text-muted-foreground">
          No se registraron remisiones ni derivaciones en esta consulta.
        </p>
      )}
    </Tarjeta>
  );
}

// Bloque ANI BIS-E de la tabla de la historia clinica (porte 2026-08-24). Su HC los pone DENTRO de la
// tabla de Wang, como un nivel mas; en Atlas viven en la tabla de indices del Diagnostico, que es una
// tabla aparte. Portarlos al mapa de composicion los DUPLICARIA en Diagnostico, asi que se anaden solo
// aqui: en el documento clinico van juntos, en la pantalla de trabajo siguen separados.
//
// Se aplican los MISMOS dos filtros que el resto de la tabla: solo lo alterado (sev >= 1) y nada sin valor.
export type HcIndiceAni = {
  codigo: string;
  nombre: string | null;
  referencia: string;
  valor: string;
  clasificacion: string;
  sev: number;
};

export function HcIndicesAniBise({ indices }: { indices: HcIndiceAni[] }) {
  if (indices.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-border bg-muted">
            <td
              colSpan={4}
              className="py-2 text-xs font-semibold uppercase tracking-wider text-foreground"
            >
              ANI BIS-E
            </td>
          </tr>
        </thead>
        <tbody>
          {indices.map((i) => (
            <tr key={i.codigo} className="border-b border-border/40">
              {/* Nombre arriba y sigla debajo, en la MISMA celda: otro profesional lee el nombre, y la
                  columna no se ensancha (que era el riesgo de ponerlos en linea). Cuando su archivo no le
                  da nombre al indice, va la sigla sola: no se inventa uno para un documento clinico. */}
              <td className="py-1.5 pr-4">
                {i.nombre ? (
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">{i.nombre}</span>
                    <span className="text-[11px] text-muted-foreground">{i.codigo}</span>
                  </span>
                ) : (
                  <span className="font-medium text-foreground">{i.codigo}</span>
                )}
              </td>
              <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">{i.valor}</td>
              <td className="py-1.5 pr-4 text-right text-muted-foreground">{i.referencia}</td>
              <td className="py-1.5">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                  {i.clasificacion}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
