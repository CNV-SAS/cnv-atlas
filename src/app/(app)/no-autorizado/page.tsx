export const metadata = { title: "No autorizado - Atlas" };

// Pagina a la que se redirige cuando una policy niega el acceso a una ruta. El
// usuario tiene sesion valida, pero no el permiso. UI minima (B2).
export default function NoAutorizadoPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-6">
      <h1 className="text-xl font-semibold">No autorizado</h1>
      <p>No tienes permiso para ver esta seccion.</p>
    </main>
  );
}
