import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for loan types
export const loanTypeEnum = pgEnum('loan_type', ['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR']);

// Banks table
export const banksTable = pgTable('banks', {
  id: serial('id').primaryKey(),
  nama_bank: text('nama_bank').notNull(),
  limit_pinjaman: numeric('limit_pinjaman', { precision: 15, scale: 2 }).notNull(),
  jenis_pinjaman: loanTypeEnum('jenis_pinjaman').notNull(),
  tanggal_cetak_billing: integer('tanggal_cetak_billing'), // Nullable, only for Kartu Kredit
  tanggal_jatuh_tempo: integer('tanggal_jatuh_tempo').notNull(), // Day of month (1-31)
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Loan transactions table
export const loanTransactionsTable = pgTable('loan_transactions', {
  id: serial('id').primaryKey(),
  bank_id: integer('bank_id').notNull(),
  tanggal_transaksi: timestamp('tanggal_transaksi').notNull(),
  keterangan_transaksi: text('keterangan_transaksi').notNull(),
  jumlah_transaksi: numeric('jumlah_transaksi', { precision: 15, scale: 2 }).notNull(),
  is_cicilan: boolean('is_cicilan').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  bank_id: integer('bank_id').notNull(),
  loan_transaction_id: integer('loan_transaction_id').notNull(),
  tanggal_pembayaran: timestamp('tanggal_pembayaran').notNull(),
  jumlah_pembayaran: numeric('jumlah_pembayaran', { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const banksRelations = relations(banksTable, ({ many }) => ({
  loanTransactions: many(loanTransactionsTable),
  payments: many(paymentsTable),
}));

export const loanTransactionsRelations = relations(loanTransactionsTable, ({ one, many }) => ({
  bank: one(banksTable, {
    fields: [loanTransactionsTable.bank_id],
    references: [banksTable.id],
  }),
  payments: many(paymentsTable),
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  bank: one(banksTable, {
    fields: [paymentsTable.bank_id],
    references: [banksTable.id],
  }),
  loanTransaction: one(loanTransactionsTable, {
    fields: [paymentsTable.loan_transaction_id],
    references: [loanTransactionsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Bank = typeof banksTable.$inferSelect;
export type NewBank = typeof banksTable.$inferInsert;
export type LoanTransaction = typeof loanTransactionsTable.$inferSelect;
export type NewLoanTransaction = typeof loanTransactionsTable.$inferInsert;
export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  banks: banksTable,
  loanTransactions: loanTransactionsTable,
  payments: paymentsTable,
};

export const relationTables = {
  banksRelations,
  loanTransactionsRelations,
  paymentsRelations,
};