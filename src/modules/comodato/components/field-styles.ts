// Clase compartida para los <select> nativos, alineada con el Input de shadcn.
// Se usa native select (no el Select de Radix) para mantener los formularios
// simples: postean su valor por FormData sin estado de cliente extra.
export const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";
