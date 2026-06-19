import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { CreateNutraceuticalForm } from "@/modules/nutraceuticals/components/create-nutraceutical-form";
import { EditNutraceuticalForm } from "@/modules/nutraceuticals/components/edit-nutraceutical-form";
import { SetStockForm } from "@/modules/nutraceuticals/components/set-stock-form";
import { canManageCatalog } from "@/modules/nutraceuticals/policies/can-manage-catalog";
import { canManageInventory } from "@/modules/nutraceuticals/policies/can-manage-inventory";
import { canViewNutraceuticals } from "@/modules/nutraceuticals/policies/can-view-nutraceuticals";
import * as service from "@/modules/nutraceuticals/services/nutraceuticals-service";

export const metadata = { title: "Nutraceuticos - Atlas" };

// Stock como badge: sin inventario (neutro), 0 (warning), con stock (optimal).
function StockBadge({ stock }: { stock: number | null }) {
  if (stock == null) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Sin inventario
      </Badge>
    );
  }
  const tint =
    stock === 0
      ? "bg-clinical-warning-bg text-clinical-warning"
      : "bg-clinical-optimal-bg text-clinical-optimal";
  return (
    <Badge variant="outline" className={tint}>
      Stock: {stock}
    </Badge>
  );
}

// Catalogo e inventario de nutraceuticos. Lectura admin/soporte/direccion;
// catalogo lo gestiona admin; el stock admin/soporte.
export default async function NutraceuticosPage() {
  const user = await requireUser();
  if (!canViewNutraceuticals(user)) redirect("/no-autorizado");
  const isCatalogManager = canManageCatalog(user);
  const isInventoryManager = canManageInventory(user);

  const items = await service.listCatalogWithStock();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Nutraceuticos</h1>
        <p className="text-muted-foreground">Catalogo e inventario de nutraceuticos.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Catalogo</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay nutraceuticos.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((n) => (
              <Card key={n.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="text-lg">{n.name}</CardTitle>
                      <CardDescription>
                        {n.unit ? `Unidad: ${n.unit}` : "Sin unidad"}
                        {n.unit_price != null
                          ? ` · ${Number(n.unit_price).toLocaleString("es-CO")} COP`
                          : ""}
                      </CardDescription>
                      {n.description ? (
                        <p className="text-sm text-muted-foreground">{n.description}</p>
                      ) : null}
                    </div>
                    <StockBadge stock={n.stock} />
                  </div>
                </CardHeader>
                {isInventoryManager || isCatalogManager ? (
                  <CardContent className="flex flex-col gap-4">
                    {isInventoryManager ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Inventario
                        </span>
                        {/* key: remonta el form al revalidar para que tome el stock nuevo */}
                        <SetStockForm
                          key={`${n.id}-${n.stock ?? "x"}`}
                          nutraceuticalId={n.id}
                          currentStock={n.stock}
                        />
                      </div>
                    ) : null}
                    {isCatalogManager ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Editar nutraceutico
                        </summary>
                        <EditNutraceuticalForm nutraceutical={n} />
                      </details>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      {isCatalogManager ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crear nutraceutico</CardTitle>
            <CardDescription>
              Agrega un nutraceutico al catalogo (su inventario arranca en 0).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateNutraceuticalForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
