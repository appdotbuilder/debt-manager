import { db } from '../db';
import { paymentsTable, banksTable, loanTransactionsTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createPayment = async (input: CreatePaymentInput): Promise<Payment> => {
  try {
    // Validate that the bank exists
    const bankExists = await db.select({ id: banksTable.id })
      .from(banksTable)
      .where(eq(banksTable.id, input.bank_id))
      .execute();

    if (bankExists.length === 0) {
      throw new Error(`Bank with ID ${input.bank_id} does not exist`);
    }

    // Validate that the loan transaction exists and belongs to the specified bank
    const loanTransactionExists = await db.select({ id: loanTransactionsTable.id })
      .from(loanTransactionsTable)
      .where(and(
        eq(loanTransactionsTable.id, input.loan_transaction_id),
        eq(loanTransactionsTable.bank_id, input.bank_id)
      ))
      .execute();

    if (loanTransactionExists.length === 0) {
      throw new Error(`Loan transaction with ID ${input.loan_transaction_id} does not exist or does not belong to bank ${input.bank_id}`);
    }

    // Insert payment record
    const result = await db.insert(paymentsTable)
      .values({
        bank_id: input.bank_id,
        loan_transaction_id: input.loan_transaction_id,
        tanggal_pembayaran: input.tanggal_pembayaran,
        jumlah_pembayaran: input.jumlah_pembayaran.toString(), // Convert number to string for numeric column
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const payment = result[0];
    return {
      ...payment,
      jumlah_pembayaran: parseFloat(payment.jumlah_pembayaran) // Convert string back to number
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
};