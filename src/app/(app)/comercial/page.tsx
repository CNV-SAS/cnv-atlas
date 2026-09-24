import { redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { Liquidaciones } from "@/modules/payments/components/liquidaciones";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import {
  hoyEnBogota,
  listarLiquidaciones,
  listarPendientesDeLiquidar,
} from "@/modules/payments/data/liquidacion-writer";
import { liquidarComision } from "@/modules/payments/liquidacion";
import { canViewRevenue } from "@/modules/payments/policies/can-view-revenue";

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

  // La cuenta se hace aquí solo para saber si SE PUEDE liquidar a cada quien (qué datos tributarios le
  // faltan). El cálculo bueno lo rehace el escritor dentro de su transacción, con las filas bloqueadas.
  const conFaltantes = pendientes.map((p) => ({
    professionalId: p.professionalId,
    nombre: p.nombre,
    base: p.base,
    filas: p.filas,
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
    </div>
  );
}
