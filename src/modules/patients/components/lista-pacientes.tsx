"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { type ColumnaLista, FilaLista, ListaFilas } from "@/components/shared/fila-lista";
import { PillEstado } from "@/components/shared/pill-estado";
import { formatDateOnlyShort } from "@/lib/format/date";
import { edadEnAnios } from "../format";
import type { PatientListItem } from "../types";

// Lista de pacientes: una sola fila en dos disposiciones (columnas en ancho, dos lineas en estrecho), con
// buscador. Ver `fila-lista.tsx` para el porque de la mecanica; aqui solo se declara QUE columnas van.
//
// TODO VIVE EN UNA SOLA TARJETA BLANCA sobre el gris de la pagina: buscador, lista y conteo. Es lo que
// faltaba tras invertir la disposicion (hallazgo de Santiago, 2026-08-28): pusimos el fondo gris pero
// dejamos el contenido suelto encima, y la pagina se veia apagada en vez de organizada.
//
// Y VAN JUNTOS, no en tres bloques: el buscador y la lista son UNA cosa (un roster que se busca), y el
// conteo describe lo que la lista esta mostrando. Partirlos separaria en tres bloques blancos lo que el
// profesional usa como un solo gesto: escribir, mirar el resultado, y ver cuantos quedaron fuera.
//
// EL TITULO DE PANTALLA SE QUEDA FUERA, sobre el gris: es de la PAGINA y no de este bloque. Meterlo
// dentro haria que la tarjeta pareciera contener toda la pantalla, incluido lo que venga despues.
//
// EL FILTRO ES EN CLIENTE, y el limite queda escrito porque un dia va a importar. La pagina es un
// Server Component que trae el roster COMPLETO y lo pasa aqui; filtrar en cliente da respuesta
// instantanea mientras se teclea, sin ida y vuelta al servidor.
//
//   Hasta ~500 pacientes: bien. Cada item pesa ~200 bytes serializados, asi que 500 son ~100 KB en el
//   payload de la pagina, y filtrar 500 cadenas por tecla es imperceptible.
//   Por encima de ~1.000: hay que mover la busqueda al SERVIDOR (consulta con `ilike` y limite), porque
//   lo que se rompe primero NO es el filtro sino el PAYLOAD: se descargan todos los pacientes en cada
//   carga de la pagina, se vean o no.
//
// El dia que se cruce ese umbral, lo que cambia es de donde salen `pacientes`; esta vista no.
//
// NO LLEVA ALTURA FIJA CON SCROLL PROPIO, aunque el archivo de Gildardo si la tenga: alli la lista vive
// dentro de un panel desplegable y el scroll anidado tiene sentido. En una pagina nuestra, un area con
// scroll propio dentro del scroll de la pagina se pelean en movil (el clasico "se mueve la de adentro
// cuando querias mover la de afuera"). Y con buscador no hace falta: cuando escribes ya estas arriba.

