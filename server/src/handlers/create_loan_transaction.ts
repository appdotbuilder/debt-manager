import { type CreateLoanTransactionInput, type LoanTransaction } from '../schema';

export async function createLoanTransaction(input: CreateLoanTransactionInput): Promise<LoanTransaction> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a new loan transaction with validation
    // that for Kartu Kredit with cicilan, the transaction date must be after billing date.
    // Should also validate that the bank exists and loan amount doesn't exceed limit.
    return Promise.resolve({
        id: 0, // Placeholder ID
        bank_id: input.bank_id,
        tanggal_transaksi: input.tanggal_transaksi,
        keterangan_transaksi: input.keterangan_transaksi,
        jumlah_transaksi: input.jumlah_transaksi,
        is_cicilan: input.is_cicilan,
        created_at: new Date(),
        updated_at: new Date()
    } as LoanTransaction);
}