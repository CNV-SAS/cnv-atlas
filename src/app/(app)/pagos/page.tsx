import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import * as nutraService from "@/modules/nutraceuticals/services/nutraceuticals-service";
import {
  CreateCheckoutForm,
  type CheckoutNutraceutical,
  type CheckoutPatient,
} from "@/modules/payments/components/create-checkout-form";
import { listSelectablePatients, listTransactions } from "@/modules/payments/data/payments-repository";
import { canCreateCheckout } from "@/modules/payments/policies/can-create-checkout";
import { canViewRevenue } from "@/modules/payments/policies/can-view-revenue";
import type { TransactionStatus, TransactionWithItems } from "@/modules/payments/types";

export const metadata = { title: "Pagos - Atlas" };

// Estado de la transaccion como badge con los tintes clinicos reutilizados.
const STATUS_META: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-clinical-warning-bg text-clinical-warning" },
  paid: { label: "Pagado", className: "bg-clinical-optimal-bg text-clinical-optimal" },
  failed: { label: "Fallido", className: "bg-clinical-critical-bg text-clinical-critical" },
  refunded: { label: "Reembolsado", className: "bg-muted text-muted-foreground" },
};

function TxStatusBadge({ status }: { status: TransactionStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function itemsLabel(tx: TransactionWithItems): string {
  if (tx.transaction_items.length === 0) return "Sin items";
  return tx.transaction_items
    .map((it) => `${it.nutraceuticals?.name ?? "Nutraceutico"} x${it.quantity}`)
    .join(", ");
}

// Pagos: crear checkout de nutraceuticos (professional/admin) y ver el historial de
// transacciones (la RLS filtra: el profesional ve las suyas, admin/direccion todas).
export default async function PagosPage() {
  const user = await requireUser();
  const canCreate = canCreateCheckout(user);
  const canView = canViewRevenue(user);
  if (!canCreate && !canView) redirect("/no-autorizado");

  const transactions = await listTransactions();

  let patients: CheckoutPatient[] = [];
  let nutraceuticals: CheckoutNutraceutical[] = [];
  if (canCreate) {
    const [pts, catalog] = await Promise.all([
      listSelectablePatients(),
      nutraService.listCatalogWithStock(),
    ]);
    patients = pts;
    nutraceuticals = catalog
      .filter((n) => n.unit_price != null)
      .map((n) => ({ id: n.id, name: n.name, unitPrice: Number(n.unit_price) }));
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Pagos</h1>
        <p className="text-muted-foreground">
          Checkout de nutraceuticos y seguimiento de transacciones.
        </p>
      </header>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crear checkout</CardTitle>
            <CardDescription>
              Genera un link de pago (vale 24 horas) para que el paciente pague en Wompi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCheckoutForm patients={patients} nutraceuticals={nutraceuticals} />
          </CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Transacciones</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay transacciones.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((tx) => (
              <Card key={tx.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="text-base">
                        {Number(tx.amount).toLocaleString("es-CO")} {tx.currency}
                      </CardTitle>
                      <CardDescription>{itemsLabel(tx)}</CardDescription>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("es-CO")}
                        {tx.alegra_invoice_id ? ` · Factura Alegra ${tx.alegra_invoice_id}` : ""}
                      </span>
                    </div>
                    <TxStatusBadge status={tx.status} />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