// EL ORDEN NO ES ARBITRARIO: lo mas mirado primero, tanto en columnas como en la linea concatenada. La
// ULTIMA CONSULTA abre porque es lo que responde "a quien no veo hace meses"; el DOCUMENTO cierra porque es
// por lo que se BUSCA (y de eso ya se encarga el buscador de arriba), no lo que se lee.
// EXPORTADA para que el candado de rotulos mire ESTAS columnas y no una copia suya: un test que compara
// dos copias pasa verde aunque la de produccion este mal.
export const COLUMNAS_PACIENTES: readonly ColumnaLista[] = [
  // ═══ QUE HAY QUE HACER, Y VA PRIMERO (Santiago, 2026-09-10) ═══
  //
  // DICE LA ACCION, NO EL ESTADO, y esa es toda la diferencia: "in_progress" obliga a traducir
  // mentalmente que toca, y esa traduccion es el trabajo que la columna existe para ahorrar.
  //
  // ABRE LA FILA porque es lo unico de esta lista que pide algo. La regla de la lista es "lo mas mirado
  // primero", y quien entra a /pacientes por la mañana entra a ver que le falta, no a mirar fechas.
  //
  // SEIS ACCIONES DISTINTAS SALEN, pero solo UNA aplica por evaluacion: son los pasos de una secuencia,
  // asi que la columna es un puntero al escalon donde esta parada, no una lista de casillas. Lo que si
  // pasa es que un paciente tenga varias evaluaciones paradas, y para eso esta el "+N". Ver
  // `pendientes.ts`.
  { rotulo: "Pendiente", ancho: "13rem", rotularEnEstrecho: true },
  // "Última" a secas era un ADJETIVO SIN SUSTANTIVO: no decia si era la ultima consulta, la ultima cita o
  // la ultima evaluacion. Y el dato es lo ultimo: la fecha de medicion de la evaluacion mas reciente,
  // filtrada por la MISMA condicion que produce la columna "Evaluaciones". Por eso NO es "Última consulta":
  // llamar consulta a lo que la columna de al lado llama evaluacion sugeriria que son dos cosas distintas,
  // y ademas no toda evaluacion es una visita (la encuesta se responde en casa).
  { rotulo: "Última evaluación", ancho: "9rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Evaluaciones", ancho: "7rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Edad", ancho: "4.5rem", numerico: true, rotularEnEstrecho: true },
  // El documento ya carga su tipo delante ("CC 1.020..."), asi que en estrecho se explica solo.
  { rotulo: "Documento", ancho: "11rem", numerico: true },
];

// VEINTE POR PAGINA. La cifra no es redonda por gusto: una fila es de UNA linea en pantalla ancha, asi que
// veinte caben en una pantalla de portatil sin tener que bajar hasta perder de vista el pie, que es
// exactamente el problema que la paginacion viene a resolver (la tabla crecia hacia abajo sin fin). Con
// diez se paginaria demasiado pronto (el roster de hoy son 58 pacientes, seis paginas para nada), y con
// cincuenta la pagina vuelve a ser un scroll largo y la paginacion no cambia nada.
const POR_PAGINA = 20;

// EL NOMBRE SE ORDENA COMO SE MUESTRA (Santiago, 2026-09-09). Se ordenaba por "apellido nombre" y la fila
// pinta "nombre apellido": la lista se veia desordenada, porque ordenaba por algo que no esta a la vista.
//
// SE ARREGLA EL ORDEN Y NO LA PANTALLA. La otra salida era mostrar "Apellido, Nombre", que es lo habitual
// en un listado clinico y haria visible el orden viejo; se descarta porque cambia como se NOMBRA a cada
// paciente en una pantalla que el equipo ya lee, y a cambio de un orden que el buscador vuelve secundario
// (busca dentro del nombre completo, asi que encontrar por apellido sigue funcionando igual).
const nombreVisible = (p: PatientListItem) => `${p.firstName} ${p.lastName}`.trim();

type Orden = "alfabetico" | "reciente";

