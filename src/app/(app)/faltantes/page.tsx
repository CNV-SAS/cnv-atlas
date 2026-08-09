import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { hasRole, requireUser } from "@/modules/auth/session";
import { ClasificarFaltanteForm } from "@/modules/nutraceuticals/components/clasificar-faltante-form";
import { ConfirmarFaltanteForm } from "@/modules/nutraceuticals/components/confirmar-faltante-form";
import { ResolverSobranteForm } from "@/modules/nutraceuticals/components/resolver-sobrante-form";
import { RemesasCnvSection } from "@/modules/nutraceuticals/components/remesas-cnv-section";
import { canSeeRemesasCnv } from "@/modules/nutraceuticals/policies/can-declarar-remesa";
import { canResolveSobrante, canSeeFaltanteQueue } from "@/modules/nutraceuticals/policies/can-review-faltante";
import { getFaltanteQueue, getPendingSobrantes, type FaltanteQueueRow } from "@/modules/nutraceuticals/services/faltante-service";
import {
  getEligibleProfessionalsForRemesa,
  getRemesableProducts,
  getRemesasForCnv,
  getUnbackedReceptionsForCnv,
} from "@/modules/nutraceuticals/services/remesa-service";

export const metadata = { title: "Revisión de inventario - Atlas" };

const CATEGORY_LABEL: Record<string, string> = {
  hurto_denuncia: "Hurto o robo (con denuncia)",
  transporte_documentado: "Daño o pérdida en transporte",
  venta_no_registrada: "Venta no registrada",
  devolucion_guia: "Devolución a CNV",
};

function money(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-CO")}` : v;
}
function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// Encabezado comun del caso: producto, integrante, valor, y el contexto de REINCIDENCIA (injustificados de
// ese integrante en 6 meses), que importa para clasificar, no solo para reportar.
function CaseHead({ c }: { c: FaltanteQueueRow }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">
            {c.nutraceuticalName} · faltan {c.quantity}
            {c.lote ? ` · lote ${c.lote}` : ""}
          </span>
          <span className="text-xs text-muted-foreground">
            {c.integranteName || "Integrante"} · valor {money(c.sealedTotal)} · reportado {fmtDate(c.reportedAt)}
          </span>
        </div>
        {c.reincidencia > 0 ? (
          <Badge variant="outline" className={c.reincidencia >= 3 ? "border-clinical-critical text-clinical-critical" : "font-normal"}>
            {c.reincidencia} injustificado(s) en 6 meses{c.reincidencia >= 3 ? " · reincidencia" : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal">Primer faltante (6 meses)</Badge>
        )}
      </div>
      {c.reincidencia >= 3 ? (
        <p className="text-xs text-clinical-critical">
          Tres o más injustificados en seis meses: además de clasificar este caso, CNV debería revisar las
          condiciones de consignación de este integrante (decisión de negocio, fuera del sistema).
        </p>
      ) : null}
    </div>
  );
}

