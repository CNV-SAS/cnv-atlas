import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ UN DESCUADRE FISICO NO LO BORRA UNA MARCA DE PRUEBA (Santiago, smoke del 2026-10-03) ═══
//
// LA REGLA, que ya estaba decidida y escrita en la bandeja: cuando el PRODUCTO es real, la unidad salio de
// verdad de una vitrina de verdad, y la vitrina esta descuadrada aunque el paciente o el profesional sean de
// prueba. Las cifras de DINERO pueden excluir esa venta; el movimiento de inventario no.
//
// EL DEFECTO: esa regla vivia en la bandeja de "ventas por revisar" y NO en el lector de pendientes, donde un
// filtro general (`and not tx.cuenta_como_de_prueba`, puesto al final "para que no se olvide en ninguna rama")
// PISABA la regla propia de la rama de `sin_saldo`.
//
// LO QUE PRODUJO, y es peor que esconder de mas: la bandeja MOSTRABA la LUVIA descuadrada y el panel de
// "Pendientes sin salida" NO, porque sale del otro lector. La fila se veia en un panel y no se podia descartar
// en el otro: el unico remedio que existe para ella quedaba fuera de su alcance.
//
// ES LA MISMA FORMA DE SIEMPRE: la misma pregunta contestada en dos sitios con criterios distintos. Lo que
// este candado vigila es que los dos paneles que hablan del MISMO hecho fisico lo decidan igual.

const BANDEJA = sinComentarios(readFileSync("src/modules/payments/data/ventas-por-revisar.ts", "utf8"));
const PENDIENTES = sinComentarios(readFileSync("src/modules/avisos/data/avisos-repository.ts", "utf8"));

// ═══ Y EL MECANISMO CAMBIO EL 2026-10-14, SIN QUE LA REGLA CAMBIE (0218) ═══
//
// LO QUE PASABA: esta misma excepcion estaba escrita DOS VECES y distinto. La bandeja decia "ninguna linea es
// de producto de prueba" (`not exists (... is_test)`) y los avisos decian "alguna linea es real"
// (`exists (... is_test = false)`). Coincidian solo porque el servicio no deja mezclar productos de prueba y
// reales en una venta, o sea por una regla de OTRA capa. Este candado vigilaba las dos redacciones, una por
// archivo, que es tan fragil como el codigo que vigilaba.
//
// AHORA LAS DOS LLAMAN A `public.el_descuadre_fisico_es_real` (0218), que lo dice una vez. Asi que lo que hay
// que vigilar ya no es que cada archivo tenga su condicion: es que las dos usen LA MISMA, y que la funcion
// siga mirando el producto.
//
// Es [[una-regla-nueva-invalida-el-mecanismo-no-el-fixture]]: la regla no se movio (un descuadre de producto
// real sigue viendose), se movio DONDE vive. El candado sigue a la regla.
const FUNCION = readFileSync("drizzle/0218_el_descuadre_fisico_es_real.sql", "utf8");

