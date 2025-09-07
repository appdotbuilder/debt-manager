import { db } from '../db';
import { banksTable } from '../db/schema';
import { type UpdateBankInput, type Bank } from '../schema';
import { eq } from 'drizzle-orm';

export const updateBank = async (input: UpdateBankInput): Promise<Bank> => {
  try {
    // First, check if the bank exists
    const existingBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, input.id))
      .limit(1)
      .execute();

    if (existingBank.length === 0) {
      throw new Error(`Bank with id ${input.id} not found`);
    }

    const currentBank = existingBank[0];

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.nama_bank !== undefined) {
      updateData.nama_bank = input.nama_bank;
    }

    if (input.limit_pinjaman !== undefined) {
      updateData.limit_pinjaman = input.limit_pinjaman.toString();
    }

    if (input.jenis_pinjaman !== undefined) {
      updateData.jenis_pinjaman = input.jenis_pinjaman;
      
      // Handle billing date validation based on loan type
      if (input.jenis_pinjaman === 'KARTU_KREDIT') {
        // If changing to Kartu Kredit and no billing date provided, keep existing or require one
        if (input.tanggal_cetak_billing === undefined) {
          // If current bank is not Kartu Kredit, we need a billing date
          if (currentBank.jenis_pinjaman !== 'KARTU_KREDIT') {
            throw new Error('Tanggal cetak billing harus diisi untuk jenis pinjaman Kartu Kredit');
          }
          // Otherwise keep existing billing date
        } else if (input.tanggal_cetak_billing === null) {
          throw new Error('Tanggal cetak billing harus diisi untuk jenis pinjaman Kartu Kredit');
        } else {
          updateData.tanggal_cetak_billing = input.tanggal_cetak_billing;
        }
      } else {
        // For non-Kartu Kredit types, billing date should be null
        updateData.tanggal_cetak_billing = null;
      }
    } else {
      // If loan type is not changing but billing date is provided
      if (input.tanggal_cetak_billing !== undefined) {
        const effectiveLoanType = currentBank.jenis_pinjaman;
        if (effectiveLoanType === 'KARTU_KREDIT') {
          if (input.tanggal_cetak_billing === null) {
            throw new Error('Tanggal cetak billing harus diisi untuk jenis pinjaman Kartu Kredit');
          }
          updateData.tanggal_cetak_billing = input.tanggal_cetak_billing;
        } else {
          // For non-Kartu Kredit, force billing date to null
          if (input.tanggal_cetak_billing !== null) {
            throw new Error('Tanggal cetak billing hanya diperlukan untuk Kartu Kredit');
          }
          updateData.tanggal_cetak_billing = null;
        }
      }
    }

    if (input.tanggal_jatuh_tempo !== undefined) {
      updateData.tanggal_jatuh_tempo = input.tanggal_jatuh_tempo;
    }

    // Update the bank record
    const result = await db.update(banksTable)
      .set(updateData)
      .where(eq(banksTable.id, input.id))
      .returning()
      .execute();

    const updatedBank = result[0];
    return {
      ...updatedBank,
      limit_pinjaman: parseFloat(updatedBank.limit_pinjaman)
    };
  } catch (error) {
    console.error('Bank update failed:', error);
    throw error;
  }
};