"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isNavItemActive,
  type NavGrupoVisible,
  type NavIconKey,
  type NavItem,
} from "@/components/layout/nav-config";
import { alternarNavColapsada, useNavColapsada } from "@/components/layout/usar-nav-colapsada";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/actions";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

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

function AtlasLogo({ compacto = false }: { compacto?: boolean }) {
  // Con la barra CLARA el logo actual funciona tal cual: no hace falta la version en blanco ni la placa
  // provisional que hizo falta con la barra navy. El obstaculo desaparecio con la disposicion invertida.
  //
  // "ATLAS CNV" (Santiago, 2026-09-09), mismo patron que el "Pacientes" de la encuesta: logo + rotulo al
  // lado, no una imagen nueva. Las dos superficies quedan nombradas y se distinguen entre si, que es lo
  // que faltaba: quien ve una captura sabe si esta mirando la app del profesional o la del paciente.
  //
  // EL ROTULO NO ENTRA EN EL `aria-label`: el enlace ya se anuncia como "Atlas CNV, inicio" leyendo el
  // texto, y repetirlo lo haria decirlo dos veces.
  return (
    <Link href="/dashboard" className="flex items-center gap-2" aria-label="Atlas CNV, inicio">
      {/* COLAPSADA, EL LOGO SE RECORTA A SU MARCA. Con 64 px de ancho no cabe el horizontal, y dejarlo
          entrar lo aplastaria: se ancla a la izquierda y se recorta, que conserva el simbolo. El rotulo
          "CNV" sale, porque a ese tamaño seria una silaba suelta. */}
      <Image
        src="/brand/logo-horizontal.svg"
        alt=""
        width={140}
        height={28}
        priority
        unoptimized
        className={compacto ? "h-7 w-8 max-w-none object-cover object-left" : "h-7 w-auto"}
      />
      {compacto ? null : (
        <span className="text-lg font-semibold tracking-tight text-muted-foreground">CNV</span>
      )}
    </Link>
  );
}

function NavGrupos({
  grupos,
  pathname,
  onNavigate,
  colapsada = false,
}: {
  grupos: NavGrupoVisible[];
  pathname: string;
  onNavigate?: () => void;
  colapsada?: boolean;
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
          {/* COLAPSADA, EL ROTULO DEL GRUPO SE VUELVE UNA LINEA. No cabe, y abreviarlo seria inventar
              siglas; la linea conserva lo unico que el rotulo aportaba ahi, que es que el grupo empieza.
              No va en el primero, que no separa de nada. */}
          {g.label ? (
            colapsada ? (
              <span aria-hidden className="mx-3 my-2 border-t border-border" />
            ) : (
              <span
                aria-hidden
                className="px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/70"
              >
                {g.label}
              </span>
            )
          ) : null}
          <NavLinks
            items={g.items}
            todos={todos}
            pathname={pathname}
            onNavigate={onNavigate}
            colapsada={colapsada}
          />
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
  colapsada = false,
}: {
  items: NavItem[];
  /** TODOS los items visibles, no solo los del grupo: `isNavItemActive` desempata por prefijo mas largo
   *  y con una lista parcial marcaria activo un ancestro de otro grupo. */
  todos: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  /** Barra a iconos: el rotulo sale del renglon y aparece flotando al pasar por encima. */
  colapsada?: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item.href, pathname, todos);
        const enlace = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              colapsada && "justify-center px-0",
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
            {/* ═══ EL ROTULO (Santiago, 2026-09-10, como en Biody) ═══

                COLAPSADA, EL ROTULO NO DESAPARECE: sale del renglon y aparece al lado. Una barra de solo
                iconos obliga a aprenderse doce simbolos, y el que no se acuerda tiene que entrar a mirar.

                Y EL TEXTO SIGUE EN EL DOM tambien colapsada, en `sr-only`: asi el enlace nunca queda sin
                nombre accesible, y el tooltip es una ayuda VISUAL encima, no el unico sitio donde vive el
                rotulo. */}
            <span className={cn(colapsada && "sr-only")}>{item.label}</span>
          </Link>
        );
        // EL ROTULO VA EN UN TOOLTIP CON PORTAL, no en un `absolute` dentro del enlace: la barra necesita
        // `overflow-y: auto` para no perder items en una pantalla corta, y CSS recorta tambien el eje
        // horizontal en cuanto uno de los dos recorta. Ver `components/ui/tooltip.tsx`.
        return colapsada ? (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{enlace}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          enlace
        );
      })}
    </>
  );
}

