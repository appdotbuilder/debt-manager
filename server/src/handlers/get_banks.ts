import { db } from '../db';
import { banksTable } from '../db/schema';
import { type Bank } from '../schema';

export const getBanks = async (): Promise<Bank[]> => {
  try {
    const results = await db.select()
      .from(banksTable)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(bank => ({
      ...bank,
      limit_pinjaman: parseFloat(bank.limit_pinjaman) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch banks:', error);
    throw error;
  }
};