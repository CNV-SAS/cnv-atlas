import type { ColumnaLista } from "@/components/shared/fila-lista";

// ═══ POR QUE VIVE EN UN MODULO NEUTRO Y NO EN LA VISTA (2026-09-10) ═══
//
// Estaba exportada desde `lista-pacientes.tsx`, y el candado de rotulos la importaba de ahi. Al entrar la
// columna de acciones, esa vista pasó a importar el componente de botones, que importa las server actions,
// que importan `server-only`: el test dejó de poder cargarla. No era un fallo del test, era la señal de
// siempre: **un valor que comparten la vista y otro lado vive en un modulo NEUTRO**, sin "use client" ni
// `server-only`, que los dos importan sin arrastrarse nada.

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
  // ACCIONES AL FINAL, que es donde se buscan: se recorre la fila de izquierda a derecha y lo ultimo es
  // que hacer con ella. El rotulo no se repite en estrecho (`rotularEnEstrecho` ausente): ahi los botones
  // se explican solos y un rotulo "Acciones" sobre tres iconos gasta una linea.
  // ANCHO SUFICIENTE Y FIJO. Con 8rem los dos botones cabian en el papel pero la fila los empujaba a una
  // segunda linea, debajo del nombre (reporte de Santiago): la celda cedia su ancho a las de al lado. Dos
  // botones de 36 px mas su separacion son 80 px; 6rem (96) deja margen y el `shrink-0` del contenedor de
  // acciones impide que la columna vuelva a ceder.
  { rotulo: "Acciones", ancho: "6rem" },
];