export default async function FaltantesPage() {
  const user = await requireUser();
  const seeFaltantes = canSeeFaltanteQueue(user);
  const seeRemesas = canSeeRemesasCnv(user);
  // La pantalla reúne dos familias de "inventario que CNV revisa": faltantes (admin/dirección) y remesas
  // (admin/soporte). Se entra si se puede ver alguna; cada sección se gatea por su propia policy.
  if (!seeFaltantes && !seeRemesas) redirect("/no-autorizado");
  const isAdmin = hasRole(user, "admin");
  const isDireccion = hasRole(user, "direccion");

  const queue = seeFaltantes ? await getFaltanteQueue({ admin: isAdmin, direccion: isDireccion }) : [];
  const porRevisar = queue.filter((c) => c.status === "en_revision");
  const vencidos = queue.filter((c) => c.status === "reportado" && c.expired);
  const esperandoIntegrante = queue.filter((c) => c.status === "reportado" && !c.expired);
  const porConfirmar = queue.filter((c) => c.status === "injustificado_pendiente");
  const sobrantes = canResolveSobrante(user) ? await getPendingSobrantes() : [];

  // Lado remesa (admin/soporte). Se carga solo si el rol lo ve.
  const [remesas, unbacked, remesaProfs, remesaProducts] = seeRemesas
    ? await Promise.all([
        getRemesasForCnv(),
        getUnbackedReceptionsForCnv(),
        getEligibleProfessionalsForRemesa(),
        getRemesableProducts(),
      ])
    : [[], [], [], []];
  // Tiempo de request (página dinámica) para la antigüedad de las remesas sin confirmar.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Revisión de inventario</h1>
        <p className="max-w-prose text-muted-foreground">
          Inventario en consignación que CNV revisa: remesas (envíos a los integrantes) y faltantes. El cargo
          por un faltante injustificado exige dos: un administrador lo propone y dirección lo confirma. Nada se
          cobra hasta que ambos estén de acuerdo.
        </p>
      </header>

      {seeRemesas ? (
        <RemesasCnvSection
          remesas={remesas}
          unbacked={unbacked}
          professionals={remesaProfs}
          products={remesaProducts}
          nowMs={nowMs}
        />
      ) : null}

      {isAdmin ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Por revisar</h2>
            {porRevisar.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay justificaciones por revisar.</p>
            ) : (
              porRevisar.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <CaseHead c={c} />
                  <p className="text-sm text-foreground">
                    Justificación: {CATEGORY_LABEL[c.justificationCategory ?? ""] ?? "-"}
                    {c.justificationReference ? ` · ref. ${c.justificationReference}` : ""}
                  </p>
                  <ClasificarFaltanteForm caseId={c.id} mode="revision" />
                </div>
              ))
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Vencidos sin justificar</h2>
            {vencidos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay casos vencidos.</p>
            ) : (
              vencidos.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-clinical-warning/40 bg-clinical-warning-bg p-4">
                  <CaseHead c={c} />
                  <p className="text-sm text-clinical-warning">
                    El plazo venció ({fmtDate(c.deadlineAt)}) sin justificación. Solo se puede proponer injustificado.
                  </p>
                  <ClasificarFaltanteForm caseId={c.id} mode="vencido" />
                </div>
              ))
            )}
          </section>

          {esperandoIntegrante.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-bold tracking-tight">Esperando al integrante</h2>
              <p className="text-sm text-muted-foreground">
                El integrante aún tiene plazo para justificar; no requieren tu acción todavía.
              </p>
              {esperandoIntegrante.map((c) => (
                <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-border p-4 opacity-80">
                  <CaseHead c={c} />
                  <span className="text-xs text-muted-foreground">Vence {fmtDate(c.deadlineAt)}</span>
                </div>
              ))}
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight">Sobrantes por revisar</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Un conteo arrojó MÁS de lo que el sistema tenía. No es una deuda ni tiene plazo: es información,
              significa que algo no se registró (una recepción, o un despacho que no ocurrió). Ajusta el saldo
              con el motivo; no lo cierres sin la razón.
            </p>
            {sobrantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay sobrantes por revisar.</p>
            ) : (
              sobrantes.map((s) => (
                <div key={s.countLineId} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <span className="text-sm text-foreground">
                    {s.nutraceuticalName} · sobran {s.extra} · {s.integranteName || "Integrante"} · contado {fmtDate(s.countedAt)}
                  </span>
                  <ResolverSobranteForm countLineId={s.countLineId} />
                </div>
              ))
            )}
          </section>
        </>
      ) : null}

      {isDireccion ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Esperando tu confirmación</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Un administrador propuso estos como injustificados. Al confirmar, el cargo entra en la liquidación
            del período. Puedes rechazarlo: el caso queda sin cargo.
          </p>
          {porConfirmar.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cargos por confirmar.</p>
          ) : (
            porConfirmar.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <CaseHead c={c} />
                <p className="text-sm text-foreground">
                  Justificación presentada: {CATEGORY_LABEL[c.justificationCategory ?? ""] ?? "ninguna"}
                  {c.justificationReference ? ` · ref. ${c.justificationReference}` : ""}
                </p>
                <ConfirmarFaltanteForm caseId={c.id} />
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}
