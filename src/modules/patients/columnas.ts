import type { ColumnaLista } from "@/components/shared/fila-lista";

// ═══ POR QUE VIVE EN UN MODULO NEUTRO Y NO EN LA VISTA (2026-09-10) ═══
//
// Estaba exportada desde `lista-pacientes.tsx`, y el candado de rotulos la importaba de ahi. Al entrar la
// columna de acciones, esa vista pasó a importar el componente de botones, que importa las server actions,
// que importan `server-only`: el test dejó de poder cargarla. No era un fallo del test, era la señal de
// siempre: **un valor que comparten la vista y otro lado vive en un modulo NEUTRO**, sin "use client" ni
// `server-only`, que los dos importan sin arrastrarse nada.

// ═══ TRES COLUMNAS, NO SEIS (Santiago, 2026-09-10, opcion B del artefacto de diseño) ═══
//
// EL DOCUMENTO Y LA EDAD BAJAN BAJO EL NOMBRE, en letra pequeña (`subtitulo` de `FilaLista`). Gana el
// nombre, que es por lo que se recorre una lista y hasta aqui pesaba lo mismo que una fecha; y se
// recuperan ~15rem de pistas fijas, que es lo que le deja sitio a los botones sin desbordar.
//
// Y "ACCIONES" DEJA DE SER UNA COLUMNA. Era la causa real de que los botones cayeran a una segunda fila:
// la lista declaraba la columna (con su celda vacia en cada fila) Y ademas pintaba los botones como
// hermano, asi que habia un item de grid mas que pistas y el sobrante caia a una fila implicita, que
// empieza en la columna 1, justo debajo del nombre. Ahora la pista la reserva `conAcciones`, que es el
// mecanismo que existia para eso. El ancho nunca fue el problema: por eso fijarlo en 6rem no cambio nada.
//
// EL ORDEN NO ES ARBITRARIO: lo mas mirado primero. Quien entra a /pacientes por la mañana entra a ver
// que le falta, no a mirar fechas.
export const COLUMNAS_PACIENTES: readonly ColumnaLista[] = [
  // ═══ QUE HAY QUE HACER, Y VA PRIMERO (Santiago, 2026-09-10) ═══
  //
  // DICE LA ACCION, NO EL ESTADO, y esa es toda la diferencia: "in_progress" obliga a traducir
  // mentalmente que toca, y esa traduccion es el trabajo que la columna existe para ahorrar.
  //
  // SEIS ACCIONES DISTINTAS SALEN, pero solo UNA aplica por evaluacion: son los pasos de una secuencia,
  // asi que la columna es un puntero al escalon donde esta parada, no una lista de casillas. Lo que si
  // pasa es que un paciente tenga varias evaluaciones paradas, y para eso esta el "+N". Ver
  // `pendientes.ts`.
  //
  // SIN `desde`: es de las que NO pueden faltar (su instruccion: nombre, pendiente y acciones). Es ademas
  // lo unico de esta lista que PIDE algo, asi que ocultarla dejaria la lista sin su razon de ser.
  { rotulo: "Pendiente", ancho: "13rem", rotularEnEstrecho: true },
  // "Última" a secas era un ADJETIVO SIN SUSTANTIVO: no decia si era la ultima consulta, la ultima cita o
  // la ultima evaluacion. Y el dato es lo ultimo: la fecha de medicion de la evaluacion mas reciente,
  // filtrada por la MISMA condicion que produce la columna "Evaluaciones". Por eso NO es "Última consulta":
  // llamar consulta a lo que la columna de al lado llama evaluacion sugeriria que son dos cosas distintas,
  // y ademas no toda evaluacion es una visita (la encuesta se responde en casa).
  //
  // ESPERA A `lg`: es informacion de contexto (hace cuanto no lo veo), no una tarea. Por debajo de ese
  // ancho sigue estando en la linea concatenada del telefono y a un clic en el panel del paciente.
  { rotulo: "Última evaluación", ancho: "9rem", numerico: true, rotularEnEstrecho: true, desde: "lg" },
  // ESPERA A `xl`: es la que menos se mira de las tres, y es la que ademas tiene su propio mando (el
  // chevron del nombre despliega las ultimas evaluaciones), asi que ocultarla no deja nada sin camino.
  { rotulo: "Evaluaciones", ancho: "6rem", numerico: true, rotularEnEstrecho: true, desde: "xl" },
];
