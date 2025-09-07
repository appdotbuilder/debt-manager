import { db } from '../db';
import { banksTable } from '../db/schema';
import { type CreateBankInput, type Bank } from '../schema';

export const createBank = async (input: CreateBankInput): Promise<Bank> => {
  try {
    // Insert bank record
    const result = await db.insert(banksTable)
      .values({
        nama_bank: input.nama_bank,
        limit_pinjaman: input.limit_pinjaman.toString(), // Convert number to string for numeric column
        jenis_pinjaman: input.jenis_pinjaman,
        tanggal_cetak_billing: input.tanggal_cetak_billing, // Integer column - no conversion needed
        tanggal_jatuh_tempo: input.tanggal_jatuh_tempo // Integer column - no conversion needed
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const bank = result[0];
    return {
      ...bank,
      limit_pinjaman: parseFloat(bank.limit_pinjaman) // Convert string back to number
    };
  } catch (error) {
    console.error('Bank creation failed:', error);
    throw error;
  }
};