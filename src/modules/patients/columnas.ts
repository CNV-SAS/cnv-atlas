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
/**
 * EL ANCHO DE LA COLUMNA DEL NOMBRE (Santiago, 2026-09-10: "el nombre del paciente ocupa mucho espacio y
 * el resto muy poco").
 *
 * Iba en `minmax(0,1fr)`, el valor por defecto, que se lleva TODO el sobrante. Con dos columnas eso esta
 * bien; con cinco, en una pantalla de 1300 px el nombre se quedaba con ~700 px y las cuatro restantes se
 * repartian lo que quedaba. Ahora el sobrante se reparte entre el nombre y el pendiente, que son las dos
 * que pueden usarlo (un nombre largo y una accion larga), en proporcion 1,3 a 1.
 */
export const ANCHO_NOMBRE = "minmax(0,1.3fr)";

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
  //
  // Y ABSORBE SOBRANTE junto con el nombre: sus textos son frases ("Aprobar y enviar el reporte"), no
  // cifras, asi que el ancho de mas lo usa en vez de desperdiciarlo.
  { rotulo: "Pendiente", ancho: "minmax(9rem,1fr)", rotularEnEstrecho: true },
  // ═══ FECHA DE CREACION, NO "ULTIMA EVALUACION" (Santiago, 2026-09-10) ═══
  //
  // Su razon: al desplegar la fila ya salen las fechas de las tres ultimas evaluaciones, asi que la
  // columna repetia la primera de esas tres. Y el dato que NO estaba en ningun sitio de la lista era
  // desde cuando el paciente existe en Atlas, que es lo que ordena "a quien traje este mes".
  //
  // ES DEL PACIENTE, NO DE SU EVALUACION, y por eso el rotulo no dice "de la evaluacion": la fecha en que
  // se creo la ficha. Un paciente sin ninguna evaluacion tambien la tiene, que es justo cuando mas
  // informa (la columna de al lado esta en "Iniciar la primera evaluacion" y esta dice desde cuando).
  { rotulo: "Fecha de creación", ancho: "9rem", numerico: true, rotularEnEstrecho: true, desde: "lg" },
  // ESPERA A `xl`: es la que menos se mira de las tres, y es la que ademas tiene su propio mando (pulsar
  // el nombre despliega las ultimas evaluaciones), asi que ocultarla no deja nada sin camino.
  { rotulo: "Evaluaciones", ancho: "7rem", numerico: true, rotularEnEstrecho: true, desde: "xl" },
];
