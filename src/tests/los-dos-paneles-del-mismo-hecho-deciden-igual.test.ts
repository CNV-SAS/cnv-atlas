import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ LOS DOS PANELES QUE MUESTRAN EL MISMO HECHO TIENEN QUE DECIDIR IGUAL ═══
//
// EL HECHO es uno: una venta cobrada cuyo descuento de inventario no cuadro. Y se ve en DOS sitios de /pagos:
// la bandeja "Ventas por revisar" (`listarVentasPorRevisar`) y el panel "Pendientes sin salida"
// (`listarPendientesDeAccion`), que es el unico que tiene el boton de descartar.
//
// Lo que este candado vigila no es una regla concreta: es que las DOS decidan con la MISMA condicion. Ya se
// pago tres veces por tenerlas escritas en dos sitios:
//
//   1. 2026-10-03 · la LUVIA se veia en la bandeja y NO en el panel, asi que el unico remedio que tenia (el
//      descarte) quedaba fuera de su alcance.
//   2. 2026-10-14 · el mismo criterio escrito al reves en cada archivo ("ninguna linea es de prueba" contra
//      "alguna linea es real"), que coincidian por una regla de OTRA capa. Se unieron en la 0218.
//   3. 2026-10-15 · se descartaba abajo y la fila seguia arriba pidiendo lo mismo: la pantalla mandaba a
//      hacer algo y no reconocia que se hizo. Se unio en la 0220.
//
// Es el hazard 4 de CLAUDE.md: *"si dos partes de la pantalla dicen cosas opuestas, no es que una este mal,
// es que LEEN FUENTES DISTINTAS"*, y el arreglo es unir las fuentes, no corregir el mensaje.

const BANDEJA = sinComentarios(readFileSync("src/modules/payments/data/ventas-por-revisar.ts", "utf8"));
const PENDIENTES = sinComentarios(readFileSync("src/modules/avisos/data/avisos-repository.ts", "utf8"));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// PRIMERA MITAD · LO MARCADO COMO PRUEBA NO APARECE EN EL LADO REAL (Santiago, 2026-10-15, la 0221)
//
// AQUI HUBO UNA EXCEPCION Y SE RETIRO, asi que este candado dice hoy lo CONTRARIO de lo que decia ayer. Vale
// la pena dejar escrito por que, porque la regla vieja tambien tenia un buen argumento.
//
//   LA VIEJA (0218): la rama de saldo no filtraba por `cuenta_como_de_prueba` sino por
//   `el_descuadre_fisico_es_real`, porque si el producto era real la unidad salio de una vitrina real y la
//   vitrina esta descuadrada DE VERDAD, aunque el paciente sea de prueba.
//
//   POR QUE SE CAYO: el argumento es cierto y el resultado no servia. Con el arranque ya comiteado, admin
//   descarto las cinco filas que quedaban y las siguio viendo en el lado REAL del interruptor. Y el smoke se
//   hace con pacientes de prueba sobre vitrinas REALES, asi que cada venta sin saldo de una prueba levanta un
//   descuadre que nadie va a ir a contar. Textual de Santiago: *"si algo esta marcado como prueba, aparece en
//   el filtro de prueba"*.
//
//   DONDE QUEDO EL HUECO FISICO: en un movimiento de `conciliacion` por ubicacion, que es donde vive. Marcar
//   nunca devolvio la unidad al estante; lo unico que se movio es DONDE se pide la cuenta.
//
// Es [[una-regla-nueva-invalida-el-mecanismo-no-el-fixture]] al reves: aqui la regla SI se movio, y el
// candado se mueve con ella en vez de defender la de ayer.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("lo marcado como prueba no aparece en el lado real de ninguno de los dos paneles", () => {
  it("la bandeja filtra por la columna derivada, UNA VEZ, para las tres ramas", () => {
    // Un solo filtro y no uno por rama: tres condiciones parecidas es como una se queda vieja.
    const i = BANDEJA.indexOf("where t.status = 'paid'");
    expect(i, "cambio la consulta de la bandeja: revisa este candado").toBeGreaterThan(0);
    const where = BANDEJA.slice(i, BANDEJA.indexOf("order by", i));
    expect(where, "la bandeja dejo de filtrar por la marca de la venta").toContain(
      "or not t.cuenta_como_de_prueba",
    );
    expect(
      (where.match(/not t\.cuenta_como_de_prueba/g) ?? []).length,
      "el filtro de prueba volvio a estar escrito mas de una vez en la misma consulta",
    ).toBe(1);
  });

  it("y el filtro de los avisos NO tiene excepciones por tipo de pendiente", () => {
    // La excepcion era `or p.tipo = 'sin_saldo'`. Si vuelve, vuelve a haber una rama que se ve en el lado
    // real con la venta marcada, y con ella la contradiccion entre los dos paneles.
    expect(PENDIENTES, "volvio una excepcion por tipo al filtro de prueba de los avisos").not.toMatch(
      /not tx\.cuenta_como_de_prueba or p\.tipo/,
    );
    expect(PENDIENTES, "los avisos dejaron de filtrar por la marca de la venta").toContain(
      "or not tx.cuenta_como_de_prueba",
    );
  });

  it("ningun lector llama ya a la funcion retirada", () => {
    // El control: si alguien la vuelve a cablear, vuelve la excepcion por la puerta de atras y solo en uno
    // de los dos paneles, que es exactamente como empezo el defecto de la LUVIA.
    //
    // ── SE BUSCA LA LLAMADA (`public.`), NO EL NOMBRE ─────────────────────────────────────────────
    //
    // `sinComentarios` quita los comentarios de TypeScript, no los `--` de SQL, que viven dentro de un
    // template literal y para el parser son texto. Y los dos archivos NOMBRAN la funcion a proposito, para
    // contar por que se retiro. Buscar el nombre a secas acusaba a la nota que explica el retiro.
    expect(BANDEJA, "la bandeja volvio a usar la excepcion retirada").not.toContain(
      "public.el_descuadre_fisico_es_real",
    );
    expect(PENDIENTES, "los avisos volvieron a usar la excepcion retirada").not.toContain(
      "public.el_descuadre_fisico_es_real",
    );
  });

  it("y la base lo dice: la funcion queda marcada como retirada, no con su comentario viejo", () => {
    // NO SE BORRA la funcion a proposito (un DROP dejaria /pagos en 500 entre la migracion y el deploy), asi
    // que lo unico que impide que alguien la vuelva a adoptar es su comentario. Un comentario que afirma que
    // dos lectores la usan, cuando ninguno la usa, es peor que no tener comentario.
    const RETIRO = readFileSync("drizzle/0221_lo_de_prueba_vive_en_el_filtro_de_prueba.sql", "utf8");
    expect(RETIRO).toMatch(/COMMENT ON FUNCTION public\.el_descuadre_fisico_es_real\(uuid\)/);
    expect(RETIRO).toMatch(/RETIRADA el 2026-10-15 y SIN USO/);
    expect(RETIRO, "la migracion borra la funcion: eso tumba /pagos en la ventana del deploy").not.toMatch(
      /DROP FUNCTION/i,
    );
  });

  it("el interruptor la vuelve a mostrar en los dos, porque esconder algo abierto lo vuelve invisible", () => {
    expect(BANDEJA).toContain("${incluirDePrueba}");
    expect(PENDIENTES).toContain("${incluirDePrueba}");
  });
});

