import { Boxes, TriangleAlert, Users, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { Panel } from "@/components/shared/panel";
import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";
import { canAccessAdmin } from "@/modules/auth/policies/can-access-admin";
import { requireUser } from "@/modules/auth/session";
import { leerIntegrante } from "@/modules/payments/data/integrante-reader";
import { leerModalidad } from "@/modules/payments/data/modalidad-writer";
import { ModalidadDelIntegrante } from "@/modules/payments/components/modalidad-del-integrante";

export const metadata = { title: "Integrante - Atlas" };

// ═══ LA OPERACION DE UN INTEGRANTE, VISTA DESDE ADMIN (Santiago, 2026-09-25) ═══
//
// EXISTE PARA PODER VERIFICAR. Del smoke acumulado: "no hay forma de mirarlo desde admin: inventario actual,
// ventas, pacientes. Sin eso no se puede verificar nada de inventario ni de ventas." Cada cifra que se mueve
// (una venta, una devolución, un faltante) se comprobaba entrando con la cuenta del integrante.
//
// SOLO SE MIRA, NO SE TOCA: ningún botón cambia nada. Lo que hay que corregir se corrige por el camino que ya
// existe para corregirlo, con su rastro. Una pantalla de dirección que además editara el inventario de otro
// sería una segunda puerta al mismo dato, sin los controles de la primera.
//
// NO ES UNA SEGUNDA LISTA DE USUARIOS: se entra desde /admin, que ya los lista. Duplicar la lista habría
// dejado dos sitios que dicen quién es integrante, y el segundo se desactualiza.

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const ESTADO_DE_VENTA: Record<string, string> = {
  pending: "Pendiente de pago",
  paid: "Pagada",
  failed: "Fallida",
  refunded: "Devuelta",
};

const MEDIO: Record<string, string> = {
  wompi: "Pasarela",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const ESTADO_DE_FALTANTE: Record<string, string> = {
  reportado: "Reportado, esperando su justificación",
  en_revision: "Justificado, esperando clasificación de CNV",
  injustificado_pendiente: "Propuesto injustificado, esperando a Dirección",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });

export default async function IntegrantePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessAdmin(user)) redirect("/no-autorizado");

  const { id } = await params;
  const [integrante, modalidad] = await Promise.all([leerIntegrante(id), leerModalidad(id)]);
  if (!integrante) redirect("/admin");


  const profesion =
    PROFESSION_LABELS[integrante.profesion as keyof typeof PROFESSION_LABELS] ?? integrante.profesion;
  const unidades = integrante.inventario.reduce((suma, f) => suma + f.cantidad, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <TituloPantalla
        titulo={integrante.nombre}
        descripcion={`${profesion} · ${integrante.correo}. Lo que hay en su vitrina, lo que ha vendido y lo que se le debe. Esta pantalla solo muestra: para corregir algo, usa el camino que corresponda.`}
      />

      {/* LAS CUATRO CIFRAS VAN EN LA TARJETA COMPARTIDA, no en divs propios. Las hice a mano y salieron sin
          fondo sobre el gris del layout, que es el mismo defecto que ya habia aparecido en la pantalla de
          responder la encuesta. La tarjeta trae su superficie, y con ella la regla de cuando una cifra se
          enciende: solo la que pide trabajo. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica rotulo="Unidades en custodia" valor={unidades} icono={Boxes} detalle="En su vitrina ahora" />
        <TarjetaMetrica rotulo="Pacientes asignados" valor={integrante.pacientes} icono={Users} />
        <TarjetaMetrica
          rotulo="Margen pendiente"
          valor={pesos(integrante.comision.pendiente)}
          icono={Wallet}
          detalle="Sin liquidar"
          href="/comercial"
        />
        <TarjetaMetrica
          rotulo="Faltantes abiertos"
          valor={integrante.faltantesAbiertos.length}
          icono={TriangleAlert}
          acento
          href="/faltantes"
        />
      </section>

      {/* ═══ LA MODALIDAD ═══ Va en esta pantalla y no en una propia: es un dato DE ESTE INTEGRANTE, y aqui es
          donde se mira todo lo suyo. Una pantalla aparte para un solo dato obligaria a saber que existe. */}
      <Panel titulo="Modalidad de consignación">
        <ModalidadDelIntegrante
          professionalId={id}
          modalidad={modalidad.modalidad}
          rigeDesde={modalidad.rigeDesde}
          pendiente={modalidad.pendiente}
          proximoCorte={modalidad.proximoCorte}
          puedeCambiar
        />
      </Panel>

      {/* ═══ INVENTARIO ═══ Por lote y ubicación, no agregado por producto: cuando una cifra no cuadra, lo que
          hay que ver es de qué lote salió, y si lo que quedó está en la vitrina o en la cuarentena. */}
      <Panel titulo="Inventario actual">
        {integrante.inventario.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene producto en custodia.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {integrante.inventario.map((f) => (
              <li
                key={`${f.producto}-${f.lote}-${f.ubicacion}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2"
              >
                <span>
                  {f.producto} <span className="text-muted-foreground">· lote {f.lote}</span>
                  <span className="text-muted-foreground"> · {f.ubicacion}</span>
                  {!f.vendible ? <span className="text-amber-700"> · no vendible</span> : null}
                </span>
                <span className="tabular-nums">{f.cantidad}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ═══ VENTAS ═══ Las últimas 30, con su estado de pago y de inventario. El estado de inventario es lo
          que deja ver una venta cobrada cuyo producto todavía no salió del saldo. */}
      <Panel titulo="Sus ventas">
        {integrante.ventas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene ventas registradas.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {integrante.ventas.map((v) => (
              <li key={v.id} className="flex flex-col gap-1 border-b pb-2">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{fecha(v.fecha)}</span>
                  <span className="tabular-nums">{pesos(v.total)}</span>
                </span>
                <span className="text-muted-foreground">
                  {ESTADO_DE_VENTA[v.estado] ?? v.estado} · {MEDIO[v.medio] ?? v.medio}
                  {v.inventario ? ` · inventario: ${v.inventario}` : ""}
                </span>
                {v.productos ? <span className="text-muted-foreground">{v.productos}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ═══ COMISION ═══ Causada, liquidada y pendiente. Las reversiones son filas negativas, así que una
          devolución se ve aquí como una causada más baja, sin que nada se haya borrado. */}
      <Panel titulo="Margen causado">
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex justify-between border-b pb-2">
            <span>Causada, neta de reversiones</span>
            <span className="tabular-nums">{pesos(integrante.comision.causada)}</span>
          </li>
          <li className="flex justify-between border-b pb-2">
            <span>Ya liquidada</span>
            <span className="tabular-nums">{pesos(integrante.comision.liquidada)}</span>
          </li>
          <li className="flex justify-between border-b pb-2">
            <span className="font-medium">Pendiente de liquidar</span>
            <span className="font-medium tabular-nums">{pesos(integrante.comision.pendiente)}</span>
          </li>
        </ul>
      </Panel>

      {integrante.faltantesAbiertos.length > 0 ? (
        <Panel titulo="Faltantes abiertos">
          <ul className="flex flex-col gap-2 text-sm">
            {integrante.faltantesAbiertos.map((f) => (
              <li key={`${f.producto}-${f.reportado}`} className="flex flex-col gap-1 border-b pb-2">
                <span>
                  {f.producto} <span className="tabular-nums">x{f.unidades}</span>
                </span>
                <span className="text-muted-foreground">
                  {ESTADO_DE_FALTANTE[f.estado] ?? f.estado} · desde {fecha(f.reportado)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
