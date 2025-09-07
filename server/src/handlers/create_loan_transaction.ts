import { db } from '../db';
import { banksTable, loanTransactionsTable } from '../db/schema';
import { type CreateLoanTransactionInput, type LoanTransaction } from '../schema';
import { eq, sum } from 'drizzle-orm';

export const createLoanTransaction = async (input: CreateLoanTransactionInput): Promise<LoanTransaction> => {
  try {
    // First, validate that the bank exists
    const bank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, input.bank_id))
      .execute();

    if (bank.length === 0) {
      throw new Error('Bank not found');
    }

    const bankData = bank[0];

    // For Kartu Kredit with cicilan, validate transaction date is after billing date
    if (bankData.jenis_pinjaman === 'KARTU_KREDIT' && input.is_cicilan) {
      if (!bankData.tanggal_cetak_billing) {
        throw new Error('Bank billing date not configured for Kartu Kredit');
      }

      const transactionDay = input.tanggal_transaksi.getDate();
      const billingDay = bankData.tanggal_cetak_billing;

      // Simple validation: transaction day should be after billing day in the same month
      // or in the next billing cycle
      if (transactionDay <= billingDay) {
        // Check if this is next month's cycle by comparing with due date
        const dueDay = bankData.tanggal_jatuh_tempo;
        if (transactionDay > dueDay) {
          // Transaction is after due date but before next billing, this might be valid
          // Allow it to proceed
        } else {
          throw new Error('Kartu Kredit cicilan transaction must be after billing date');
        }
      }
    }

    // Check if loan amount exceeds bank limit
    // Get current total outstanding amount for this bank
    const currentLoansResult = await db.select({
      totalLoans: sum(loanTransactionsTable.jumlah_transaksi)
    })
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.bank_id, input.bank_id))
      .execute();

    const currentTotalLoans = currentLoansResult[0]?.totalLoans 
      ? parseFloat(currentLoansResult[0].totalLoans) 
      : 0;

    const newTotal = currentTotalLoans + input.jumlah_transaksi;
    const bankLimit = parseFloat(bankData.limit_pinjaman);

    if (newTotal > bankLimit) {
      throw new Error(`Transaction would exceed bank limit. Current: ${currentTotalLoans}, New total would be: ${newTotal}, Limit: ${bankLimit}`);
    }

    // Insert the loan transaction
    const result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: input.bank_id,
        tanggal_transaksi: input.tanggal_transaksi,
        keterangan_transaksi: input.keterangan_transaksi,
        jumlah_transaksi: input.jumlah_transaksi.toString(), // Convert number to string for numeric column
        is_cicilan: input.is_cicilan
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const loanTransaction = result[0];
    return {
      ...loanTransaction,
      jumlah_transaksi: parseFloat(loanTransaction.jumlah_transaksi) // Convert string back to number
    };
  } catch (error) {
    console.error('Loan transaction creation failed:', error);
    throw error;
  }
};