describe("la bandeja y el panel de descartar deciden igual sobre un sin_saldo", () => {
  it("las dos ramas de saldo llaman a la MISMA funcion, no a dos condiciones parecidas", () => {
    expect(BANDEJA, "la bandeja dejo de usar la definicion compartida").toContain(
      "el_descuadre_fisico_es_real",
    );
    expect(PENDIENTES, "los avisos dejaron de usar la definicion compartida").toContain(
      "el_descuadre_fisico_es_real",
    );
  });

  it("y la funcion mira el PRODUCTO, que es lo que sostiene el argumento fisico", () => {
    // Si dejara de mirarlo, un hueco de saldo en un producto que no existe entraria al correo.
    expect(FUNCION, "la funcion dejo de exigir que el producto sea real").toMatch(
      /is_test,\s*false\)\s*=\s*false/,
    );
    // Y LA MARCA MANUAL es el otro insumo (Santiago: "que se oculten esta vez si de verdad"). Si se cayera,
    // volveria el caso que nunca se pudo ocultar.
    expect(FUNCION, "la funcion dejo de mirar la marca manual del acto").toContain("marcada_como_prueba_at");
  });

  it("la bandeja NO esconde un descuadre por la marca DERIVADA de la venta", () => {
    // El control que sigue valiendo: la rama de saldo no puede filtrar por `cuenta_como_de_prueba`, porque esa
    // columna es verdadera tambien por el PACIENTE, y un paciente de prueba no devuelve la unidad al estante.
    const i = BANDEJA.indexOf("stock_state in ('sin_saldo', 'fallido')");
    expect(i, "cambio la rama de saldo de la bandeja: revisa este candado").toBeGreaterThan(0);
    const rama = BANDEJA.slice(i, BANDEJA.indexOf("order by", i));
    expect(rama, "la rama de saldo empezo a esconder por la marca derivada").not.toContain(
      "cuenta_como_de_prueba",
    );
  });

  it("y el lector de pendientes NO saca un sin_saldo por la marca de la venta", () => {
    // El filtro general sigue para las otras ramas (hablan de dinero y de documentos); `sin_saldo` habla de
    // unidades fisicas, y por eso queda exceptuada. Sin esta excepcion, la fila no se puede descartar.
    expect(
      PENDIENTES,
      "volvio el filtro general sin la excepcion de sin_saldo: la fila se ve en la bandeja y no se puede descartar",
    ).toMatch(/not tx\.cuenta_como_de_prueba or p\.tipo = 'sin_saldo'/);
  });

  it("y la rama de sin_saldo conserva su propia regla, ahora como llamada a la funcion", () => {
    // El control: si alguien quitara la condicion de la rama creyendo que la excepcion de arriba la sustituye,
    // entraria al correo cualquier venta de un producto de prueba.
    const i = PENDIENTES.indexOf("'sin_saldo', t.id");
    expect(i, "cambio la rama de sin_saldo: revisa este candado").toBeGreaterThan(0);
    // ── EL CORTE VA HASTA EL FIN DE LA RAMA, NO A 2000 CARACTERES (2026-10-08) ──────────────────────
    //
    // Cortaba `i + 2000`, y al añadir un CASE a la rama (para que el aviso nombre la bodega en vez de la
    // vitrina) la condicion del producto quedo FUERA de la ventana: el candado acuso un filtro que seguia ahi.
    //
    // Es el mismo defecto de corte del candado de `cierre-consulta`, que rebanaba "hasta el fin del archivo":
    // una ventana por longitud envejece con el codigo y acaba acusando lo que no es. La rama termina donde
    // empieza la siguiente (`union all`), o donde acaba el `with` si es la ultima: las dos son limites que no
    // se mueven con el texto de la rama.
    const siguiente = PENDIENTES.indexOf("union all", i);
    const rama = PENDIENTES.slice(i, siguiente > i ? siguiente : PENDIENTES.indexOf("from pendientes p", i));
    expect(rama, "la rama de sin_saldo dejo de exigir que el descuadre sea real").toContain(
      "el_descuadre_fisico_es_real",
    );
  });
});

