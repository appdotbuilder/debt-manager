import { db } from '../db';
import { paymentsTable, banksTable, loanTransactionsTable } from '../db/schema';
import { type UpdatePaymentInput, type Payment } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updatePayment(input: UpdatePaymentInput): Promise<Payment> {
  try {
    // First check if the payment exists
    const existingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, input.id))
      .execute();

    if (existingPayments.length === 0) {
      throw new Error(`Payment with ID ${input.id} not found`);
    }

    const existingPayment = existingPayments[0];

    // Validate bank exists if bank_id is being updated
    if (input.bank_id !== undefined) {
      const banks = await db.select()
        .from(banksTable)
        .where(eq(banksTable.id, input.bank_id))
        .execute();

      if (banks.length === 0) {
        throw new Error(`Bank with ID ${input.bank_id} not found`);
      }
    }

    // Validate loan transaction exists and belongs to the correct bank if updating either field
    const targetBankId = input.bank_id !== undefined ? input.bank_id : existingPayment.bank_id;
    const targetLoanTransactionId = input.loan_transaction_id !== undefined ? input.loan_transaction_id : existingPayment.loan_transaction_id;

    const loanTransactions = await db.select()
      .from(loanTransactionsTable)
      .where(
        and(
          eq(loanTransactionsTable.id, targetLoanTransactionId),
          eq(loanTransactionsTable.bank_id, targetBankId)
        )
      )
      .execute();

    if (loanTransactions.length === 0) {
      throw new Error(`Loan transaction with ID ${targetLoanTransactionId} not found for bank ID ${targetBankId}`);
    }

    // Prepare update values - only include fields that are provided
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.bank_id !== undefined) {
      updateValues.bank_id = input.bank_id;
    }
    if (input.loan_transaction_id !== undefined) {
      updateValues.loan_transaction_id = input.loan_transaction_id;
    }
    if (input.tanggal_pembayaran !== undefined) {
      updateValues.tanggal_pembayaran = input.tanggal_pembayaran;
    }
    if (input.jumlah_pembayaran !== undefined) {
      updateValues.jumlah_pembayaran = input.jumlah_pembayaran.toString(); // Convert to string for numeric column
    }

    // Update the payment
    const result = await db.update(paymentsTable)
      .set(updateValues)
      .where(eq(paymentsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedPayment = result[0];
    return {
      ...updatedPayment,
      jumlah_pembayaran: parseFloat(updatedPayment.jumlah_pembayaran)
    };
  } catch (error) {
    console.error('Payment update failed:', error);
    throw error;
  }
}