describe("y la bandeja DICE por que esta viendo una venta de prueba", () => {
  const COMPONENTE = sinComentarios(
    readFileSync("src/modules/payments/components/ventas-por-revisar.tsx", "utf8"),
  );

  it("trae la marca y la explica, en vez de dejar la fila muda", () => {
    // Una fila de prueba sin explicacion en una pantalla de dinero se lee como un error del sistema. Y la
    // frase tiene que nombrar lo que marcar NO arregla: la unidad descontada se cuadra por conciliacion.
    expect(BANDEJA).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("deUnaVentaDePrueba");
    expect(COMPONENTE).toContain("filtro de pruebas");
    expect(COMPONENTE, "la fila ya no dice donde se cuadra el hueco de inventario").toContain("conciliación");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SEGUNDA MITAD · EL DESCARTE TENIA QUE VALER EN LOS DOS PANELES (0220, 2026-10-15)
//
// EL CASO: con el arranque ya comiteado, admin seguia viendo cinco filas en "Ventas por revisar" y el texto
// de ESA bandeja manda a *"cuadrarlo o descartarlo abajo, en Pendientes sin salida"*. Pero
// `listarVentasPorRevisar` no sabia nada del descarte: se descartaba abajo y arriba seguia igual.
//
// POR QUE ES GRAVE Y NO COSMETICO: la pantalla pide una accion y no reconoce que se hizo. Quien la lee no
// concluye "son dos reglas distintas", concluye "el sistema no guardo lo que hice", y deja de creerle al
// panel. Es el mismo coste que ya se pago con el aviso que acusaba a la vitrina equivocada.
//
// ESTA MITAD SOBREVIVE AL CAMBIO DE LA 0221, y conviene entender por que: con el filtro de prueba ya no hay
// filas de prueba en el lado real, pero el descarte no era para esas. Es para un descuadre REAL que alguien
// ya juzgo (conto la vitrina, cuadro, y lo escribio). Esa es la unica salida que tiene un `sin_saldo`, que no
// se puede "resolver" con un estado.
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