// ROTULO DE SECCION: dice donde estas y, cuando la pagina esta bajada, sube al inicio.
//
// ── POR QUE SUBIR Y NO IR A LA SECCION ──────────────────────────────────────────────────────────────
//
// La alternativa natural era que "Pacientes" llevara a /pacientes, como una miga de pan. Se descarto al
// mirar que hay ya en cada pantalla:
//
//   · En la ficha del paciente seria DUPLICACION EXACTA: la banda ya lleva "Volver a pacientes", al mismo
//     destino y a un palmo. Y el que ya esta es mejor, porque dice a donde va con palabras.
//   · En una evaluacion seria PEOR que duplicacion: el "Volver" de la banda lleva a la FICHA DEL PACIENTE
//     y el rotulo llevaria a la LISTA de evaluaciones. Dos controles parecidos, en la misma barra, a
//     destinos distintos. Eso no es una miga de pan, es una trampa.
//   · En una lista apuntaria a si misma, que es la miga de pan muerta de siempre.
//
// Y se descarto tambien distinguir por tipo de pantalla ("en lista sube, en honda vuelve"): un control que
// hace cosas distintas segun donde estes es lo que rompe la confianza en el control.
//
// ── POR QUE SOLO CUANDO HAY SCROLL ──────────────────────────────────────────────────────────────────
//
// Un control que al pulsarlo no hace nada se lee como roto. Estando arriba, subir al inicio es un no-op,
// asi que el rotulo es TEXTO PLANO ahi y se vuelve boton cuando la pagina esta bajada: aparece cuando
// tiene trabajo, y el hover azul aparece con el.
//
// SE MIRA EL SCROLL REAL, no una lista de rutas: que una pantalla scrollee depende del contenido y del
// alto de la ventana, asi que no lo decide una ruta, lo decide el navegador.
//
// ── Y ES UN <button>, no un div con onClick ─────────────────────────────────────────────────────────
//
// Alcanzable con tabulador y anunciado como boton. El nombre accesible es "Subir al inicio" y no el de la
// seccion: quien lo oiga tiene que saber que HACE, no donde esta (eso ya lo dice el texto visible).
function RotuloSeccion({ label, Icono }: { label: string; Icono: LucideIcon | null }) {
  const [bajada, setBajada] = useState(false);

  useEffect(() => {
    // El umbral evita que el rotulo parpadee entre texto y boton con el rebote de scroll de macOS.
    const alMover = () => setBajada(window.scrollY > 120);
    alMover();
    window.addEventListener("scroll", alMover, { passive: true });
    return () => window.removeEventListener("scroll", alMover);
  }, []);

  const contenido = (
    <>
      {/* EL MISMO ICONO QUE LA BARRA LATERAL, del mismo mapa: las dos superficies nombran la seccion, asi
          que tienen que hacerlo con el mismo simbolo. Con dos iconos distintos, "Pacientes" tendria dos
          caras en la misma pantalla. */}
      {Icono ? <Icono className="size-4 shrink-0" aria-hidden /> : null}
      {label}
    </>
  );

  if (!bajada) {
    return (
      <span className="hidden items-center gap-2 truncate text-base font-semibold text-foreground lg:flex">
        {contenido}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label="Subir al inicio"
      onClick={() =>
        window.scrollTo({
          top: 0,
          // `prefers-reduced-motion` no es un detalle de cortesia: para quien lo activo, un desplazamiento
          // animado de pantalla completa puede producir mareo.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      className="hidden items-center gap-2 truncate rounded-md text-base font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
    >
      {contenido}
    </button>
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
  // La SECCION sale del item activo, la misma resolucion que usa el resaltado de la barra lateral. Se
  // aplana desde los grupos, igual que hace la navegacion: con una lista parcial, `isNavItemActive`
  // marcaria activo el ancestro de otro grupo.
  const itemsVisibles = grupos.flatMap((g) => g.items);
  const itemActivo = itemsVisibles.find((i) => isNavItemActive(i.href, pathname, itemsVisibles));
  const IconoSeccion = itemActivo ? ICONS[itemActivo.icon] : null;
  const [open, setOpen] = useState(false);
  // La preferencia de barra colapsada, recordada entre pantallas. Ver `usar-nav-colapsada`.
  const colapsada = useNavColapsada();


  return (
    <TooltipProvider>
    <div className="flex min-h-svh">
      {/* Sidebar desktop. FIJA (`sticky top-0`, alto de viewport): en una pantalla larga, perder la
          navegacion al bajar es real, y el panel del nutricionista pasa de las mil lineas. Sin esto, para
          cambiar de seccion habia que subir hasta arriba primero.
          `overflow-y-auto` en el propio aside y no en el nav: si la lista de items crece mas que la
          pantalla (roles con muchos accesos), tiene que poder desplazarse sola sin arrastrar la pagina. */}
      {/* COLAPSABLE A ICONOS (Santiago, 2026-09-10). `overflow-y-auto` se cambia por `overflow-x-visible`
          cuando esta colapsada: con el recorte horizontal, el rotulo flotante quedaria cortado justo al
          salir del aside, que es donde tiene que verse. `overflow-y` sigue haciendo falta para las listas
          largas, asi que van los dos ejes por separado. */}
      {/* ═══ EL ENVOLTORIO NO RECORTA; LA BARRA DE DENTRO SI (2026-09-10) ═══

          Son dos elementos y no uno a proposito: el aside necesita `overflow-y: auto` (una lista mas larga
          que la pantalla no puede dejar items inalcanzables), y eso recorta tambien lo que sobresale por el
          lado. El tirador va MEDIO FUERA, asi que vive en el envoltorio, que no recorta nada. */}
      <div className="sticky top-0 hidden h-svh shrink-0 lg:block">
        <aside
          className={cn(
            "flex h-full flex-col overflow-y-auto border-r border-border bg-background transition-[width] duration-200",
            colapsada ? "w-16" : "w-60",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center",
              colapsada ? "justify-center px-0" : "px-4",
            )}
          >
            <AtlasLogo compacto={colapsada} />
          </div>
          <nav className={cn("flex flex-1 flex-col gap-0.5 py-2", colapsada ? "px-2" : "px-3")}>
            <NavGrupos grupos={grupos} pathname={pathname} colapsada={colapsada} />
          </nav>
        </aside>

        {/* ═══ EL TIRADOR, EN EL BORDE Y MEDIO FUERA (Santiago, 2026-09-10, ref. "sidebar-colapsar") ═══

            ESTABA JUNTO AL LOGO y daba dos problemas suyos: abierto quedaba pegado a "CNV", y colapsado
            parecia un item mas de la lista. En el borde no es ninguna de las dos cosas: no compite con la
            marca y no se confunde con la navegacion, porque no esta DENTRO de ella.

            Y ES REDONDO Y MEDIO SALIDO por lo mismo que en la referencia: montado sobre la linea que
            separa, se lee como el mando DE esa linea. La flecha apunta a donde va a ir la barra, no a
            donde esta. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={alternarNavColapsada}
          aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}
          aria-pressed={colapsada}
          className="absolute -right-3 top-[3.25rem] z-30 size-6 rounded-full border-border bg-background p-0 shadow-sm hover:bg-muted"
        >
          {colapsada ? (
            <ChevronRight className="size-3.5" aria-hidden />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>

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
            {/* EL ROTULO DE SECCION, de vuelta el 2026-09-03 y con OTRO PAPEL que el que tenia.
                Se habia retirado esa misma manana porque duplicaba el titulo de la pagina; Santiago lo
                quiere de vuelta al verlo, y la duplicacion se resuelve por PESO en vez de por ausencia.
                Queda escrito el ida y vuelta para que nadie lo retire otra vez por el mismo motivo.

                COMO SE DISTINGUE DEL TITULO DE LA PAGINA, que es lo que hacia falta resolver:
                  · Aqui va en `text-sm` y en gris (`text-muted-foreground`), no en negro y `text-base`.
                    Es una MIGA DE PAN, no un titulo: dice en que seccion estas.
                  · La pagina lleva el titulo de verdad, en `text-titulo` y en negro.
                Con dos pesos distintos, ver "Pacientes" arriba en gris pequeno y "Pacientes" abajo en
                grande no se lee como repeticion sino como jerarquia, que es lo que es.

                Y EN LA MAYORIA DE PANTALLAS NI SIQUIERA COINCIDEN: en la ficha del paciente la barra dice
                "Pacientes" y la pagina el NOMBRE; en una evaluacion, "Evaluaciones" y el nombre otra vez.
                Solo coinciden en las listas, que es donde el titulo de pagina ES el de la seccion.

                Y VA A LA IZQUIERDA, antes del contenido, no junto al avatar. Estuvo a la derecha unas
                horas y Santiago lo movio con una razon que no es de gusto: **el lado del avatar es donde
                van a entrar los iconos de sesion** (notificaciones, ayuda), y un rotulo de texto ahi
                acabaria empujado o compitiendo con ellos. A la izquierda el sitio es estable.

                QUEDA PREPARADO EL SITIO DE UN ICONO a su izquierda: el `gap-2` y el `flex` estan puestos
                para que entre uno sin recolocar nada.
                Sigue siendo `lg:block`: en telefono el ancho lo necesita el logo. */}
            {itemActivo ? <RotuloSeccion label={itemActivo.label} Icono={IconoSeccion} /> : null}
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
                <form onSubmit={enviarSinReset(logoutAction)}>
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
    </TooltipProvider>
  );
}