describe("y la bandeja DICE por que muestra una venta de prueba", () => {
  const COMPONENTE = sinComentarios(readFileSync("src/modules/payments/components/ventas-por-revisar.tsx", "utf8"));

  it("trae la marca y la explica, en vez de dejar la contradiccion muda", () => {
    // La lista principal de /pagos la esconde y esta la muestra. Las dos reglas son correctas; lo que no
    // puede quedar es que el profesional vea el mismo hecho en un panel y no en el otro sin saber por que.
    expect(BANDEJA).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("el producto es real");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA OTRA MITAD, QUE FALTABA: EL DESCARTE TENIA QUE VALER EN LOS DOS PANELES (0220, 2026-10-15)
//
// EL CASO: con el arranque ya comiteado y las 55 ventas anteriores marcadas de prueba, admin seguia viendo
// cinco filas en "Ventas por revisar". Las cinco son correctas (son el descuadre fisico de arriba). Lo que no
// era correcto es que el texto de ESTA bandeja manda a *"cuadrarlo o descartarlo abajo, en Pendientes sin
// salida"*, y `listarVentasPorRevisar` no sabia nada del descarte: se descartaba abajo y arriba seguia igual.
//
// POR QUE ES GRAVE Y NO COSMETICO: la pantalla pide una accion y no reconoce que se hizo. Quien la lee no
// concluye "son dos reglas distintas", concluye "el sistema no guardo lo que hice", y deja de creerle al
// panel. Es el mismo coste que ya se pago con el aviso que acusaba a la vitrina equivocada.
//
// Es el hazard 4 de CLAUDE.md en su forma pura: dos partes de la pantalla diciendo cosas opuestas porque leen
// FUENTES DISTINTAS, y el arreglo es unir las fuentes, no corregir el mensaje.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("un descarte vigente vale en los dos paneles", () => {
  const DESCARTE = readFileSync("drizzle/0220_un_descarte_vale_en_los_dos_paneles.sql", "utf8");

  it("la bandeja de ventas por revisar consulta el descarte", () => {
    expect(BANDEJA, "la bandeja volvio a ignorar el descarte que ella misma manda a hacer").toContain(
      "public.el_pendiente_sigue_pidiendo_accion(",
    );
  });

  it("y el lector de pendientes usa LA MISMA funcion, no su propia redaccion", () => {
    expect(PENDIENTES, "el lector de pendientes se quedo con la condicion escrita a mano").toContain(
      "public.el_pendiente_sigue_pidiendo_accion(p.tipo, p.transaction_id)",
    );
    // La condicion vieja vivia SOLO aqui, y es justo por eso que el otro panel no la tenia. Si vuelve a
    // aparecer en el where, volvio a haber dos fuentes.
    expect(PENDIENTES, "volvio la condicion de descarte escrita a mano en el where").not.toMatch(
      /where \$\{incluirDescartados\} or d\.reason is null/,
    );
  });

  it("y el filtro del descarte NO depende del interruptor de lo de prueba", () => {
    // Son dos cosas distintas: la marca de prueba habla de si el acto cuenta, y el descarte habla de si una
    // persona ya juzgo ese hecho fisico. Colgar el descarte del interruptor haria que al ver lo de prueba
    // reaparecieran filas ya resueltas, que es la contradiccion de vuelta.
    const llamada = BANDEJA.slice(BANDEJA.indexOf("el_pendiente_sigue_pidiendo_accion"));
    expect(llamada.slice(0, 200)).not.toContain("incluirDePrueba");
  });

  it("la funcion exige descarte NO revocado y huella VIGENTE, las dos", () => {
    expect(DESCARTE).toContain("d.revoked_at IS NULL");
    // Caducado no cuenta: el hecho cambio despues del juicio, asi que el juicio ya no lo cubre.
    expect(DESCARTE).toContain("public.huella_del_pendiente(d.kind, d.transaction_id)");
    expect(DESCARTE).toMatch(/SELECT NOT EXISTS/);
  });

  it("y no la alcanza el navegador", () => {
    expect(DESCARTE).toMatch(
      /REVOKE ALL ON FUNCTION public\.el_pendiente_sigue_pidiendo_accion\(text, uuid\) FROM anon, authenticated/,
    );
  });

  it("'fallido' no tiene camino de descarte, y la huella LANZA para un tipo sin definir", () => {
    // `huella_del_pendiente` revienta con un tipo que no conoce (hoy solo sin_saldo y por_despachar). El
    // EXISTS la protege: para `fallido` no hay filas de descarte, asi que nunca se evalua. Si alguien
    // cambiara el EXISTS por un calculo previo de la huella, esta bandeja empezaria a lanzar.
    expect(DESCARTE).toContain("FROM pending_discards d");
    const huella = readFileSync("drizzle/0205_descartar_un_pendiente_sin_salida.sql", "utf8");
    expect(huella).toContain("tipo de pendiente sin huella definida");
  });
});
