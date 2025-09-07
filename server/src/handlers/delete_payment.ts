import { db } from '../db';
import { paymentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deletePayment = async (paymentId: number): Promise<{ success: boolean }> => {
  try {
    // Delete the payment record
    const result = await db.delete(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    // Check if any rows were affected (payment existed and was deleted)
    return { success: (result.rowCount ?? 0) > 0 };
  } catch (error) {
    console.error('Payment deletion failed:', error);
    throw error;
  }
};