import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";
import { QUE_HACE } from "@/modules/dashboard/que-hace";
import { NAV_ITEMS } from "@/components/layout/nav-config";

// ═══ LA FILA DESPLIEGA EN VEZ DE NAVEGAR, Y LA COLUMNA DE ACCIONES (Santiago, 2026-09-10) ═══
//
// SU RAZON: pulsar una fila para ir a la ficha y desde ahi entrar a una evaluacion son dos saltos para
// llegar a lo que se buscaba. Con las ultimas tres a la vista, el camino habitual es UNO. Y la ficha no se
// pierde: pasa a ser un boton de la columna de acciones.

const FILA = readFileSync("src/components/shared/fila-lista.tsx", "utf8");
const LISTA = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
const ACCIONES = readFileSync("src/modules/patients/components/acciones-paciente.tsx", "utf8");
const READER = readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8");

describe("desplegar no cuesta una consulta", () => {
  it("las evaluaciones vienen en el MISMO embed que ya se hacía", () => {
    // Era lo que había que verificar antes de construirlo: el lector ya embebía las evaluaciones (para
    // contarlas y para la columna de pendientes), y solo les faltaban el id y el tipo. Si hubiera que
    // pedirlas al desplegar, esto sería otra cosa: una llamada por fila sobre 73 pacientes.
    expect(READER).toContain("evaluations(id, type, superseded_at");
  });

  it("y el rótulo del seguimiento se numera donde están todas juntas, no en la vista", () => {
    // "Seguimiento 2" depende del ORDEN entre las evaluaciones del paciente. Calcularlo fila por fila en
    // la vista daría el número de la fila, no el del seguimiento.
    expect(READER).toContain("`Seguimiento ${++n}`");
    expect(LISTA, "la vista empezó a numerar los seguimientos").not.toContain("Seguimiento ${");
  });

  it("son las TRES últimas, de la más reciente a la más antigua", () => {
    // Es el orden en que se buscan: quien despliega viene a por la última.
    expect(READER).toContain(".slice(-3).reverse()");
  });
});

describe("lo que la fila HACE cambia lo que la fila ES", () => {
  it("DESPLEGAR ES UN MANDO PROPIO, no lo que hace la fila", () => {
    // ═══ SEGUNDA VUELTA (Santiago, 2026-09-10) ═══
    //
    // La primera version hacia que la fila ENTERA desplegara, y su reporte la condeno: "si no ponemos el
    // cursor activo sobre la fila, pareciera que no tiene funcion". Sin cursor ni marca, una fila que
    // despliega no se distingue de una que no hace nada, y eso se descubre pulsando.
    //
    // Ahora la fila LLEVA A SU SITIO (que es lo que una fila de lista hace) y desplegar tiene su chevron
    // delante del nombre, que es donde vive ese mando en cualquier lista: se VE que la fila se abre antes
    // de leerla.
    expect(FILA).toContain("aria-expanded={desplegado}");
    expect(FILA).toContain("onClick={alDesplegar}");
    expect(FILA).toContain("rotate-90");
  });

  it("el mando de desplegar se anuncia con el nombre del paciente", () => {
    // ═══ RE-ANCLADO EN LA TERCERA VUELTA (Santiago, 2026-09-10) ═══
    //
    // ANTES el mando era un chevron suelto con `aria-label="Ver las evaluaciones de X"`, porque veinte
    // chevrones identicos se anuncian todos igual y hacia falta el nombre para distinguirlos.
    //
    // AHORA el mando ENVUELVE al nombre ("que el item de la columna paciente tambien me despliegue"), asi
    // que el nombre ES el nombre accesible del boton: no hace falta un `aria-label` que lo repita, y
    // ponerlo seria peor (un `aria-label` PISA el contenido, asi que habria que mantener dos copias del
    // nombre y una acabaria diciendo otra cosa).
    //
    // LO QUE HACE FALTA QUE SIGA: que sea un BOTON (no un div pulsable) y que diga si esta abierto.
    // Con eso un lector anuncia "María Restrepo, botón, contraído", que es el patron estandar.
    expect(FILA).toContain("aria-expanded={desplegado}");
    expect(FILA).toContain("{titulo}");
    // Y sin `aria-label` en ese boton, que taparia el nombre.
    const boton = FILA.slice(FILA.indexOf("onClick={alDesplegar}"), FILA.indexOf("{chip}"));
    expect(boton).not.toContain("aria-label");
  });

  it("el panel va FUERA del <li> de la fila", () => {
    // Dentro sería una celda más del grid de columnas, y además quedaría bajo el área pulsable estirada,
    // así que sus enlaces no se podrían pulsar.
    const i = FILA.indexOf("</li>");
    expect(FILA.slice(i), "el panel se metió dentro de la fila").toContain("desplegado && panel");
  });

  it("una sola fila abierta a la vez", () => {
    // Con varias abiertas la lista deja de poder recorrerse, que es para lo que existe.
    expect(LISTA).toContain("const [abierta, setAbierta] = useState<string | null>(null);");
    expect(LISTA).toContain("a === p.patientId ? null : p.patientId");
  });

  it("y el enlace de cada evaluación abre la pestaña de encuesta", () => {
    expect(LISTA).toContain("?etapa=encuesta");
  });
});

