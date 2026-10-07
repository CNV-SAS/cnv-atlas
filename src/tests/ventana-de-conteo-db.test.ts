import { sql as dsql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE LA VENTANA DEL CONTEO, CONTRA BASE REAL (0208) ═══
//
// LO QUE VIGILA, y es lo UNICO que de verdad hay que guardar de esta pieza: que FUERA DE LA VENTANA NO SE
// PUEDA REGISTRAR UN CONTEO. Si se pudiera igual, la ventana seria decorativa y volveriamos a la seccion
// siempre encendida, solo que con un texto nuevo. Una pantalla que no ofrece el formulario no impide un envio:
// el porton tiene que estar en el escritor, y eso solo lo prueba la base.
//
// Y LA SEGUNDA MITAD: que la peticion de admin de verdad la abra, y que contar la cierre. Las dos juntas son
// la regla; cada una sola deja un estado que no sirve (abierta para siempre, o cerrada sin salida).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la ventana del conteo (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let escritor: typeof import("@/modules/nutraceuticals/data/count-writer");
  let profId: string;
  let actorId: string;
  let nutraId: string;
  let cfgOriginal: { dia: number; dias: number };
  const sesiones: string[] = [];
  const aperturas: string[] = [];

  const hoyEnColombia = async (): Promise<string> => {
    const [f] = await db.execute(dsql`select (now() at time zone 'America/Bogota')::date::text as dia`);
    return f.dia;
  };

  /** Pone la ventana del calendario ABIERTA o CERRADA hoy, moviendo la configuracion. */
  const ponerVentana = async (abierta: boolean) => {
    const hoy = await hoyEnColombia();
    const diaDeHoy = Number(hoy.slice(8, 10));
    // ABIERTA: la ventana empieza hoy. CERRADA: empieza mañana y dura un dia, asi que hoy queda fuera por los
    // dos lados (ni en la de este mes ni en la del anterior, que termino ayer).
    const dia = abierta ? diaDeHoy : ((diaDeHoy % 28) + 1);
    await db.execute(dsql`
      update commercial_config set conteo_dia_de_apertura = ${dia}, conteo_dias_de_ventana = 1`);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    escritor = await import("@/modules/nutraceuticals/data/count-writer");

    // EL PROFESIONAL CON MENOS VENTAS, por la leccion del 2026-10-06: tomar "el primero" cae en Profesional
    // Demo, con 16.299 ventas, y cualquier trigger sobre ellas se come el timeout.
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id
        from professional_profiles pp
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;

    const [n] = await db.execute(dsql`select id from nutraceuticals order by name limit 1`);
    nutraId = n.id;

    const [cfg] = await db.execute(dsql`
      select coalesce(conteo_dia_de_apertura, 1) as dia, coalesce(conteo_dias_de_ventana, 5) as dias
        from commercial_config limit 1`);
    cfgOriginal = { dia: Number(cfg.dia), dias: Number(cfg.dias) };
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of sesiones) {
      await db.execute(dsql`delete from nutraceutical_count_lines where session_id = ${id}::uuid`);
      await db.execute(dsql`delete from nutraceutical_faltante_cases where count_session_id = ${id}::uuid`);
      await db.execute(dsql`delete from nutraceutical_count_sessions where id = ${id}::uuid`);
    }
    for (const id of aperturas) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from nutraceutical_count_openings where id = ${id}::uuid`);
    }
    sesiones.length = 0;
    aperturas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    // LA CONFIGURACION SE DEVUELVE: es una fila unica y compartida, y dejarla movida cambiaria la ventana de
    // todos los Integrantes de la base local.
    await db.execute(dsql`
      update commercial_config
         set conteo_dia_de_apertura = ${cfgOriginal.dia}, conteo_dias_de_ventana = ${cfgOriginal.dias}`);
  });

  /** Registra un conteo que CUADRA (cantidad = saldo), para no abrir casos de faltante por accidente. */
  const contar = async () => {
    const [inv] = await db.execute(dsql`
      select coalesce(sum(stock_quantity), 0)::int as saldo
        from nutraceutical_inventory
       where professional_id = ${profId} and nutraceutical_id = ${nutraId}`);
    const r = await escritor.recordCount({
      professionalId: profId,
      actorId,
      note: "candado de la ventana",
      lines: [{ nutraceuticalId: nutraId, lote: null, physicalQty: Number(inv.saldo) }],
      now: new Date(),
    });
    sesiones.push(r.sessionId);
    return r;
  };

  it("dentro de la ventana se puede contar", async () => {
    await ponerVentana(true);
    const r = await contar();
    expect(r.sessionId).toBeTruthy();
  });

  // ═══ EL CASO QUE JUSTIFICA ESTE ARCHIVO ═══
  it("fuera de la ventana el ESCRITOR lo rechaza, no solo la pantalla", async () => {
    await ponerVentana(false);
    await expect(contar()).rejects.toBeInstanceOf(escritor.ConteoFueraDeVentanaError);
  });

  // Y EL MENSAJE DICE CUANDO LE TOCA: "no disponible" sin fecha deja al Integrante sin nada que hacer con la
  // informacion, que es el problema con el que empezo todo esto.
  it("y el rechazo dice cuando se abre, con fecha", async () => {
    await ponerVentana(false);
    await expect(contar()).rejects.toThrow(/se abre el \d{4}-\d{2}-\d{2}/);
  });

  it("contar cierra la ventana: el segundo conteo del periodo se rechaza", async () => {
    await ponerVentana(true);
    await contar();
    await expect(contar()).rejects.toBeInstanceOf(escritor.ConteoFueraDeVentanaError);
  });

  describe("la peticion de admin", () => {
    const pedir = async (motivo = "una venta no cuadra con su saldo") => {
      const hoy = await hoyEnColombia();
      await escritor.abrirElConteo({
        professionalId: profId,
        hasta: hoy,
        motivo,
        actorId,
        actorEmail: null,
      });
      const [a] = await db.execute(dsql`
        select id from nutraceutical_count_openings
         where professional_id = ${profId} order by created_at desc limit 1`);
      aperturas.push(a.id);
      return a.id;
    };

    it("abre el conteo aunque la ventana del calendario este cerrada", async () => {
      await ponerVentana(false);
      await pedir();
      const r = await contar();
      expect(r.sessionId).toBeTruthy();
    });

    it("queda en el audit, porque pedir un conteo puede terminar en un cargo", async () => {
      await ponerVentana(false);
      const id = await pedir();
      const [f] = await db.execute(dsql`
        select count(*)::int as n from clinical_audit_log
         where event = 'conteo.apertura_concedida' and entity_id = ${id}`);
      expect(Number(f.n)).toBe(1);
    });

    // EL MOTIVO ES OBLIGATORIO: si a alguien le abren el conteo tiene derecho a saber por que, y esa frase se
    // le muestra. Un motivo vacio convierte la peticion en una orden sin explicacion.
    it("sin motivo no se concede", async () => {
      await expect(
        escritor.abrirElConteo({
          professionalId: profId,
          hasta: await hoyEnColombia(),
          motivo: "   ",
          actorId,
          actorEmail: null,
        }),
      ).rejects.toBeInstanceOf(escritor.AperturaDeConteoError);
    });

    // UNA APERTURA YA VENCIDA NO ABRE NADA, y se rechaza en vez de crearse: una fila que no hace nada deja a
    // admin creyendo que pidio el conteo y al Integrante sin verlo.
    it("una fecha ya pasada se rechaza", async () => {
      await expect(
        escritor.abrirElConteo({
          professionalId: profId,
          hasta: "2020-01-01",
          motivo: "fecha vieja a proposito",
          actorId,
          actorEmail: null,
        }),
      ).rejects.toBeInstanceOf(escritor.AperturaDeConteoError);
    });

    // EL CASO FINO, y es el que el candado del modulo puro atrapo cuando escribi el orden al reves: admin
    // pide un conteo DESPUES de que el Integrante ya conto. El conteo anterior no puede cerrar la puerta,
    // porque la peticion existe justamente porque ese conteo no explico la diferencia.
    it("una peticion posterior a un conteo vuelve a abrirlo", async () => {
      await ponerVentana(true);
      await contar();
      // Con la ventana ya cumplida, sin la peticion esto se rechazaria (lo prueba el caso de arriba).
      await pedir("el conteo de hoy no explica la diferencia");
      const r = await contar();
      expect(r.sessionId).toBeTruthy();
    });
  });
});
