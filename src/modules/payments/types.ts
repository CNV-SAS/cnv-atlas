import type { Database } from "@/types/database.generated";

// Tipos de dominio de pagos (grupo 14), derivados de la Database generada.
type Tables = Database["public"]["Tables"];

export type Transaction = Tables["transactions"]["Row"];
export type TransactionItem = Tables["transaction_items"]["Row"];
export type ProfessionalRevenue = Tables["professional_revenue"]["Row"];
export type CnvRevenue = Tables["cnv_revenue"]["Row"];
export type PaymentWebhookEvent = Tables["payment_webhook_events"]["Row"];
export type TransactionStatus = Database["public"]["Enums"]["transaction_status"];

// Transaccion con sus items y el nombre del nutraceutico, para los listados de UI.
export type TransactionWithItems = Transaction & {
  transaction_items: (TransactionItem & {
    /**
     * `is_test` VIAJA CON EL NOMBRE (2026-10-28) porque es una de las tres entradas de la marca derivada,
     * y la lista tiene que poder DECIR por que una venta no cuenta. Ver `por-que-cuenta-como-de-prueba`.
     */
    nutraceuticals: { name: string; is_test: boolean | null } | null;
  })[];
  /**
   * El perfil del profesional que se lleva la comisión (0193).
   *
   * Viene para poder decir QUIÉN REGISTRÓ la venta: `created_by` es la persona que tecleó y
   * `professional_id` la que cobra, y cuando un administrador vende por el paciente de otro no coinciden.
   * Sin esto las dos ventas se ven iguales, y si una sale mal no se sabe a quién preguntarle.
   */
  professional_profiles:
    | {
        profile_id: string;
        /** Entrada de la marca derivada (0199): un profesional de prueba hace de prueba todas sus ventas. */
        is_test: boolean | null;
        /**
         * EL NOMBRE DE QUIEN SE LLEVA LA COMISIÓN (Santiago, smoke del 2026-10-07): *"como admin debería ver
         * datos del paciente y datos del profesional"*. Admin ve TODAS las ventas, así que sin esto no sabe de
         * quién es ninguna. Viaja con el hint `profiles!profile_id` (ver el lector).
         */
        profiles: { full_name: string | null } | { full_name: string | null }[] | null;
      }
    | null;
  /**
   * EL PACIENTE DE LA VENTA (Santiago, smoke del 2026-10-07). Nueve líneas de 107.100 del mismo producto no se
   * distinguían entre sí: *"uno se confunde fácil"*. Puede ser `null` en una venta sin paciente atado.
   */
  patients: {
    document_type: string;
    document_number: string;
    /** Entrada de la marca derivada (0202). El paciente de prueba hace de prueba la venta. */
    cuenta_como_de_prueba: boolean | null;
    patient_profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  } | null;
};