describe("la columna de acciones: la forma de la referencia, no su paleta", () => {
  it("son DOS botones, no ocho", () => {
    // La tabla de Biody lleva ocho, cada uno de un color saturado. En una lista de 73 filas eso convierte
    // la columna en lo más ruidoso de la pantalla, y aquí ya hay dos cosas que SÍ deben saltar: la columna
    // de pendientes y el chip.
    //
    // Y BAJAN DE TRES A DOS (Santiago, segunda vuelta): "nueva evaluación" llevaba al MISMO sitio que el
    // panel, así que era un segundo botón para lo mismo con otro icono, lo que obliga a leer los dos para
    // descubrir que dan igual. Con uno menos, los dos que quedan pueden ser más grandes.
    expect((ACCIONES.match(/<TooltipTrigger asChild>/g) ?? []).length).toBe(2);
  });

  it("con UN solo acento: en Atlas el color significa", () => {
    // La TESELA de la referencia sí se porta (da la profundidad que faltaba); su arcoíris no. El primario
    // va en el azul de marca y el segundo en neutro: dos colores saturados en la misma fila que el
    // semáforo clínico competirían con él.
    expect(ACCIONES, "los botones de acción se pintaron de color").not.toMatch(/variant="destructive"/);
    expect(ACCIONES, "el primario perdió su tesela").toContain("bg-primary/10 text-primary");
    expect(ACCIONES, "el segundo botón dejó de ser neutro").toContain("bg-muted text-muted-foreground");
  });

  it("cada uno dice qué hace al pasar por encima Y tiene nombre accesible", () => {
    // Un botón de icono sin nombre es un botón que solo existe para quien ve el dibujo.
    expect((ACCIONES.match(/aria-label=/g) ?? []).length).toBe(2);
    expect((ACCIONES.match(/<TooltipContent>/g) ?? []).length).toBe(2);
  });

  it("no hay eliminar, aunque la referencia lo tenga", () => {
    // Un paciente con datos clínicos arrastra evaluaciones, diagnósticos sellados y su rastro de
    // auditoría. La razón completa vive en `can-archive-patient`.
    // SOBRE EL CODIGO SIN COMENTARIOS: el comentario que explica por que NO hay boton de eliminar tiene
    // que nombrarlo, asi que el candado se cazaba a si mismo. Es la forma de siempre.
    expect(
      sinComentarios(ACCIONES).toLowerCase(),
      "apareció un botón de eliminar",
    ).not.toContain("eliminar");
    expect(existsSync("src/modules/patients/policies/can-archive-patient.ts")).toBe(true);
  });
});

