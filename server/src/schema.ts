import { z } from 'zod';

// Enum for loan types
export const loanTypeEnum = z.enum(['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR']);
export type LoanType = z.infer<typeof loanTypeEnum>;

// Bank schema
export const bankSchema = z.object({
  id: z.number(),
  nama_bank: z.string(),
  limit_pinjaman: z.number(),
  jenis_pinjaman: loanTypeEnum,
  tanggal_cetak_billing: z.number().int().min(1).max(31).nullable(), // Only for Kartu Kredit
  tanggal_jatuh_tempo: z.number().int().min(1).max(31), // Day of month for due date
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Bank = z.infer<typeof bankSchema>;

// Input schema for creating banks
export const createBankInputSchema = z.object({
  nama_bank: z.string().min(1),
  limit_pinjaman: z.number().positive(),
  jenis_pinjaman: loanTypeEnum,
  tanggal_cetak_billing: z.number().int().min(1).max(31).nullable(),
  tanggal_jatuh_tempo: z.number().int().min(1).max(31)
}).refine(
  (data) => {
    // If loan type is Kartu Kredit, tanggal_cetak_billing must be provided
    if (data.jenis_pinjaman === 'KARTU_KREDIT') {
      return data.tanggal_cetak_billing !== null;
    }
    // For other types, tanggal_cetak_billing should be null
    return data.tanggal_cetak_billing === null;
  },
  {
    message: "Tanggal cetak billing hanya diperlukan untuk Kartu Kredit",
    path: ["tanggal_cetak_billing"]
  }
);

export type CreateBankInput = z.infer<typeof createBankInputSchema>;

// Input schema for updating banks
export const updateBankInputSchema = z.object({
  id: z.number(),
  nama_bank: z.string().min(1).optional(),
  limit_pinjaman: z.number().positive().optional(),
  jenis_pinjaman: loanTypeEnum.optional(),
  tanggal_cetak_billing: z.number().int().min(1).max(31).nullable().optional(),
  tanggal_jatuh_tempo: z.number().int().min(1).max(31).optional()
});

export type UpdateBankInput = z.infer<typeof updateBankInputSchema>;

// Loan transaction schema
export const loanTransactionSchema = z.object({
  id: z.number(),
  bank_id: z.number(),
  tanggal_transaksi: z.coerce.date(),
  keterangan_transaksi: z.string(),
  jumlah_transaksi: z.number(),
  is_cicilan: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type LoanTransaction = z.infer<typeof loanTransactionSchema>;

// Input schema for creating loan transactions
export const createLoanTransactionInputSchema = z.object({
  bank_id: z.number(),
  tanggal_transaksi: z.coerce.date(),
  keterangan_transaksi: z.string().min(1),
  jumlah_transaksi: z.number().positive(),
  is_cicilan: z.boolean()
});

export type CreateLoanTransactionInput = z.infer<typeof createLoanTransactionInputSchema>;

// Input schema for updating loan transactions
export const updateLoanTransactionInputSchema = z.object({
  id: z.number(),
  bank_id: z.number().optional(),
  tanggal_transaksi: z.coerce.date().optional(),
  keterangan_transaksi: z.string().min(1).optional(),
  jumlah_transaksi: z.number().positive().optional(),
  is_cicilan: z.boolean().optional()
});

export type UpdateLoanTransactionInput = z.infer<typeof updateLoanTransactionInputSchema>;

// Payment schema
export const paymentSchema = z.object({
  id: z.number(),
  bank_id: z.number(),
  loan_transaction_id: z.number(),
  tanggal_pembayaran: z.coerce.date(),
  jumlah_pembayaran: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

// Input schema for creating payments
export const createPaymentInputSchema = z.object({
  bank_id: z.number(),
  loan_transaction_id: z.number(),
  tanggal_pembayaran: z.coerce.date(),
  jumlah_pembayaran: z.number().positive()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Input schema for updating payments
export const updatePaymentInputSchema = z.object({
  id: z.number(),
  bank_id: z.number().optional(),
  loan_transaction_id: z.number().optional(),
  tanggal_pembayaran: z.coerce.date().optional(),
  jumlah_pembayaran: z.number().positive().optional()
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>;

// Report schemas
export const monthlyReportInputSchema = z.object({
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12)
});

export type MonthlyReportInput = z.infer<typeof monthlyReportInputSchema>;

export const loanTypeReportInputSchema = z.object({
  jenis_pinjaman: loanTypeEnum
});

export type LoanTypeReportInput = z.infer<typeof loanTypeReportInputSchema>;

export const dueDateReportSchema = z.object({
  bank_id: z.number(),
  bank_name: z.string(),
  jenis_pinjaman: loanTypeEnum,
  tanggal_jatuh_tempo: z.number(),
  days_until_due: z.number(), // Negative if overdue
  outstanding_amount: z.number()
});

export type DueDateReport = z.infer<typeof dueDateReportSchema>;

export const monthlyReportSchema = z.object({
  year: z.number(),
  month: z.number(),
  total_loans: z.number(),
  total_payments: z.number(),
  net_debt: z.number(),
  transaction_count: z.number(),
  payment_count: z.number()
});

export type MonthlyReport = z.infer<typeof monthlyReportSchema>;

export const loanTypeReportSchema = z.object({
  jenis_pinjaman: loanTypeEnum,
  total_loans: z.number(),
  total_payments: z.number(),
  outstanding_amount: z.number(),
  transaction_count: z.number(),
  payment_count: z.number()
});

export type LoanTypeReport = z.infer<typeof loanTypeReportSchema>;