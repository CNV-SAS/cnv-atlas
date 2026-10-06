import { redirect } from "next/navigation";

import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { ConsolidadoDeDespachosSection } from "@/modules/payments/components/consolidado-de-despachos";
import { CuentasDistribucion } from "@/modules/payments/components/cuentas-distribucion";
import { Liquidaciones } from "@/modules/payments/components/liquidaciones";
import { MisCuentasDistribucion } from "@/modules/payments/components/mis-cuentas-distribucion";
import { enviosDespachados, enviosPorCoordinar } from "@/modules/payments/data/despachos-reader";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import {
  hoyEnBogota,
  listarLiquidaciones,
  listarPendientesDeLiquidar,
} from "@/modules/payments/data/liquidacion-writer";
import { liquidarComision } from "@/modules/payments/liquidacion";
import { canViewRevenue } from "@/modules/payments/policies/can-view-revenue";
import {
  cortesPorEmitir,
  cuentasParaCnv,
  detalleDeLaCuenta,
  misCuentas,
} from "@/modules/payments/services/distribucion-service";

export const metadata = { title: "Comercial - Atlas" };

// ═══ COMERCIAL: LAS COMISIONES (Bloque 4, la mitad indispensable) ═══
//
// DOS LECTURAS DE LA MISMA PANTALLA, y la diferencia no es cosmética: Dirección ve lo que hay que pagarle a
// cada Integrante y hace el acto de liquidar; el Integrante ve LO SUYO y nada más. Lo que cada quien ve lo
// decide la policy, no un parámetro de la URL.
export default async function ComercialPage() {
  const user = await requireUser();
  const puedeLiquidar = canViewRevenue(user);
  const perfilPropio = await getProfessionalProfileIdByUser(user.id);
  if (!puedeLiquidar && !perfilPropio) redirect("/no-autorizado");

  // El corte es HOY, en hora de Colombia, y lo dice la BASE: el servidor corre en UTC, así que a las 19:00
  // de Bogotá allá ya es el día siguiente y el corte dejaría fuera las comisiones de las últimas horas según
  // a qué hora se pulse el botón. Una fecha elegible se agrega cuando haga falta cerrar un período pasado.
  const hasta = await hoyEnBogota();

  const [pendientes, liquidaciones] = await Promise.all([
    puedeLiquidar ? listarPendientesDeLiquidar(hasta) : Promise.resolve([]),
    listarLiquidaciones(puedeLiquidar ? undefined : (perfilPropio ?? undefined)),
  ]);

  // EL LADO DE DISTRIBUCION. Se lee aparte porque su corte es otro (quincenal) y su direccion es la
  // contraria: aqui CNV COBRA. Quien no tiene nada en Distribucion no ve ninguno de los dos bloques.
  const [cortes, cuentasCnv, mias] = await Promise.all([
    puedeLiquidar ? cortesPorEmitir(hasta) : Promise.resolve([]),
    puedeLiquidar ? cuentasParaCnv() : Promise.resolve([]),
    misCuentas(user.id),
  ]);

  // LOS ENVIOS A DOMICILIO, solo para quien ve el ingreso. YA NO ES UNA CUENTA (2026-10-05): el flete salio
  // de CNV, asi que no hay pago al domiciliario que soportar. Es la cola de lo que hay que coordinar.
  const [envios, enviosHechos] = puedeLiquidar
    ? await Promise.all([enviosPorCoordinar(), enviosDespachados()])
    : [null, null];
  // El DETALLE de cada cuenta propia va completo a la pantalla: sin verlo no se puede objetar "de forma
  // sustentada", que es lo que el modelo exige para que la objecion valga.
  const misCuentasDeDistribucion = await Promise.all(
    mias.map(async (c) => ({
      ...c,
      detalle: ((await detalleDeLaCuenta(c.id))?.detalle ?? []).map((l) => ({
        dia: l.dia,
        producto: l.producto,
        cantidad: l.cantidad,
        baseDescontada: l.baseDescontada,
        iva: l.iva,
        total: l.total,
      })),
    })),
  );

  // La cuenta se hace aquí solo para saber si SE PUEDE liquidar a cada quien (qué datos tributarios le
  // faltan). El cálculo bueno lo rehace el escritor dentro de su transacción, con las filas bloqueadas.
  const conFaltantes = pendientes.map((p) => ({
    professionalId: p.professionalId,
    nombre: p.nombre,
    base: p.base,
    filas: p.filas,
    reversiones: p.reversiones,
    esDePrueba: p.esDePrueba,
    faltantes: liquidarComision({ base: p.base, perfil: p.perfil, acumuladoPrevio: p.acumuladoPrevio })
      .faltantes,
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <TituloPantalla
        titulo="Comercial"
        descripcion={
          puedeLiquidar
            ? "Las comisiones causadas y su liquidación. Liquidar no gira dinero: deja la cuenta hecha, con su IVA y su retención, y marca las comisiones para que no se paguen dos veces. El giro se registra aparte, con su referencia."
            : "Tus comisiones liquidadas, con la cuenta de cada una: lo causado, el IVA si aplica y la retención en la fuente."
        }
      />
      <Liquidaciones
        pendientes={conFaltantes}
        liquidaciones={liquidaciones}
        hasta={hasta}
        puedeLiquidar={puedeLiquidar}
      />

      {/* ═══ EL RECAUDO DE DISTRIBUCION (0188) ═══
          VA EN ESTA MISMA PANTALLA porque es la otra mitad del dinero del Integrante, pero EN SU PROPIO
          BLOQUE y con su propio encabezado: bajo Comisión CNV le PAGA y bajo Distribución le COBRA, y
          mezclar las dos listas es como un administrador termina girando plata que en realidad le deben. */}
      {cortes.length > 0 || cuentasCnv.length > 0 ? (
        <div className="flex flex-col gap-3">
          <TituloSeccion>Distribución: lo que CNV le factura al Integrante</TituloSeccion>
          <CuentasDistribucion cortes={cortes} cuentas={cuentasCnv} hoy={hasta} />
        </div>
      ) : null}

      {envios && enviosHechos ? (
        <ConsolidadoDeDespachosSection porCoordinar={envios} despachados={enviosHechos} />
      ) : null}

      {misCuentasDeDistribucion.length > 0 ? (
        <div className="flex flex-col gap-3">
          <TituloSeccion>Tus cuentas de Distribución</TituloSeccion>
          <MisCuentasDistribucion cuentas={misCuentasDeDistribucion} hoy={hasta} />
        </div>
      ) : null}

    </div>
  );
}
