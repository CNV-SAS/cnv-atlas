import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { CreateNutraceuticalForm } from "@/modules/nutraceuticals/components/create-nutraceutical-form";
import { EditNutraceuticalForm } from "@/modules/nutraceuticals/components/edit-nutraceutical-form";
import { canManageCatalog } from "@/modules/nutraceuticals/policies/can-manage-catalog";
import { canViewNutraceuticals } from "@/modules/nutraceuticals/policies/can-view-nutraceuticals";
import * as service from "@/modules/nutraceuticals/services/nutraceuticals-service";

export const metadata = { title: "Nutracéuticos - Atlas" };

// El STOCK ya no vive aqui: es un saldo por profesional en consignacion (ver Mi inventario). Esta vista
// es el CATALOGO comercial (admin/soporte): productos + su disponibilidad. La disponibilidad es dato del
// producto (en_consultorio / solo_tienda / no_disponible), distinto del stock (cantidad).
const AVAILABILITY_LABEL: Record<string, string> = {
  en_consultorio: "En consultorio",
  solo_tienda: "Solo en tienda",
  no_disponible: "No disponible",
};

export default async function NutraceuticosPage() {
  const user = await requireUser();
  if (!canViewNutraceuticals(user)) redirect("/no-autorizado");
  const isCatalogManager = canManageCatalog(user);

  const items = await service.listCatalog();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* Cae "Catalogo comercial" (es lo que la pantalla muestra) y queda donde vive el STOCK, que esta
          pantalla NO muestra y es la confusion mas probable de quien llega buscandolo. */}
      <TituloPantalla
        titulo="Nutracéuticos"
        descripcion="El stock es por profesional (consignación), en Mi inventario."
      />

      <section className="flex flex-col gap-3">
        <TituloSeccion>Catalogo</TituloSeccion>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay nutracéuticos.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((n) => (
              <Card key={n.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="text-lg">{n.name}</CardTitle>
                      <CardDescription>
                        {n.serving_size ? `Porcion: ${n.serving_size}` : n.unit ? `Unidad: ${n.unit}` : "Sin unidad"}
                        {n.unit_price != null
                          ? ` · ${Number(n.unit_price).toLocaleString("es-CO")} COP`
                          : ""}
                        {n.sanitary_registration ? ` · ${n.sanitary_registration}` : ""}
                      </CardDescription>
                      {n.indication ? (
                        <p className="text-sm text-muted-foreground">{n.indication}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline">
                      {AVAILABILITY_LABEL[n.commercial_availability] ?? n.commercial_availability}
                    </Badge>
                  </div>
                </CardHeader>
                {isCatalogManager ? (
                  <CardContent>
                    <details>
                      <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Editar nutraceutico
                      </summary>
                      <EditNutraceuticalForm nutraceutical={n} />
                    </details>
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
            <CardTitle className="text-lg">Crear nutracéutico</CardTitle>
            <CardDescription>Agrega un nutracéutico al catalogo.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateNutraceuticalForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
