import { Boxes, Receipt, TriangleAlert, Users, Wallet } from "lucide-react";
import { pieDeLoVendido } from "@/modules/payments/cobro-reconocido";
import { redirect } from "next/navigation";

import { Panel } from "@/components/shared/panel";
import { PacientesDelIntegrante } from "@/modules/patients/components/pacientes-del-integrante";
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
  // LA CIFRA NO CUENTA LOS PRODUCTOS DE PRUEBA, LA LISTA SI LOS MUESTRA (Santiago, 2026-09-30).
  //
  // Decia 112 mientras la tarjeta del propio Inicio de Demo decia 88, porque esa si los excluye. Dos cifras
  // del mismo hecho, y esta es justo la pantalla que se mira cuando algo no cuadra. Es la regla de
  // `patients/de-prueba.ts`: capa 1 fuera de las cifras, capa 3 visible y marcado donde se trabaja.
  const unidades = integrante.inventario
    .filter((f) => !f.esDePrueba)
    .reduce((suma, f) => suma + f.cantidad, 0);
  const pacientesDePrueba = integrante.listaDePacientes.filter((p) => p.esDePrueba).length;
  const unidadesDePrueba = integrante.inventario
    .filter((f) => f.esDePrueba)
    .reduce((suma, f) => suma + f.cantidad, 0);

  // ═══ EL ANCHO (Santiago, 2026-10-01) ═══
  //
  // `max-w-3xl` venia de cuando esta pantalla eran tres tarjetas y dos listas cortas. Con cinco tarjetas y
  // cuatro paneles se veia apeñuscada, y la cifra de dinero no cabia en su tarjeta. Sube a 5xl: suficiente
  // para que respiren, y todavia acotado para que los parrafos no queden en lineas larguisimas, que es para
  // lo que existe el tope.
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <TituloPantalla
        titulo={integrante.nombre}
        descripcion={`${profesion} · ${integrante.correo}. Lo que hay en su vitrina, lo que ha vendido y lo que se le debe. Esta pantalla solo muestra: para corregir algo, usa el camino que corresponda.`}
      />

      {/* LAS CUATRO CIFRAS VAN EN LA TARJETA COMPARTIDA, no en divs propios. Las hice a mano y salieron sin
          fondo sobre el gris del layout, que es el mismo defecto que ya habia aparecido en la pantalla de
          responder la encuesta. La tarjeta trae su superficie, y con ella la regla de cuando una cifra se
          enciende: solo la que pide trabajo. */}
      {/* TRES COLUMNAS Y NO CUATRO: con cinco tarjetas, cuatro columnas deja una sola en la segunda fila y
          aprieta las cinco. En tres quedan 3 + 2 y cada una tiene ancho para su cifra. */}
      {/* ═══ LO QUE EXPLICA LAS CIFRAS DE ABAJO (Santiago, 2026-10-01) ═══

          Su historial dice 3.542.000 y /direccion dice 0 de las mismas ventas. Las dos son ciertas y miden
          cosas distintas; sin esta linea, verlas juntas se lee como un defecto. Es la misma regla que ya
          arreglo el tablero de admin: el rotulo manda, y cuando dos rotulos se cruzan hay que decirlo. */}
      {integrante.esDePrueba ? (
        <p className="max-w-prose rounded-lg border border-attention bg-attention-bg p-3 text-sm text-foreground">
          <strong>Es una cuenta de demostración.</strong> Lo que sigue es su historial completo y es cierto,
          pero nada de esto cuenta en las cifras de la organización ni se factura: por eso /dirección puede
          decir cero sobre estas mismas ventas. Sus pacientes también quedan fuera, sin que nadie los marque.
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TarjetaMetrica
          rotulo="Unidades en custodia"
          valor={unidades}
          icono={Boxes}
          detalle={
            unidadesDePrueba > 0
              ? `En su vitrina ahora · sin ${unidadesDePrueba} de productos de prueba`
              : "En su vitrina ahora"
          }
        />
        <TarjetaMetrica
          rotulo="Lo que ha vendido"
          valor={pesos(integrante.vendido.total)}
          icono={Receipt}
          detalle={pieDeLoVendido(integrante.vendido)}
        />
        {/* EL MARGEN CAUSADO ES EL TOTAL HISTORICO de su comision, y hasta hoy solo se veia el PENDIENTE en
            las tarjetas: "cuanta comision ha generado" obligaba a bajar al panel del margen. */}
        <TarjetaMetrica
          rotulo="Margen generado"
          valor={pesos(integrante.comision.causada)}
          icono={Wallet}
          detalle="En toda su historia, neto de reversiones"
        />
        {/* EL PIE DICE CUANTOS NO CUENTAN, en vez de dejar que la cifra lo esconda. Antes esta tarjeta
            excluia los de prueba y decia "0" al lado de 22 ventas: la pantalla se contradecia. */}
        <TarjetaMetrica
          rotulo="Pacientes asignados"
          valor={integrante.pacientes}
          icono={Users}
          detalle={
            pacientesDePrueba > 0
              ? `${pacientesDePrueba} no cuentan en las cifras (de prueba)`
              : undefined
          }
        />
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

      {/* ═══ SUS PACIENTES, PARA PODER MARCAR LOS DE PRUEBA (Santiago, 2026-10-01) ═══

          Va ANTES del inventario y de las ventas a proposito: marcar un paciente cambia lo que esas dos
          secciones cuentan, asi que leerlo primero explica las cifras de abajo. */}
      <Panel titulo="Sus pacientes">
        <PacientesDelIntegrante pacientes={integrante.listaDePacientes} />
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
                  {/* MARCADO, NO ESCONDIDO: esconderlo es como alguien lo confunde con producto real. */}
                  {f.esDePrueba ? <span className="text-muted-foreground"> · de prueba</span> : null}
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
                  <span>
                    {fecha(v.fecha)}
                    {/* ═══ MARCADAS, NO ESCONDIDAS (Santiago, 2026-10-03) ═══

                        En /pagos estas ventas se ocultan (con su interruptor y su contador), porque esa lista
                        es el registro de lo que se cobró. Aquí NO: esta pantalla es el historial de una
                        persona, y una venta que desaparece sin dejar rastro es peor que una marcada. Lo que
                        las excluye son sus cifras de arriba, que ya lo dicen. Misma regla que su lista de
                        pacientes y que la de productos en el inventario. */}
                    {v.esDePrueba ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        De prueba · no cuenta en las cifras
                      </span>
                    ) : null}
                  </span>
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
