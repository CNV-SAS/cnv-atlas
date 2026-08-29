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
              className="px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70"
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              // EL ACTIVO VA RELLENO EN EL AZUL DE MARCA. La muesca gris que probamos antes se leia plana:
              // marcaba por pertenencia, que es correcto, pero en una barra clara sobre superficie clara la
              // diferencia era demasiado poca para encontrarla de un vistazo. Blanco sobre #205dfd da
              // 5,19:1, que pasa AA para texto normal (no AAA).
              //
              // Y el argumento de que "el azul compite con los botones" NO aplica aqui: no hay ningun boton
              // de accion DENTRO de la barra. Vale para un acento suelto en el contenido, no para la unica
              // superficie azul de una columna de navegacion.
              active
                ? "bg-nav-accent font-semibold text-white"
                : // EL HOVER NO ES UN GRIS: es un tinte del MISMO azul del activo (5%). Asi el reposo
                  // ANTICIPA el destino en vez de solo "encenderse": el item se tiñe de lo que va a ser
                  // cuando lo elijas. Un gris no dice nada, solo confirma que el raton esta encima.
                  "font-medium text-muted-foreground hover:bg-nav-accent/5 hover:text-foreground",
            )}
          >
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

  // El titulo de la seccion sale del item activo, que es la misma resolucion que ya usa el resaltado de la
  // barra: una sola fuente para "donde estoy". Si ninguna coincide (una ruta sin item propio), no se pinta
  // nada en vez de inventar un rotulo.
  const todosLosItems = grupos.flatMap((g) => g.items);
  const tituloSeccion = todosLosItems.find((i) => isNavItemActive(i.href, pathname, todosLosItems))?.label;

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
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
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
                <nav className="flex flex-col gap-0.5 px-3 py-2">
                  <NavGrupos grupos={grupos} pathname={pathname} onNavigate={() => setOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <AtlasLogo />
            </div>
            {/* EL TITULO DE PANTALLA VIVE AQUI, en la franja blanca, no sobre el gris del contenido.
                Es lo que hace su referencia "diseño sobrio" (el "Sales" de la cabecera), y resuelve tres
                cosas de una: el titulo nunca cae sobre el gris (que era la queja), recupera altura en las
                28 pantallas, y sale del `nav-config` que ya existe, asi que no hay trabajo por pantalla.

                Y establece una distincion que se sostiene sola: LA CABECERA DICE DONDE ESTAS (la seccion)
                y EL CONTENIDO DICE QUE MIRAS (el registro). En /pacientes el contenido ya no necesita
                titulo; en /pacientes/[id] la cabecera dice "Pacientes" y el contenido, el nombre. */}
            <h1 className="hidden truncate text-base font-semibold text-foreground lg:block">
              {tituloSeccion}
            </h1>
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
