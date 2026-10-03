import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { historicoDelProfesional, type HistoricoDelProfesional } from "./historico-del-profesional";

// ═══ VER LA OPERACION DE UN INTEGRANTE DESDE ADMIN (Santiago, 2026-09-25) ═══
//
// LA NECESIDAD SALIO DEL SMOKE ACUMULADO: "no hay forma de mirarlo desde admin: inventario actual, ventas,
// pacientes. Sin eso no se puede verificar nada." Todo lo del integrante se veia SOLO desde su propia sesion
// (/mi-inventario lee lo suyo), asi que comprobar "devolvi una unidad, ¿le bajo el inventario?" obligaba a
// entrar con su cuenta.
//
// LEE CON LA CONEXION DE SISTEMA, NO BAJO RLS, y es a proposito: la RLS del inventario acota al DUEÑO, que es
// justo lo que esta pantalla necesita saltarse. Lo que autoriza aqui es la policy del lado del server
// (`canAccessAdmin`), no la sesion del profesional.
//
// NO ES UNA PANTALLA DE ACCION: no mueve nada ni corrige nada. Si algo esta mal, se arregla por el camino que
// ya existe (una devolucion, un conteo, una remesa). Aqui solo se mira.

export type DetalleDelIntegrante = {
  nombre: string;
  correo: string;
  profesion: string;
  /**
   * Si es una cuenta de DEMOSTRACION. La pantalla lo dice arriba, y hace falta: sus cifras de abajo son
   * reales para el (lo que vendio, lo que se le debe) y NO cuentan en las de la organizacion. Sin decirlo,
   * ver 3.542.000 aqui y 0 en /direccion se lee como un defecto.
   */
  esDePrueba: boolean;
  inventario: {
    producto: string;
    lote: string;
    ubicacion: string;
    vendible: boolean;
    cantidad: number;
    /**
     * SIRVE PARA QUE LA CIFRA NO LO CUENTE Y LA LISTA SI LO MUESTRE (Santiago, 2026-09-30).
     *
     * "Unidades en custodia: 112" contaba los productos de prueba mientras la tarjeta de su propio Inicio
     * decia 88, porque esa si los excluye. Dos cifras del mismo hecho, y la de /admin es justo la que se
     * mira cuando algo no cuadra. Capa 1 y capa 3 de la regla de `patients/de-prueba.ts`.
     */
    esDePrueba: boolean;
  }[];
  ventas: {
    id: string;
    fecha: string;
    total: number;
    estado: string;
    medio: string;
    inventario: string | null;
    productos: string | null;
  }[];
  comision: { causada: number; liquidada: number; pendiente: number };
  /**
   * LO QUE HA VENDIDO EN TODA SU HISTORIA, no en el mes (Santiago, 2026-10-01).
   *
   * La pantalla mostraba el pendiente y las ultimas 30 ventas, pero no el total: "cuanto ha vendido" y
   * "cuanta comision ha generado" eran preguntas que no se podian responder sin contar a mano.
   *
   * NO LLEVA EL CORTE DEL ARRANQUE, y es deliberado: es un total historico, de la misma familia que lo que
   * se le debe. Recortarlo por una fecha responderia otra pregunta.
   */
  // La forma la fija el lector compartido (): repetirla aqui es como se llega a que
  // una pantalla muestre un campo que la otra no.
  vendido: HistoricoDelProfesional["vendido"];
  faltantesAbiertos: { producto: string; unidades: number; estado: string; reportado: string }[];
  pacientes: number;
  /**
   * SUS PACIENTES, CON SU MARCA (Santiago, 2026-10-01).
   *
   * La CIFRA de arriba no cuenta los de prueba y esta LISTA si los muestra: es la capa 3 de la regla, y aqui
   * hace falta mas que en ningun sitio, porque esta es la pantalla desde la que admin los marca. Sin la
   * lista, marcar los quince de una cuenta de demostracion obligaba a un UPDATE a mano.
   */
  listaDePacientes: {
    id: string;
    nombre: string;
    documento: string;
    /** Lo que las cifras excluyen: marcado a mano O derivado de su profesional. */
    esDePrueba: boolean;
    /** Si la decision la tomo una persona. Un derivado no se "desmarca": se confirma como real. */
    marcadoAMano: boolean;
    /** Si alguien dijo que SI es real aunque su profesional sea de prueba. */
    confirmadoReal: boolean;
    motivo: string | null;
  }[];
};

