import { db } from '../db';
import { paymentsTable } from '../db/schema';
import { type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export async function getPayments(): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(payment => ({
      ...payment,
      jumlah_pembayaran: parseFloat(payment.jumlah_pembayaran)
    }));
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    throw error;
  }
}

export async function getPaymentsByBank(bankId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.bank_id, bankId))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(payment => ({
      ...payment,
      jumlah_pembayaran: parseFloat(payment.jumlah_pembayaran)
    }));
  } catch (error) {
    console.error('Failed to fetch payments by bank:', error);
    throw error;
  }
}

export async function getPaymentsByTransaction(transactionId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, transactionId))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(payment => ({
      ...payment,
      jumlah_pembayaran: parseFloat(payment.jumlah_pembayaran)
    }));
  } catch (error) {
    console.error('Failed to fetch payments by transaction:', error);
    throw error;
  }
}