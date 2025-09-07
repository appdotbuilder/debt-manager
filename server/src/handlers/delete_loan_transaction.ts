import { db } from '../db';
import { loanTransactionsTable, paymentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteLoanTransaction(transactionId: number): Promise<{ success: boolean }> {
  try {
    // First, verify the loan transaction exists
    const existingTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, transactionId))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error(`Loan transaction with ID ${transactionId} not found`);
    }

    // Delete related payments first to maintain referential integrity
    await db.delete(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, transactionId))
      .execute();

    // Delete the loan transaction
    await db.delete(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, transactionId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Loan transaction deletion failed:', error);
    throw error;
  }
}