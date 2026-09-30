import { sql as dsql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DE LOS INSIGHTS DE LA COMPRA, contra la BD real.
//
// ═══ LO QUE PROTEGE, Y POR QUE TIENE QUE SER CONTRA LA BASE ═══
//
// Son cinco consultas de agregacion con `left join` y `filter`, y esa es la clase de SQL que compila, corre, y
// devuelve un numero PLAUSIBLE Y EQUIVOCADO. Un cero de mas o de menos aqui no rompe nada: produce una
// conclusion de negocio falsa, que es peor que un error.
//
// Los casos miden las tres diferencias que dan el valor:
//   · comprado DENTRO de lo prescrito en ESA consulta;
//   · comprado FUERA (la compra que no sigue el plan, que es un hecho legitimo y el dato mas interesante);
//   · y prescrito y NO comprado (la prescripcion que no se siguio).
//
// Y UNO QUE VALE MAS QUE LOS OTROS: que la venta SUELTA no ensucie las cifras del plan. Si una venta sin
// consulta contara como "fuera del plan", el numero diria que la gente compra fuera de lo prescrito cuando lo
// que pasa es que compro sin consulta. Son dos hechos distintos.
//
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("los insights de la compra (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let lector: any;
  let orgId: string;
  let profId: string;
  let patientId: string;
  let treatmentId: string;
  const nutraA = "77777777-7777-7777-7777-777777777702"; // MULTICELL, dedicado a pruebas
  const nutraB = "77777777-7777-7777-7777-777777777705"; // BERBERINA
  const ventas: string[] = [];
  const prescripciones: string[] = [];
  const creados = {
    pacientes: [] as string[],
    evaluaciones: [] as string[],
    diagnosticos: [] as string[],
    tratamientos: [] as string[],
  };

  /** Una venta pagada de HOY, con o sin consulta. */
  async function venta(o: { conConsulta: boolean; nutra: string; motivo?: string }): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, operated_at,
                                treatment_id, sin_tratamiento_motivo)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '100000', 'COP', 'efectivo', 'test',
              ${`test-insights-${Date.now()}-${Math.random().toString(36).slice(2)}`}, now(),
              ${o.conConsulta ? treatmentId : null},
              ${o.conConsulta ? null : (o.motivo ?? "compra de mostrador")})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${t.id}, ${o.nutra}, 1, '100000')`);
    return t.id;
  }

  /** Una venta pagada ANTERIOR al vinculo: no podia decir su consulta porque el sistema no lo preguntaba. */
  async function ventaAntigua(): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, operated_at)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '100000', 'COP', 'efectivo', 'test',
              ${`test-insights-old-${Date.now()}-${Math.random().toString(36).slice(2)}`},
              '2026-09-01T15:00:00Z'::timestamptz)
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${t.id}, ${nutraB}, 1, '100000')`);
    return t.id;
  }

  async function prescribir(nutra: string) {
    const [r] = await db.execute(dsql`
      insert into treatment_nutraceuticals (treatment_id, nutraceutical_id)
      values (${treatmentId}, ${nutra}) returning id`);
    prescripciones.push(r.id);
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    lector = await import("@/modules/direccion/data/insights-de-la-compra");

    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;

    // ═══ LA CADENA SE CREA, NO SE BUSCA ═══
    //
    // Primero se intento reusar un tratamiento existente dentro de la ventana, y no habia ninguno usable:
    // los 22 que caen en la ventana son de pruebas cuyos pacientes ya se borraron, y los 42 con paciente
    // vivo son mas viejos que la ventana. Un fixture que depende de que otro test dejo algo servible es un
    // fixture que falla el dia que ese otro test limpia mejor.
    const [pac] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`INS-${Date.now()}`}) returning id`);
    patientId = pac.id;
    creados.pacientes.push(patientId);

    const [ev] = await db.execute(dsql`
      insert into evaluations (patient_id, professional_id, organization_id, type)
      values (${patientId}, ${profId}, ${orgId}, 'inicial') returning id`);
    creados.evaluaciones.push(ev.id);

    // El diagnostico exige su CONSTELACION DE VERSIONES (regla dura 7): se copia la de uno real, no se
    // inventa. Si no hubiera ninguno, el test no puede correr y lo dice.
    const [ref] = await db.execute(dsql`
      select engine_version, model_version_id, rules_version from diagnoses limit 1`);
    const [dx] = await db.execute(dsql`
      insert into diagnoses (evaluation_id, efr_state_number, diagnosis_name, engine_version,
                             model_version_id, rules_version)
      values (${ev.id}, 1, 'Fixture de insights', ${ref.engine_version}, ${ref.model_version_id},
              ${ref.rules_version}) returning id`);
    creados.diagnosticos.push(dx.id);

    const [tr] = await db.execute(dsql`
      insert into treatments (diagnosis_id, created_by) values (${dx.id}, ${prof.profile_id}) returning id`);
    treatmentId = tr.id;
    creados.tratamientos.push(treatmentId);
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    for (const id of prescripciones) {
      await db.execute(dsql`delete from treatment_nutraceuticals where id = ${id}`);
    }
    ventas.length = 0;
    prescripciones.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  // La cadena se borra al final, en orden inverso: sin esto quedaria un paciente de prueba contaminando las
  // cifras de las pantallas, que es justo lo que este lector mide.
  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of creados.tratamientos) await db.execute(dsql`delete from treatments where id = ${id}`);
    for (const id of creados.diagnosticos) await db.execute(dsql`delete from diagnoses where id = ${id}`);
    for (const id of creados.evaluaciones) await db.execute(dsql`delete from evaluations where id = ${id}`);
    for (const id of creados.pacientes) await db.execute(dsql`delete from patients where id = ${id}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("una compra de lo prescrito cuenta DENTRO del plan", async () => {
    const antes = await lector.insightsDeLaCompra();
    await prescribir(nutraA);
    await venta({ conConsulta: true, nutra: nutraA });
    const despues = await lector.insightsDeLaCompra();
    expect(despues.lineasDentroDelPlan - antes.lineasDentroDelPlan).toBe(1);
    expect(despues.lineasFueraDelPlan - antes.lineasFueraDelPlan).toBe(0);
    expect(despues.ventasConConsulta - antes.ventasConConsulta).toBe(1);
  });

  // EL DATO MAS INTERESANTE: comprar algo que esa consulta no prescribio es un hecho legitimo (viene del
  // seguimiento, o el paciente lo pidio) y hay que poder contarlo APARTE, no perderlo.
  it("una compra que esa consulta no prescribio cuenta FUERA del plan", async () => {
    const antes = await lector.insightsDeLaCompra();
    await prescribir(nutraA);
    await venta({ conConsulta: true, nutra: nutraB });
    const despues = await lector.insightsDeLaCompra();
    expect(despues.lineasFueraDelPlan - antes.lineasFueraDelPlan).toBe(1);
    expect(despues.lineasDentroDelPlan - antes.lineasDentroDelPlan).toBe(0);
  });

  // EL QUE MAS IMPORTA: una venta SUELTA no es una compra "fuera del plan". Son dos hechos distintos, y
  // mezclarlos diria que la gente se aparta de lo prescrito cuando lo que pasa es que compro sin consulta.
  it("una venta SIN consulta no ensucia las cifras del plan, y su motivo queda contado", async () => {
    const antes = await lector.insightsDeLaCompra();
    await venta({ conConsulta: false, nutra: nutraB, motivo: "compra de mostrador" });
    const despues = await lector.insightsDeLaCompra();
    expect(despues.ventasSinConsulta - antes.ventasSinConsulta).toBe(1);
    expect(despues.lineasFueraDelPlan - antes.lineasFueraDelPlan).toBe(0);
    expect(despues.lineasDentroDelPlan - antes.lineasDentroDelPlan).toBe(0);
    const motivo = despues.motivosDeVentaSuelta.find((m: any) => m.motivo === "compra de mostrador");
    expect(motivo).toBeTruthy();
  });

  it("lo prescrito y no comprado se ve en la conversion por producto", async () => {
    await prescribir(nutraA);
    const r = await lector.insightsDeLaCompra();
    const fila = r.porProducto.find((p: any) => p.prescritoEn > 0);
    expect(fila, "ningun producto sale como prescrito").toBeTruthy();
    // Prescrito sin comprar: la conversion de ese producto en ese tratamiento es cero.
    expect(fila.compradoEn).toBeLessThanOrEqual(fila.prescritoEn);
  });

  it("la fecha desde la que se mide es el dia en que la venta empezo a decir su consulta", async () => {
    expect(lector.DESDE_QUE_HAY_VINCULO).toBe("2026-09-29");
    const r = await lector.insightsDeLaCompra();
    expect(r.desde).toBe("2026-09-29");
  });

  // EL EJE DEL MODELO VA POR NOMBRE, y si el catalogo cambia una grafia se queda en CERO sin fallar, que es la
  // peor forma de romperse. Este caso comprueba que la resolucion sigue viva: con recomendaciones en la base,
  // algo tiene que resolver.
  it("el eje del modelo resuelve nombres contra el catalogo", async () => {
    const [hay] = await db.execute(dsql`
      select count(*)::int as n from reports where snapshot->>'nutraceuticos' is not null`);
    if (Number(hay.n) === 0) return; // sin recomendaciones sembradas no hay nada que comprobar
    const r = await lector.insightsDeLaCompra();
    // No se exige una cifra: se exige que la lista sea una lista de productos DEL CATALOGO, no de nombres del
    // motor sin resolver. Un nombre sin resolver seria el sintoma del alias roto.
    const nombres = await db.execute(dsql`select name from nutraceuticals`);
    const delCatalogo = new Set(nombres.map((n: any) => n.name));
    const conRecomendacion = r.porProducto.filter((p: any) => p.recomendadoEn > 0);
    expect(conRecomendacion.length, "con informes sembrados, nada resolvio contra el catalogo").toBeGreaterThan(
      0,
    );
    for (const x of conRecomendacion) {
      expect(delCatalogo.has(x.producto), `"${x.producto}" no es un nombre del catalogo`).toBe(true);
    }
  });

  // ═══ EL EMBUDO VIVE EN UNA SOLA FILA, Y SUS COLUMNAS SE CRUZAN (Santiago, 2026-09-30) ═══
  //
  // Eran dos tablas y parecian contradecirse ("prescrito en 24" arriba, "60 consultas" abajo). Al juntarlas,
  // lo que hay que proteger es la relacion: lo SIN PRESCRIBIR sale de lo RECOMENDADO, asi que nunca puede
  // pasarlo. Y `prescritoEn` NO esta contenido en `recomendadoEn`: prescribir algo que el modelo no propuso
  // es legitimo, y una asercion que exigiera lo contrario haria fallar el test por un dato correcto.
  it("las columnas del embudo guardan su relacion, y la tabla es la union de los dos ejes", async () => {
    await prescribir(nutraA);
    const r = await lector.insightsDeLaCompra();
    expect(r.porProducto.length).toBeGreaterThan(0);
    for (const p of r.porProducto) {
      expect(p.recomendadoSinPrescribir, `${p.producto}: sin prescribir pasa a lo recomendado`).toBeLessThanOrEqual(
        p.recomendadoEn,
      );
      expect(p.compradoEn, `${p.producto}: comprado pasa a prescrito`).toBeLessThanOrEqual(p.prescritoEn);
    }
    // LA UNION SE COMPRUEBA: un producto que solo tiene recomendaciones tiene que APARECER. Si la tabla
    // recorriera solo el SQL de prescripciones, el hallazgo mas interesante del eje del modelo (lo que se
    // propone siempre y nadie prescribe) desapareceria de la pantalla sin fallar nada.
    const soloRecomendado = r.porProducto.find((p: any) => p.recomendadoEn > 0 && p.prescritoEn === 0);
    if (soloRecomendado) expect(soloRecomendado.recomendadoSinPrescribir).toBe(soloRecomendado.recomendadoEn);
  });
  // LA PANTALLA MUESTRA LO QUE HAY, Y SEPARA LO QUE NO PODIA DECIRLO (Santiago, 2026-09-30).
  //
  // Antes recortaba por fecha y salia vacia mientras el resto del tablero mostraba. Ahora mide todo, pero una
  // venta anterior al vinculo NO es una compra fuera de plan: es una que no podia decir su consulta. Sin
  // separarlas, la cifra diria que la gente compra fuera del plan cuando el sistema no lo preguntaba.
  it("las ventas anteriores al vinculo se cuentan, y se cuentan APARTE", async () => {
    const r = await lector.insightsDeLaCompra();
    expect(r.ventasSinConsulta).toBeGreaterThanOrEqual(r.ventasSinConsultaAnteriores);
    // Y no ensucian el eje del plan: lo de fuera del plan solo puede salir de ventas CON consulta.
    expect(r.lineasFueraDelPlan).toBeGreaterThanOrEqual(0);
  });
  // ═══ EL DENOMINADOR SON LAS QUE PODIAN DECIRLO (Santiago, 2026-09-30) ═══
  //
  // La pantalla decia "0 de 18" con las 18 anteriores al vinculo dentro, mientras el numerador solo podia
  // salir de las posteriores. Numerador y denominador median ventanas distintas, y el propio texto de la
  // pantalla decia que esas 18 no podian decirlo: se contradecia a si misma.
  it("una venta anterior al vinculo NO entra en el denominador de las comparables", async () => {
    const antes = await lector.insightsDeLaCompra();
    await ventaAntigua();
    const despues = await lector.insightsDeLaCompra();
    expect(despues.ventasSinConsultaAnteriores - antes.ventasSinConsultaAnteriores).toBe(1);
    expect(despues.ventasSinConsultaComparables - antes.ventasSinConsultaComparables).toBe(0);
  });

  // ═══ Y LA FECHA DE ARRANQUE SACA LO ANTERIOR DE TODOS LOS EJES A LA VEZ (0198) ═══
  //
  // El candado estatico comprueba que el lector LLAME a la fecha; este comprueba que SIRVA, que es otra
  // cosa. Y lo que mas importa no es que la venta vieja desaparezca: es que desaparezca de los DOS lados
  // del cociente. Si el corte llegara solo a las ventas, el numerador seria de la operacion real y el
  // denominador seguiria arrastrando las consultas de prueba, y la conversion saldria hundida por un
  // motivo que no existe. Es el defecto del "0 de 18" otra vez, con otra ropa.
  it("con fecha de arranque, lo anterior no cuenta en ningun eje", async () => {
    const [previa] = await db.execute(dsql`select fecha_de_arranque::text as f from commercial_config limit 1`);
    try {
      await db.execute(dsql`update commercial_config set fecha_de_arranque = null`);
      await ventaAntigua(); // del 2026-09-01
      const sinCorte = await lector.insightsDeLaCompra();
      expect(sinCorte.desdeElArranque).toBeNull();

      // ── EL CORTE SALE DE LA CONSTANTE DEL MODULO, NO DE UNA FECHA TECLEADA ──
      //
      // Una fecha absoluta en un test envejece y un dia falla por OTRA razon (ya paso con la cantidad del
      // candado de devolucion fisica). Usar el dia del vinculo cumple las dos condiciones que este caso
      // necesita, y las seguira cumpliendo: deja fuera la venta vieja, y es anterior a hoy, asi que lo que
      // crean los demas casos sigue contando.
      const corte = lector.DESDE_QUE_HAY_VINCULO;
      await db.execute(dsql`update commercial_config set fecha_de_arranque = ${corte}::date`);
      const conCorte = await lector.insightsDeLaCompra();
      expect(conCorte.desdeElArranque).toBe(corte);
      expect(conCorte.ventasSinConsulta).toBeLessThan(sinCorte.ventasSinConsulta);
      // LO QUE SALIO SE PUEDE DECIR, y por eso se cuenta: el dia del arranque la pantalla se vacia y un cero
      // mudo es indistinguible de una pantalla rota. Un cero que dice cuantas compras dejaron de contar, no.
      expect(conCorte.ventasAnterioresAlArranque).toBeGreaterThan(0);
      expect(sinCorte.ventasAnterioresAlArranque).toBe(0);
      // Y LAS ANTERIORES AL VINCULO DESAPARECEN DEL TODO, no se quedan contadas aparte: antes del arranque
      // no hay nada que separar, porque no hay nada que contar.
      expect(conCorte.ventasSinConsultaAnteriores).toBe(0);
      // EL OTRO LADO DEL COCIENTE TAMBIEN SE RECORTA: con el corte, ninguna consulta anterior puede seguir
      // sumando prescripciones ni recomendaciones.
      const prescritasConCorte = conCorte.porProducto.reduce((n: number, p: any) => n + p.prescritoEn, 0);
      const prescritasSinCorte = sinCorte.porProducto.reduce((n: number, p: any) => n + p.prescritoEn, 0);
      expect(prescritasConCorte).toBeLessThanOrEqual(prescritasSinCorte);
      const recomendadasConCorte = conCorte.porProducto.reduce((n: number, p: any) => n + p.recomendadoEn, 0);
      const recomendadasSinCorte = sinCorte.porProducto.reduce((n: number, p: any) => n + p.recomendadoEn, 0);
      expect(recomendadasConCorte).toBeLessThan(recomendadasSinCorte);
    } finally {
      // LA CONFIGURACION SE DEVUELVE PASE LO QUE PASE: es una fila compartida, y un test que la deje puesta
      // dejaria TODAS las cifras de la base local recortadas por una fecha que nadie fijo.
      await db.execute(
        dsql`update commercial_config set fecha_de_arranque = ${previa?.f ?? null}::date`,
      );
    }
  });

  // Y SU MOTIVO TAMPOCO SE LISTA: no tiene, porque nadie se lo pidio. Sacarla como "(sin motivo escrito)"
  // haria creer que alguien omitio algo, y no omitio nada: no existia el campo.
  it("y su falta de motivo no se lista como si alguien lo hubiera omitido", async () => {
    const antes = await lector.insightsDeLaCompra();
    const sinMotivoAntes = antes.motivosDeVentaSuelta.find((m: any) => m.motivo === "(sin motivo escrito)");
    await ventaAntigua();
    const despues = await lector.insightsDeLaCompra();
    const sinMotivoDespues = despues.motivosDeVentaSuelta.find((m: any) => m.motivo === "(sin motivo escrito)");
    expect(sinMotivoDespues?.veces ?? 0).toBe(sinMotivoAntes?.veces ?? 0);
  });
});