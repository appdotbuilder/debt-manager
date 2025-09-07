import { db } from '../db';
import { loanTransactionsTable } from '../db/schema';
import { type LoanTransaction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getLoanTransactions(): Promise<LoanTransaction[]> {
  try {
    const results = await db.select()
      .from(loanTransactionsTable)
      .orderBy(desc(loanTransactionsTable.tanggal_transaksi))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      jumlah_transaksi: parseFloat(transaction.jumlah_transaksi)
    }));
  } catch (error) {
    console.error('Failed to fetch loan transactions:', error);
    throw error;
  }
}

export async function getLoanTransactionsByBank(bankId: number): Promise<LoanTransaction[]> {
  try {
    const results = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.bank_id, bankId))
      .orderBy(desc(loanTransactionsTable.tanggal_transaksi))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      jumlah_transaksi: parseFloat(transaction.jumlah_transaksi)
    }));
  } catch (error) {
    console.error('Failed to fetch loan transactions by bank:', error);
    throw error;
  }
}