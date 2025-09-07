import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteBank(bankId: number): Promise<{ success: boolean }> {
  try {
    // First, check if the bank exists
    const bankExists = await db.select({ id: banksTable.id })
      .from(banksTable)
      .where(eq(banksTable.id, bankId))
      .execute();

    if (bankExists.length === 0) {
      throw new Error(`Bank with ID ${bankId} not found`);
    }

    // Check if there are any related loan transactions
    const relatedTransactions = await db.select({ id: loanTransactionsTable.id })
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.bank_id, bankId))
      .execute();

    if (relatedTransactions.length > 0) {
      throw new Error(`Cannot delete bank with ID ${bankId}. There are ${relatedTransactions.length} related loan transactions.`);
    }

    // Check if there are any related payments
    const relatedPayments = await db.select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(eq(paymentsTable.bank_id, bankId))
      .execute();

    if (relatedPayments.length > 0) {
      throw new Error(`Cannot delete bank with ID ${bankId}. There are ${relatedPayments.length} related payments.`);
    }

    // If no related records exist, proceed with deletion
    const deleteResult = await db.delete(banksTable)
      .where(eq(banksTable.id, bankId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Bank deletion failed:', error);
    throw error;
  }
}