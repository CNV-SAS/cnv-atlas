"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  MonitorSmartphone,
  Pill,
  Receipt,
  ScrollText,
  ShieldCheck,
  BadgeCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  isNavItemActive,
  type NavGrupoVisible,
  type NavIconKey,
  type NavItem,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/actions";

// Mapeo clave -> icono (lucide-react, libreria unica por BRAND.md). El config de
// nav viaja como datos serializables; el icono se resuelve aqui, en el cliente.
const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  clinica: Stethoscope,
  evaluaciones: ClipboardCheck,
  reportes: FileText,
  comercial: CreditCard,
  comodato: MonitorSmartphone,
  nutraceuticos: Pill,
  pagos: Receipt,
  consentimiento: ScrollText,
  admin: ShieldCheck,
  ia: Sparkles,
  auditoria: History,
  direccion: BarChart3,
  obbia: FlaskConical,
  perfil: UserRound,
  verificacion: BadgeCheck,
};

type ShellUser = { fullName: string; email: string };

// Iniciales para el avatar (sin foto en MVP): primeras letras de hasta dos palabras.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function AtlasLogo() {
  // Con la barra CLARA el logo actual funciona tal cual: no hace falta la version en blanco ni la placa
  // provisional que hizo falta con la barra navy. El obstaculo desaparecio con la disposicion invertida.
  return (
    <Link href="/dashboard" className="flex items-center" aria-label="Atlas, inicio">
      <Image
        src="/brand/logo-horizontal.svg"
        alt="Atlas"
        width={140}
        height={28}
        priority
        unoptimized
        className="h-7 w-auto"
      />
    </Link>
  );
}

function NavGrupos({
  grupos,
  pathname,
  onNavigate,
}: {
  grupos: NavGrupoVisible[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const todos = grupos.flatMap((g) => g.items);
  return (
    <>
      {grupos.map((g) => (
        <div key={g.group ?? "general"} className="flex flex-col gap-0.5">
          {/* EL ROTULO SOLO CUANDO AHORRA. Lo decide `navGroupsForRoles` por el total de items visibles:
              en la lista de ocho de un profesional los rotulos son ruido; en la de dieciseis de un admin
              la lista plana es la que cuesta. `aria-hidden` porque el grupo no es un destino ni un
              control: con lector de pantalla la lista de enlaces ya se recorre bien sin el. */}
          {g.label ? (
            <span
              aria-hidden
              className="px-4 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70"
            >
              {g.label}
            </span>
          ) : null}
          <NavLinks items={g.items} todos={todos} pathname={pathname} onNavigate={onNavigate} />
        </div>
      ))}
    </>
  );
}

function NavLinks({
  items,
  todos,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  /** TODOS los items visibles, no solo los del grupo: `isNavItemActive` desempata por prefijo mas largo
   *  y con una lista parcial marcaria activo un ancestro de otro grupo. */
  todos: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item.href, pathname, todos);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-l-lg py-1.5 pl-4 pr-3 text-sm transition-colors",
              // LA MUESCA. El activo NO lleva bloque ni tinte propio: lleva el GRIS DEL CONTENIDO, con la
              // señal de 3px y el texto en navy. Redondeado solo a la izquierda y sin margen a la derecha,
              // asi que se abre hacia la pagina: se lee como una muesca recortada en la barra por la que
              // asoma el contenido, no como un objeto encima de la barra.
              //
              // POR QUE ASI Y NO UN RECTANGULO OSCURO, que es lo que hace la referencia. Un bloque macizo
              // pesa mucho en una barra de 15 items y arrastra la vista todo el tiempo; el problema no es
              // el tono, es el bloque. Aqui el activo se marca por PERTENENCIA (es la misma superficie que
              // la pagina que estas viendo), no por peso. Navy sobre el gris: 13,67:1.
              active
                ? "bg-surface-sunken font-semibold text-nav-accent"
                : "font-medium text-muted-foreground hover:bg-surface-sunken/60 hover:text-foreground",
            )}
          >
            {/* LA SEÑAL DE 3px: es lo que hace legible la muesca, porque el gris solo es deliberadamente
                sutil. Va como nodo real y no como `before:` con valor arbitrario, por la misma razon que
                el separador de la fila de lista: un valor que el compilador no reconoce no da error,
                simplemente no emite la regla, y el efecto desaparece en silencio.
                SI EN EL SMOKE QUEDA DEMASIADO SUTIL, el arreglo es subir a `w-1.5` o sumar un tinte al
                fondo del activo; no hay que rehacer nada. */}
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-nav-accent"
              />
            ) : null}
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

// Shell adaptativo: sidebar fijo en desktop, hamburguesa + Sheet en movil.
// Recibe los items ya filtrados por rol (la decision de visibilidad la tomo el
// Server Component que lo monta) y un subconjunto serializable del usuario.
export function AppShell({
  user,
  grupos,
  children,
}: {
  user: ShellUser;
  /** Items ya filtrados por rol Y repartidos en grupos: la decision la tomo el Server Component. */
  grupos: NavGrupoVisible[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* Sidebar desktop. FIJA (`sticky top-0`, alto de viewport): en una pantalla larga, perder la
          navegacion al bajar es real, y el panel del nutricionista pasa de las mil lineas. Sin esto, para
          cambiar de seccion habia que subir hasta arriba primero.
          `overflow-y-auto` en el propio aside y no en el nav: si la lista de items crece mas que la
          pantalla (roles con muchos accesos), tiene que poder desplazarse sola sin arrastrar la pagina. */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background lg:flex">
        <div className="flex h-14 items-center px-4">
          <AtlasLogo />
        </div>
        {/* `pl-3 pr-0`: los items llegan al borde derecho de la barra para que la muesca del activo se
            abra hacia el contenido en vez de flotar dentro de la barra. */}
        <nav className="flex flex-1 flex-col gap-0.5 py-2 pl-3 pr-0">
          <NavGrupos grupos={grupos} pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Abrir navegación"
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-background p-0">
                <SheetTitle className="sr-only">Navegación</SheetTitle>
                <div className="flex h-14 items-center px-4">
                  <AtlasLogo />
                </div>
                <nav className="flex flex-col gap-0.5 py-2 pl-3 pr-0">
                  <NavGrupos grupos={grupos} pathname={pathname} onNavigate={() => setOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <AtlasLogo />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Cuenta">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                    {initials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{user.fullName}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={logoutAction}>
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="size-4" aria-hidden />
                    Cerrar sesion
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* EL TECHO DE ANCHO ERA LA CAUSA REAL de que las pantallas se vieran vacias en escritorio: con
            `max-w-7xl` (1280px) en un monitor de 1900 quedaban 620 pixeles muertos, y la lista de
            pacientes se leia como bandeja de correo por el hueco a la derecha, no por la fila.

            NO SE QUITA EL TECHO DEL TODO, que seria el error opuesto: una linea de texto de 1900 pixeles
            es ilegible (el ojo pierde el renglon al volver). 100rem (1600px) usa el monitor sin llegar
            ahi, y la longitud de linea del TEXTO se resuelve donde le corresponde, en el componente que
            lo pinta (`TituloPantalla` acota su descripcion), porque el ancho de lectura es propiedad del
            texto, no de la pagina.

            El padding vertical baja de py-10 (40px) a py-6: 40px de aire sobre el titulo es de pagina de
            marketing, y aqui esa altura es tabla que no se ve. */}
        <main className="flex-1 bg-surface-sunken">
          <div className="mx-auto w-full max-w-[100rem] px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
