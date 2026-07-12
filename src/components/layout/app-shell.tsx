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
  Sparkles,
  Stethoscope,
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
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
      {/* Sidebar desktop */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center px-6">
          <AtlasLogo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4 py-4">
          <NavLinks items={navItems} pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Abrir navegacion"
                >
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Navegacion</SheetTitle>
                <div className="flex h-16 items-center px-6">
                  <AtlasLogo />
                </div>
                <nav className="flex flex-col gap-1 px-4 py-4">
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

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
