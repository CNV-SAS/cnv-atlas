import { logoutAction } from "@/modules/auth/actions";

export const metadata = { title: "Panel - Atlas" };

// Landing minima (B2). El shell con marca llega en B3.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Atlas</h1>
      <p>Sesion iniciada.</p>
      <form action={logoutAction}>
        <button type="submit" className="border p-2">
          Cerrar sesion
        </button>
      </form>
    </main>
  );
}
