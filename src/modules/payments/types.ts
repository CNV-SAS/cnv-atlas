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
  transaction_items: (TransactionItem & { nutraceuticals: { name: string } | null })[];
  /**
   * El perfil del profesional que se lleva la comisión (0193).
   *
   * Viene para poder decir QUIÉN REGISTRÓ la venta: `created_by` es la persona que tecleó y
   * `professional_id` la que cobra, y cuando un administrador vende por el paciente de otro no coinciden.
   * Sin esto las dos ventas se ven iguales, y si una sale mal no se sabe a quién preguntarle.
   */
  professional_profiles: { profile_id: string } | null;
  /**
   * EL PACIENTE DE LA VENTA (Santiago, smoke del 2026-10-07). Nueve líneas de 107.100 del mismo producto no se
   * distinguían entre sí: *"uno se confunde fácil"*. Puede ser `null` en una venta sin paciente atado.
   */
  patients: {
    document_type: string;
    document_number: string;
    patient_profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  } | null;
};