describe("las funcionalidades se derivan del sidebar, no se escriben aparte", () => {
  it("cada entrada del menú tiene su explicación", () => {
    // Si se escribiera a mano, envejecería: se quedaría con la entrada retirada y sin la añadida, y no da
    // error, solo miente.
    const sinExplicacion = NAV_ITEMS.filter((i) => QUE_HACE[i.href] == null).map((i) => i.href);
    expect(sinExplicacion, "estas entradas del sidebar no tienen explicación").toEqual([]);
  });

  it("y la clave es la RUTA, que es lo único estable", () => {
    // Esta misma semana "Tablero" pasó a "Inicio" y "Administrador de Pacientes" a "Lista de pacientes".
    // Una explicación indexada por rótulo se habría quedado huérfana dos veces.
    const COMPONENTE = readFileSync(
      "src/modules/dashboard/components/funcionalidades.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("QUE_HACE[i.href]");
  });

  it("y sin explicación la tarjeta se pinta igual", () => {
    // Ocultarla sería castigar al usuario por un texto que falta: la tarjeta sigue llevando a su sitio,
    // que es la mitad del valor.
    const COMPONENTE = readFileSync(
      "src/modules/dashboard/components/funcionalidades.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("QUE_HACE[i.href] ? (");
  });
});

describe("el reparto de clics no multiplica las paradas de teclado", () => {
  // ═══ LO QUE SANTIAGO PIDIO VERIFICAR ═══
  //
  // Su reparto pone CINCO destinos en una fila. Con cinco enlaces por fila y veinte filas serian cien
  // paradas de tabulador en una pantalla, y recorrer la lista con teclado dejaria de ser viable.
  //
  // LA SOLUCION CAMBIO EN LA TERCERA VUELTA, y conviene dejar las dos escritas porque la segunda solo se
  // entiende contra la primera.
  //
  // ANTES: el enlace del titulo iba ESTIRADO sobre la fila entera (`after:absolute after:inset-0`), asi
  // que la edad, el documento y los huecos llevaban al panel sin ser enlaces propios.
  //
  // Y ESO COBRABA UN PRECIO QUE NADIE VIO hasta el smoke: el pseudo que cubre la fila pertenece al enlace
  // del titulo, asi que el cursor de mano salia en TODA la fila y el `:hover` se lo llevaba siempre el
  // titulo, nunca la celda por la que se pasaba. Ningun subrayado de celda podia encenderse.
  //
  // AHORA: la fila no lleva a ningun sitio (el nombre despliega, al panel se va por su boton), asi que no
  // hay estirado ninguno. Las paradas de teclado no suben porque los destinos no subieron: nombre,
  // pendiente, conteo y los dos botones.

  it("la edad y el documento NO son destinos propios: identifican, no llevan a nada", () => {
    // RE-ANCLADO (2026-09-10): con la opcion B del artefacto, la edad y el documento dejaron de ser
    // CELDAS y bajaron a la segunda linea bajo el nombre. Lo que el caso afirma no cambia (ninguno de los
    // dos es un destino propio), pero el sitio donde vive la afirmacion si. Es la familia de "un candado
    // anclado a una entrega superada pasa verde": si se hubiera dejado mirando `const valores`, seguiria
    // pasando sin mirar nada.
    const LISTA_SRC = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
    const i = LISTA_SRC.indexOf("const identificacion = [");
    expect(i, "desapareció la segunda línea con documento y edad").toBeGreaterThan(-1);
    const bloque = LISTA_SRC.slice(i, LISTA_SRC.indexOf(".join(", i));
    expect(bloque).toContain(".trim() || null");
    expect(bloque).toContain("anos !== null");
    // Y lo que de verdad hay que impedir: que alguien les ponga destino propio y pague dos paradas mas.
    expect(bloque).not.toContain("href");
    expect(bloque).not.toContain("alPulsar");
  });

  it("NO hay enlace estirado: era lo que robaba el hover a las celdas", () => {
    // ═══ EL CANDADO CAMBIA DE SIGNO, y por eso va explicado ═══
    //
    // Hasta hoy este caso exigia el estirado; ahora lo PROHIBE. No es que antes estuviera mal: la fila
    // tenia un destino y cubrirla entera era correcto. Al dejar de tenerlo, el estirado se quedo sin
    // razon y con un coste: tapaba a las celdas y ninguna recibia el paso del raton.
    //
    // Si alguien lo vuelve a meter para "hacer la fila clicable", el subrayado de las celdas se apaga
    // otra vez y en silencio, que es exactamente como llego el defecto la primera vez.
    const LISTA_SRC = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
    // SIN COMENTARIOS: el propio componente EXPLICA por que retiro el estirado, y esa explicacion nombra
    // la clase. Un candado que busca una cadena prohibida se caza a si mismo en cuanto alguien escribe por
    // que esa cadena no debe estar. Lo que afirma el codigo es el codigo, no lo que el codigo cuenta.
    const sinComentarios = FILA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(sinComentarios).not.toContain("after:inset-0");
    // Y la fila de pacientes no le pasa `href`, que es lo que encenderia el estirado.
    const fila = LISTA_SRC.slice(LISTA_SRC.indexOf("<FilaLista"), LISTA_SRC.indexOf("panel={"));
    expect(fila, "la fila de pacientes volvió a llevar a un destino").not.toContain("href=");
  });

  it("las celdas con destino propio siguen por encima de los fondos de la fila", () => {
    expect(FILA).toContain("relative z-10 cursor-pointer rounded text-left underline-offset-4");
  });

  it("el elemento con destino OCUPA su celda, y el subrayado cuelga de el mismo", () => {
    // ═══ CUARTA VUELTA: SE RETIRA EL MECANISMO, NO SE AJUSTA (Santiago, 2026-09-10) ═══
    //
    // La version con `group-hover/celda` exigia TRES cosas a la vez: la clase de grupo puesta, el enlace
    // como DESCENDIENTE del grupo, y el raton alcanzando una caja INLINE dentro de una celda con
    // `overflow:hidden`. Se verifico que las dos primeras se cumplian (las reglas estan en el CSS
    // compilado, el marcado es el correcto) y aun asi no subrayaba, asi que el fallo estaba en la tercera,
    // que es la unica que no se puede comprobar sin un navegador.
    //
    // AHORA EL ENLACE ES LA CELDA: `md:block md:w-full`, con su propio `hover:underline`. Una sola
    // condicion, y de las que no dependen de si algo tapa una caja pequeña. Si alguien lo devuelve a ser
    // un texto suelto dentro de la celda, el area pulsable se encoge al texto y el subrayado vuelve a
    // depender de acertarle a las letras.
    expect(FILA).toContain("md:block md:w-full");
    expect(FILA).toContain("hover:underline");
    // Y NO vuelve el grupo: era el mecanismo que fallaba. Sobre el codigo sin comentarios, porque el
    // propio componente explica por que lo retiro y esa explicacion lo nombra.
    expect(sinComentarios(FILA)).not.toContain("group-hover/celda");
  });

  it("el nombre conserva el suyo, que es el que SI funciona", () => {
    // ═══ SANTIAGO, 2026-09-10: "en cada celda con destino, y tambien en el conteo" ═══
    //
    // EL DEFECTO ERA DE ALCANCE, no de ausencia: el subrayado estaba, pero colgaba del propio enlace, que
    // solo cubre el TEXTO. Pasar por la celda no lo encendia, asi que el unico modo de descubrir que esa
    // celda lleva a otro sitio que el resto de la fila era acertarle a las letras.
    //
    // COLGARLO DE LA CELDA vale ademas para el conteo, que es un BOTON y no cambia el cursor. Su regla:
    // si responde al paso, tiene que decir que responde.
    expect(FILA).toContain("group/paciente");
    expect(FILA).toContain("group-hover/paciente:underline");
  });
});
