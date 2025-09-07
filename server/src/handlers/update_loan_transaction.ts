import { db } from '../db';
import { loanTransactionsTable, banksTable } from '../db/schema';
import { type UpdateLoanTransactionInput, type LoanTransaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateLoanTransaction = async (input: UpdateLoanTransactionInput): Promise<LoanTransaction> => {
  try {
    // Verify that the loan transaction exists
    const existingTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, input.id))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error(`Loan transaction with id ${input.id} not found`);
    }

    // If bank_id is being updated, verify the new bank exists
    if (input.bank_id !== undefined) {
      const bankExists = await db.select()
        .from(banksTable)
        .where(eq(banksTable.id, input.bank_id))
        .execute();

      if (bankExists.length === 0) {
        throw new Error(`Bank with id ${input.bank_id} not found`);
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.bank_id !== undefined) {
      updateData.bank_id = input.bank_id;
    }

    if (input.tanggal_transaksi !== undefined) {
      updateData.tanggal_transaksi = input.tanggal_transaksi;
    }

    if (input.keterangan_transaksi !== undefined) {
      updateData.keterangan_transaksi = input.keterangan_transaksi;
    }

    if (input.jumlah_transaksi !== undefined) {
      updateData.jumlah_transaksi = input.jumlah_transaksi.toString();
    }

    if (input.is_cicilan !== undefined) {
      updateData.is_cicilan = input.is_cicilan;
    }

    // Update the loan transaction
    const result = await db.update(loanTransactionsTable)
      .set(updateData)
      .where(eq(loanTransactionsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const loanTransaction = result[0];
    return {
      ...loanTransaction,
      jumlah_transaksi: parseFloat(loanTransaction.jumlah_transaksi)
    };
  } catch (error) {
    console.error('Loan transaction update failed:', error);
    throw error;
  }
};