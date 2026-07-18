import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Rutas de atencion: la salida AUTORITATIVA del DFI (no de los predicados sueltos R1-R6). Viven
// en la etapa de Tratamiento (el tratamiento es lo que el profesional arma encima de estas
// rutas). Se leen del snapshot inmutable. Presentacion pura.
export function RutasSection({ rutas }: { rutas: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rutas de atencion</CardTitle>
      </CardHeader>
      <CardContent>
        {rutas.length ? (
          <div className="flex flex-wrap gap-2">
            {rutas.map((r) => (
              <Badge key={r} variant="outline">
                {r}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin rutas activas para este estado.</p>
        )}
      </CardContent>
    </Card>
  );
}
