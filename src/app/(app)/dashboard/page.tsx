import Link from "next/link";
import { CalendarClock, ClipboardList, FileText, Package, Receipt, Wallet } from "lucide-react";

import { Banda } from "@/components/shared/banda";
import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { formatDate } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import { navGroupsForRoles } from "@/components/layout/nav-config";
import { Funcionalidades } from "@/modules/dashboard/components/funcionalidades";
import { getTablero } from "@/modules/dashboard/data/tablero-reader";
import { TaxStatusBanner } from "@/modules/professionals/components/tax-status-banner";

export const metadata = { title: "Tablero - Atlas" };

// Landing del shell. El cierre de sesion vive en el header (avatar). El
// contenido real del tablero llega en bloques posteriores.
//
// ES LA UNICA PANTALLA DONDE LA CABECERA ES UN SALUDO, y no un rotulo: aqui no se dice donde estas (eso
// lo dice la barra lateral), se dice quien entro.
//
// ── LLEVA BANDA, Y VA CON LO MINIMO DENTRO (2026-09-03) ─────────────────────────────────────────────
//
// El Tablero es una de las dos pantallas donde la banda con degradado se gana el sitio: es lo primero que
// se ve al abrir la aplicacion. Se adelanta la FORMA aunque el contenido llegue despues, por decision de
// Santiago.
//
// PERO SOLO EL SALUDO. Nada de cifras ni de accesos inventados mientras no decidamos que va: elegir el
// bloque antes que el contenido es como se llega a un tablero bonito que nadie mira. Lo que va dentro se
// decide listando primero QUE DATOS le ahorran un clic al profesional al entrar (pacientes sin evaluar,
// reportes sin enviar, tratamientos en borrador sin aprobar, la proxima cita de la semana), y despues
// eligiendo la forma. La proxima cita ya esta lista para consultarse: `treatments.proxima_cita` tiene
// escritor (el bloque de Seguimiento) y pantalla.
// EL DINERO SE ESCRIBE EN PESOS ENTEROS. Las comisiones y las ventas no tienen centavos en la practica,
// y una cifra de cabecera con dos decimales se lee peor a distancia, que es como se lee un tablero.
const pesos = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    .format(n);

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTablero();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* Banner de retencion: solo aparece si es un integrante con comision pendiente y datos tributarios
          sin completar. Va en el landing para que lo vea desde su primera venta. Y va ANTES de la banda a
          proposito: es una condicion que bloquea el cobro, asi que no puede quedar debajo del saludo. */}
      <TaxStatusBanner />

      {/* SUBTITULO RECORTADO A LA MITAD UTIL. Decia "Este es tu tablero de Atlas. Las secciones
          disponibles dependen de tu rol": la primera frase repetia el titulo y el nombre de la aplicacion,
          que el usuario tiene delante. La segunda dice algo que la pantalla NO muestra (por que su barra
          lateral tiene unos items y no otros), asi que se queda. */}
      <Banda
        titulo={`Hola, ${user.fullName}`}
        bajada="Las secciones disponibles dependen de tu rol."
      />

      {/* ═══ ARRIBA, LO ACCIONABLE: TIENE UNA COLA Y UN SITIO A DONDE IR ═══

          EL CORTE ES DE SANTIAGO (2026-09-10) y su critica es la que lo define: "el riesgo no es que sea
          muy clinico, es que se llene de numeros que nadie mira. Un tablero con doce metricas se lee
          menos que uno con cuatro".

          Y EL CRITERIO QUE LO CIERRA: cada bloque de aqui arriba es PULSABLE. Una metrica accionable que
          no lleva a ninguna lista es solo un numero con urgencia: le da al profesional el problema y no
          la salida. Si algo no tiene destino, va abajo. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TarjetaMetrica
          icono={ClipboardList}
          rotulo="Pacientes con algo pendiente"
          valor={t.pacientesConPendiente}
          detalle="La lista dice qué le falta a cada uno"
          href="/pacientes"
          acento
        />
        <TarjetaMetrica
          icono={FileText}
          rotulo="Reportes por aprobar"
          valor={t.reportesPorAprobar}
          detalle="En borrador: falta aprobarlos y enviarlos"
          href="/reportes"
          acento
        />

        {/* LAS PROXIMAS CONSULTAS SON UN LISTADO, NO UN NUMERO (Santiago). "3 consultas esta semana" no
            dice a quien ni cuando, asi que obliga a ir a buscarlo: la cifra da el trabajo y no la
            respuesta. Con los nombres y las fechas, el bloque YA es la respuesta. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <CalendarClock className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Próximas consultas
            </span>
            {t.proximasConsultas.length === 0 ? (
              // ═══ EL CERO SE EXPLICA, PARA QUE NO SE LEA COMO SISTEMA ROTO (cuidado (b) de Santiago) ═══
              //
              // No es "no hay datos": la pieza funciona entera (el campo tiene escritor y pantalla en
              // Seguimiento) y hoy nadie ha agendado. Decirlo distingue un cero de USO de un cero de
              // sistema, que es la diferencia entre esperar y reportar un fallo.
              <p className="pt-1 text-sm text-muted-foreground">
                Ninguna agendada todavía. Se llena solo: la próxima cita se fija en la etapa de
                Seguimiento de cada paciente.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 pt-1">
                {t.proximasConsultas.map((c) => (
                  <li key={c.evaluationId}>
                    <Link
                      href={`/ani-bis-e/${c.evaluationId}`}
                      className="flex items-baseline justify-between gap-3 text-sm hover:underline"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {c.paciente}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatDate(c.fecha)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ═══ DEBAJO Y MAS PEQUEÑO, LO INFORMATIVO ═══

          Dice como va el mes, no que hacer hoy. Va con su titulo y con menos peso visual a proposito: si
          se leyera igual que lo de arriba, volveria a ser un tablero de doce cifras.

          Y SON LAS DEL PROFESIONAL, no el agregado de la organizacion: "cuanto facturo CNV" no es su
          pregunta, y meterla aqui le pondria delante un numero sobre el que no puede hacer nada. */}
      <section className="flex flex-col gap-3 pt-2">
        <TituloSeccion>Tu mes</TituloSeccion>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icono: Wallet, rotulo: "Tu comisión", valor: pesos(t.comisionDelMes) },
            { icono: Receipt, rotulo: "Ventas", valor: pesos(t.ventasDelMes) },
            {
              icono: Package,
              rotulo: "Unidades en inventario",
              valor: String(t.unidadesEnInventario),
            },
          ].map((m) => (
            <div
              key={m.rotulo}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <m.icono className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">{m.rotulo}</span>
                <span className="truncate text-base font-semibold tabular-nums text-foreground">
                  {m.valor}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* QUE HAY DETRAS DE CADA ENTRADA DEL MENU (punto 1c). Va al FINAL: es material de la primera
          semana, no del uso diario, y arriba le quitaria sitio a lo que si cambia todos los dias. */}
      <Funcionalidades grupos={navGroupsForRoles(user.roles)} />
    </div>
  );
}