export async function leerIntegrante(professionalId: string): Promise<DetalleDelIntegrante | null> {
  const quienes = await db.execute<{
    nombre: string;
    correo: string;
    profesion: string;
    es_de_prueba: boolean;
  }>(sql`
    select p.full_name as nombre, p.email as correo, pp.profession::text as profesion,
           coalesce(pp.is_test, false) as es_de_prueba
      from professional_profiles pp
      join profiles p on p.id = pp.profile_id
     where pp.id = ${professionalId}::uuid`);
  const quien = quienes[0];
  if (!quien) return null;

  // EL INVENTARIO POR PRODUCTO, LOTE Y UBICACION, que es como se cuenta en la vitrina. Agregado por producto
  // esconde justo lo que hay que mirar cuando algo no cuadra: de que lote salio o entro una unidad, y si lo
  // que quedo esta en la vitrina o en la cuarentena de devoluciones (que no es vendible).
  const inventario = await db.execute<{
    producto: string;
    lote: string;
    ubicacion: string;
    vendible: boolean;
    cantidad: number;
    es_de_prueba: boolean;
  }>(sql`
    select n.name as producto, l.code as lote, loc.name as ubicacion, loc.sellable as vendible,
           i.stock_quantity as cantidad, coalesce(n.is_test, false) as es_de_prueba
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join lots l on l.id = i.lot_id
      join inventory_locations loc on loc.id = i.location_id
     where i.professional_id = ${professionalId}::uuid and i.stock_quantity <> 0
     order by n.name, l.code`);

  const ventas = await db.execute<{
    id: string;
    fecha: string;
    total: string;
    estado: string;
    medio: string;
    inventario: string | null;
    productos: string | null;
  }>(sql`
    select t.id, t.created_at::text as fecha, t.amount::text as total, t.status::text as estado,
           t.payment_method::text as medio, t.stock_state as inventario,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti
              join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = t.id) as productos
      from transactions t
     where t.professional_id = ${professionalId}::uuid
     order by t.created_at desc
     limit 30`);

  // CAUSADA, LIQUIDADA Y PENDIENTE de una sola consulta: las tres salen de las mismas filas y separarlas
  // abriria la puerta a que no sumen. Las reversiones son filas negativas, asi que restan solas.
  // ═══ EL HISTORICO SALE DE UN LECTOR COMPARTIDO (Santiago, 2026-10-01) ═══
  //
  // Aqui vivian cuatro consultas propias (ventas, disputas, devoluciones y comision) y su gemela en
  // /perfil tenia las suyas. Dieron cifras distintas de la misma persona porque el INSUMO del filtro era
  // distinto en cada una. Dos consultas que calculan lo mismo divergen; la unica forma de que no puedan es
  // que haya UNA. Ver .
  const historico = await historicoDelProfesional(professionalId);
  // ABIERTOS = los que todavia esperan algo de alguien. Un justificado o un injustificado ya confirmado
  // estan cerrados (el segundo con su cargo), y mostrarlos aqui haria ruido sobre lo que hay que atender.
  const faltantes = await db.execute<{
    producto: string;
    unidades: number;
    estado: string;
    reportado: string;
  }>(sql`
    select n.name as producto, f.quantity as unidades, f.status::text as estado,
           f.reported_at::text as reportado
      from nutraceutical_faltante_cases f
      join nutraceuticals n on n.id = f.nutraceutical_id
     where f.professional_id = ${professionalId}::uuid
       and f.status in ('reportado', 'en_revision', 'injustificado_pendiente')
     order by f.reported_at desc
     limit 20`);

  // ═══ AQUI SE CUENTAN TODOS LOS SUYOS, Y ESTO CAMBIO (Santiago, 2026-10-01) ═══
  //
  // Antes excluia los de prueba, con esta razon: "un integrante que creo tres pacientes para probar figuraba
  // con tres pacientes de mas justo en la pantalla que existe para verificar". Valia para un integrante REAL
  // con tres pruebas, y se rompio con una cuenta de demostracion: la pantalla decia "Pacientes asignados: 0"
  // al lado de "Lo que ha vendido: 3.542.000 en 22 ventas". Si no tiene pacientes, ¿a quien le vendio?
  //
  // ESTA PANTALLA ES EL HISTORIAL DE UNA PERSONA, no una cifra de la organizacion. Su alcance es "lo suyo",
  // y lo suyo incluye sus pruebas; las que no las cuentan son las cifras de /direccion, que es otra
  // pregunta. Asi que se cuentan todos y el pie dice cuantos no cuentan en las cifras, que es lo que el
  // lector necesita saber sin tener que deducirlo de un cero.
  //
  // LA REGLA DE FONDO es la misma que arreglo el tablero de admin: el rotulo manda, y aqui el rotulo dice
  // "pacientes asignados", no "pacientes que cuentan".
  const pacientes = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
      from patient_professional_relationships r
      join patients p on p.id = r.patient_id
     where r.professional_id = ${professionalId}::uuid and r.status = 'active'
       and p.deleted_at is null`);

  // LA LISTA TRAE A TODOS, marcados y sin marcar, porque es donde se decide. Con su documento, que es lo
  // que permite reconocerlo cuando dos personas se llaman igual.
  const listaDePacientes = await db.execute<{
    id: string;
    nombre: string | null;
    documento: string;
    cuenta_como_de_prueba: boolean;
    marcado_a_mano: boolean;
    confirmado_real: boolean;
    motivo: string | null;
  }>(sql`
    select p.id,
           nullif(btrim(coalesce(pp.first_name, '') || ' ' || coalesce(pp.last_name, '')), '') as nombre,
           p.document_number as documento,
           -- LAS TRES, Y LA DISTINCION ES EL PUNTO (Santiago, 2026-10-01): cuenta_como_de_prueba es lo que
           -- las cifras excluyen, is_test es si alguien lo DECIDIO a mano, y es_real_confirmado es la
           -- salida. Con solo la primera no se puede ofrecer el boton correcto: a un derivado hay que
           -- ofrecerle "es real", no "marcar de prueba".
           coalesce(p.cuenta_como_de_prueba, false) as cuenta_como_de_prueba,
           coalesce(p.is_test, false) as marcado_a_mano,
           coalesce(p.es_real_confirmado, false) as confirmado_real,
           p.test_proposed_reason as motivo
      from patient_professional_relationships r
      join patients p on p.id = r.patient_id
      left join patient_profiles pp on pp.patient_id = p.id
     where r.professional_id = ${professionalId}::uuid and r.status = 'active' and p.deleted_at is null
     order by p.cuenta_como_de_prueba, nombre nulls last
     limit 200`);

  return {
    nombre: quien.nombre,
    correo: quien.correo,
    profesion: quien.profesion,
    esDePrueba: Boolean(quien.es_de_prueba),
    inventario: inventario.map((f) => ({
      producto: f.producto,
      lote: f.lote,
      ubicacion: f.ubicacion,
      vendible: f.vendible,
      cantidad: Number(f.cantidad),
      esDePrueba: Boolean(f.es_de_prueba),
    })),
    ventas: ventas.map((f) => ({
      id: f.id,
      fecha: f.fecha,
      total: Number(f.total),
      estado: f.estado,
      medio: f.medio,
      inventario: f.inventario,
      productos: f.productos,
    })),
    comision: historico.comision,
    vendido: historico.vendido,
    faltantesAbiertos: faltantes.map((f) => ({
      producto: f.producto,
      unidades: Number(f.unidades),
      estado: f.estado,
      reportado: f.reportado,
    })),
    pacientes: Number(pacientes[0]?.n ?? 0),
    listaDePacientes: listaDePacientes.map((f) => ({
      id: f.id,
      nombre: f.nombre ?? "(sin nombre)",
      documento: f.documento,
      esDePrueba: Boolean(f.cuenta_como_de_prueba),
      marcadoAMano: Boolean(f.marcado_a_mano),
      confirmadoReal: Boolean(f.confirmado_real),
      motivo: f.motivo,
    })),
  };
}