export function ListaPacientes({ pacientes }: { pacientes: PatientListItem[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("alfabetico");
  const [pagina, setPagina] = useState(1);
  // ═══ LOS ARCHIVADOS NO SALEN, SALVO QUE SE PIDAN (Santiago, 2026-09-10) ═══
  //
  // OCULTOS POR DEFECTO porque archivar existe justo para eso: si siguieran en la lista, el boton no
  // serviria de nada. Y CON FILTRO, no escondidos del todo: un paciente que desaparece sin dejar forma de
  // encontrarlo es indistinguible de uno borrado, y archivar deja de dar confianza.
  const [verArchivados, setVerArchivados] = useState(false);

  const archivados = useMemo(
    () => pacientes.filter((p) => p.status === "inactive").length,
    [pacientes],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // EL ARCHIVO SE APLICA ANTES QUE LA BUSQUEDA: buscar un archivado con el filtro apagado no lo saca,
    // que es lo coherente con "no salen salvo que se pidan". Encenderlo es un clic.
    const activos = verArchivados
      ? pacientes
      : pacientes.filter((p) => p.status !== "inactive");
    const base =
      q === ""
        ? activos
        : // Por NOMBRE o por DOCUMENTO, que son las dos formas en que un profesional busca a alguien: se
          // acuerda del nombre, o tiene la cedula delante.
          activos.filter((p) => {
            const nombre = nombreVisible(p).toLowerCase();
            return nombre.includes(q) || p.documentNumber.toLowerCase().includes(q);
          });
    // SIN MUTAR: `sort` ordena en sitio, y `pacientes` es la prop. Ordenarla ahi cambiaria el arreglo del
    // padre y el orden dependeria de cuantas veces se ha renderizado.
    const orden_ = [...base];
    if (orden === "alfabetico") {
      orden_.sort((a, b) => nombreVisible(a).localeCompare(nombreVisible(b), "es"));
    } else {
      // MAS RECIENTE PRIMERO, y los que no tienen ninguna evaluacion AL FINAL: un paciente sin medir no es
      // "el mas antiguo", es otra cosa, y colarlo entre las fechas haria leer una antiguedad que no existe.
      orden_.sort((a, b) => {
        if (a.lastEvaluationDate === b.lastEvaluationDate) {
          return nombreVisible(a).localeCompare(nombreVisible(b), "es");
        }
        if (!a.lastEvaluationDate) return 1;
        if (!b.lastEvaluationDate) return -1;
        return b.lastEvaluationDate.localeCompare(a.lastEvaluationDate);
      });
    }
    return orden_;
  }, [pacientes, busqueda, orden, verArchivados]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));

  // AL BUSCAR O REORDENAR SE VUELVE A LA PRIMERA. Sin esto, escribir en el buscador estando en la pagina 3
  // deja una pagina vacia y parece que la busqueda no encontro nada.
  //
  // SE AJUSTA DURANTE EL RENDER, NO EN UN EFECTO. Con `useEffect` el reseteo ocurre DESPUES de pintar, asi
  // que hay un fotograma con la pagina vieja sobre la lista nueva; y ademas `react-hooks/set-state-in-effect`
  // lo prohibe, con razon. Este es el patron documentado de React para ajustar estado cuando cambia lo que
  // lo condiciona: se compara contra lo ultimo visto y se corrige antes de pintar.
  const claveVista = `${busqueda.trim()}|${orden}|${verArchivados}`;
  const [claveAnterior, setClaveAnterior] = useState(claveVista);
  if (claveAnterior !== claveVista) {
    setClaveAnterior(claveVista);
    setPagina(1);
  }
  // Y SE ACOTA ADEMAS AL PINTAR: si la lista se acorta por otra via (menos pacientes del servidor), la
  // pagina guardada puede quedar fuera de rango sin que la clave cambie.
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // BUSCADOR SIN ROTULO VISIBLE: el placeholder ya dice que hace, asi que el rotulo encima repetia lo
  // mismo y gastaba una linea. Pero el nombre accesible NO desaparece: va en `aria-label`, porque un campo
  // sin nombre solo se anuncia como "cuadro de busqueda" y el placeholder no lo sustituye (se borra al
  // escribir y algunos lectores no lo leen).
  const buscador = (
    // ANCHO SUFICIENTE PARA SU PROPIO PLACEHOLDER (Santiago, 2026-09-09). Estaba en `sm:max-w-md` (28rem)
    // y el texto "Buscar por nombre o número de documento" no cabia entero, asi que el campo anunciaba a
    // medias lo que hace, que es peor que no anunciarlo. Con 24rem de minimo y 34rem de tope cabe completo
    // y sigue sin comerse la fila del conmutador. `flex-1` para que ceda el sobrante en pantallas medias.
    <div className="relative w-full min-w-0 flex-1 sm:min-w-[24rem] sm:max-w-[34rem]">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id="buscar-paciente"
        type="search"
        aria-label="Buscar paciente por nombre o número de documento"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o número de documento"
        className="w-full rounded-full border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* EL BUSCADOR VA FUERA DE LA TARJETA (prueba pedida por Santiago, 2026-08-28). Mi lectura al verlo
          va en el reporte: el argumento para meterlo dentro sigue siendo que buscar y mirar el resultado
          es un solo gesto, pero fuera gana aire y la tarjeta empieza directamente por los datos. */}
      {/* BUSCADOR Y ORDEN EN LA MISMA FILA: son los dos mandos de la lista, y separarlos en dos lineas los
          haria parecer dos cosas distintas. En estrecho se apilan. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {buscador}
        {/* DOS BOTONES Y NO UN DESPLEGABLE: son dos opciones, y un desplegable de dos obliga a abrirlo
            para ver que hay dentro. Asi las dos estan a la vista y el estado se lee sin tocar nada.
            `aria-pressed` y no `role="radiogroup"`: son dos conmutadores de vista, no un formulario. */}
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-input p-0.5">
          {(
            [
              ["alfabetico", "A-Z"],
              ["reciente", "Evaluación reciente"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={orden === id}
              onClick={() => setOrden(id)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (orden === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {rotulo}
            </button>
          ))}
        </div>

        {/* EL FILTRO DE ARCHIVADOS, solo cuando hay alguno: un interruptor que siempre vale cero es un
            mando que no hace nada, y ademas insinua que hay algo escondido cuando no lo hay. */}
        {archivados > 0 ? (
          <button
            type="button"
            aria-pressed={verArchivados}
            onClick={() => setVerArchivados((v) => !v)}
            className={
              "rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors " +
              (verArchivados
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {verArchivados ? "Ocultar archivados" : `Ver archivados (${archivados})`}
          </button>
        ) : null}
      </div>
      <ListaFilas
      columnas={COLUMNAS_PACIENTES}
      // EL PIE SOLO CUANDO HAY FILTRO. Sin filtro repetia la tarjeta de metrica de arriba, que ya dice
      // cuantos pacientes hay; dos sitios con la misma cifra no informan mas, solo hacen dudar de si son
      // lo mismo. Pero con el buscador activo NO es la misma cifra: dice cuantos quedaron FUERA de la
      // vista, que es justo lo que la tarjeta no puede decir. Se quita donde repite y se queda donde avisa.
      // EL PIE AHORA TAMBIEN CUENTA CUANDO HAY VARIAS PAGINAS. La razon de que solo saliera con el
      // buscador sigue en pie (sin filtro repetia la tarjeta de metrica de arriba), pero con paginacion
      // deja de repetirla: ya no dice cuantos hay, dice cuales se estan viendo, que la tarjeta no sabe.
      pie={
        busqueda.trim()
          ? `${filtrados.length} de ${pacientes.length} pacientes`
          : totalPaginas > 1
            ? `${(paginaActual - 1) * POR_PAGINA + 1}-${Math.min(paginaActual * POR_PAGINA, filtrados.length)} de ${filtrados.length} pacientes`
            : null
      }
      // DOS VACIOS DISTINTOS: "no encontré lo que buscas" y "no tienes pacientes" son situaciones
      // opuestas, y decirle "no hay pacientes" a quien acaba de escribir mal un apellido lo manda a buscar
      // un problema que no existe. Va DENTRO de la tarjeta, con el buscador todavia visible para corregir.
      vacia={
        filtrados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {busqueda.trim()
              ? `Ningún paciente coincide con "${busqueda.trim()}".`
              : "Todavía no tienes pacientes asignados."}
          </p>
        ) : null
      }
    >
      {visibles.map((p) => {
        const anos = edadEnAnios(p.birthDate);
        // Un valor por columna, en el mismo orden. `null` deja la celda VACIA en columnas (para no correr
        // las de al lado) y se omite en la linea concatenada, donde un hueco no dice nada.
        // "+N" SOLO CUANDO LO HAY. Un "+0" es ruido, y un pendiente sin numero se lee mejor.
        const pend = p.pendiente.principal;
        const valores = [
          pend ? `${pend.texto}${p.pendiente.otras > 0 ? ` +${p.pendiente.otras}` : ""}` : null,
          p.lastEvaluationDate ? formatDateOnlyShort(p.lastEvaluationDate) : null,
          String(p.evaluationCount),
          anos !== null ? String(anos) : null,
          `${p.documentType} ${p.documentNumber}`.trim() || null,
        ];

        return (
          <FilaLista
            key={p.patientId}
            href={`/pacientes/${p.patientId}`}
            // UNA SOLA FUENTE del nombre visible: la fila lo PINTA y los dos ordenes lo COMPARAN.
            // Escrito dos veces es como se consigue que ordenar y mostrar se separen otra vez.
            titulo={nombreVisible(p) || "Sin nombre"}
            columnas={COLUMNAS_PACIENTES}
            valores={valores}
            // CHIP SOLO SI ES EXCEPCIONAL (BRAND): lo normal no lleva distintivo; gastar ancho en lo que
            // casi siempre es igual es lo contrario de una lista escaneable.
            //
            // EL CHIP LEE LA AUTORIZACION, no `patients.status`. `status` no tiene escritor (nadie pone
            // nunca "inactive"), asi que el chip no aparecia jamas. La falta de autorizacion vigente si
            // tiene consecuencia real y hoy se descubre AL INTENTAR crear la evaluacion.
            //
            // Y NO ES ROJO CLINICO a proposito: `clinical-critical` significa riesgo del PACIENTE, y un
            // paciente que ejercio su derecho no esta en riesgo. El texto habla de la AUTORIZACION, no de
            // la persona: "Revocado" sonaria a que el revocado es el paciente.
            chip={
              // ARCHIVADO MANDA SOBRE EL OTRO CHIP: si esta fuera de la lista de trabajo, eso es lo
              // primero que hay que saber de la fila; que ademas le falte una autorizacion es
              // informacion de segundo orden mientras este archivado.
              p.status === "inactive" ? (
                <PillEstado tono="neutro" title="Archivado: no aparece en la lista por defecto.">
                  Archivado
                </PillEstado>
              ) : p.sinAutorizacionVigente ? (
                <PillEstado
                  tono="atencion"
                  title="Le falta alguna autorización necesaria vigente. No se le pueden crear evaluaciones nuevas."
                >
                  Sin autorización vigente
                </PillEstado>
              ) : null
            }
          />
        );
      })}
      </ListaFilas>
      {/* PAGINACION AL PIE (Santiago, 2026-09-09): la tabla crecia hacia abajo sin fin y el pie quedaba a
          varias pantallas de distancia.

          SOLO CUANDO HAY MAS DE UNA PAGINA. Un paginador con "Página 1 de 1" y las dos flechas apagadas es
          un mando que no hace nada: ocupa sitio y hace dudar de si falta algo.

          LAS FLECHAS SE DESHABILITAN EN LOS EXTREMOS en vez de desaparecer: un control que se va cambia la
          posicion del otro, y se acaba pulsando el que no era. */}
      {totalPaginas > 1 ? (
        <nav
          aria-label="Paginación de la lista de pacientes"
          className="flex items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={() => setPagina(paginaActual - 1)}
            disabled={paginaActual === 1}
            aria-label="Página anterior"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </button>
          {/* `aria-live` para que el lector de pantalla anuncie el cambio de pagina: al pulsar la flecha el
              foco se queda en el boton y sin esto nada dice que la lista cambio. */}
          <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
            aria-label="Página siguiente"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
