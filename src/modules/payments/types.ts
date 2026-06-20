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
};
