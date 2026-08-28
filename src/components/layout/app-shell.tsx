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
import { isNavItemActive, type NavIconKey, type NavItem } from "@/components/layout/nav-config";
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

function AtlasLogo({ sobreOscuro = false }: { sobreOscuro?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center" aria-label="Atlas, inicio">
      {/* PLACA CLARA DETRAS DEL LOGO: ANDAMIO TEMPORAL, no una decision de diseño.
          El wordmark es una imagen RASTERIZADA embebida en el SVG con filtros de color, asi que no se
          puede recolorear por CSS: sobre el navy quedaria ilegible. Falta la version en blanco, que es
          pieza de marca y la decide Santiago. Hasta entonces, la placa deja JUZGAR LA BARRA sin que el
          logo estorbe la lectura, que es justo para lo que existe. Cuando llegue el logo en blanco,
          `sobreOscuro` deja de pintar placa y solo cambia la fuente de la imagen. */}
      {sobreOscuro ? (
        <span className="rounded-lg bg-white px-2.5 py-1.5">
          <Image
            src="/brand/logo-horizontal.svg"
            alt="Atlas"
            width={140}
            height={28}
            priority
            unoptimized
            className="h-6 w-auto"
          />
        </span>
      ) : (
        <Image
          src="/brand/logo-horizontal.svg"
          alt="Atlas"
          width={140}
          height={28}
          priority
          unoptimized
          className="h-7 w-auto"
        />
      )}
    </Link>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item.href, pathname, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg py-1.5 pl-4 pr-3 text-sm transition-colors",
              // SOBRE LA SUPERFICIE OSCURA, el activo se distingue por CONTRASTE, no por tono: blanco
              // pleno sobre un velo del 10%. El inactivo va al 70% de blanco, que sobre este navy da
              // 7,82:1 (el mismo inactivo sobre el azul de marca puro no llegaba a AA: 4,20:1).
              active
                ? "bg-white/10 font-semibold text-white"
                : "font-medium text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            {/* LA SEÑAL DE 3px, y es la pieza que mas rinde de esta direccion: el azul de marca SEÑALA
                sin COLOREAR una superficie. Va como nodo real y no como `before:` con valor arbitrario,
                por la misma razon que el separador de la fila de lista: un valor que el compilador no
                reconoce no da error, simplemente no emite la regla, y desaparece en silencio. */}
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-nav-accent"
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
  navItems,
  children,
}: {
  user: ShellUser;
  navItems: NavItem[];
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
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-sidebar-top to-sidebar-bottom lg:flex">
        <div className="flex h-14 items-center px-4">
          <AtlasLogo sobreOscuro />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          <NavLinks items={navItems} pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface-sunken px-4 lg:px-6">
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
              <SheetContent side="left" className="w-64 border-0 bg-gradient-to-b from-sidebar-top to-sidebar-bottom p-0 text-white">
                <SheetTitle className="sr-only">Navegación</SheetTitle>
                <div className="flex h-14 items-center px-4">
                  <AtlasLogo sobreOscuro />
                </div>
                <nav className="flex flex-col gap-0.5 px-3 py-2">
                  <NavLinks
                    items={navItems}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
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
        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-[100rem] px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
