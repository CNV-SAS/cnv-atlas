import { redirect } from "next/navigation";

// La raiz no tiene contenido propio: el proxy ya manda a /login a quien no
// tiene sesion, y a quien la tiene lo llevamos al tablero.
export default function Home() {
  redirect("/dashboard");
}
