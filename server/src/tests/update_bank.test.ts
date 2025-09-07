import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable } from '../db/schema';
import { type CreateBankInput, type UpdateBankInput } from '../schema';
import { updateBank } from '../handlers/update_bank';
import { eq } from 'drizzle-orm';

// Helper function to create a test bank
const createTestBank = async (overrides: Partial<CreateBankInput> = {}) => {
  const bankData = {
    nama_bank: 'Test Bank',
    limit_pinjaman: 50000000,
    jenis_pinjaman: 'KTA' as const,
    tanggal_cetak_billing: null,
    tanggal_jatuh_tempo: 15,
    ...overrides
  };

  const result = await db.insert(banksTable)
    .values({
      nama_bank: bankData.nama_bank,
      limit_pinjaman: bankData.limit_pinjaman.toString(),
      jenis_pinjaman: bankData.jenis_pinjaman,
      tanggal_cetak_billing: bankData.tanggal_cetak_billing,
      tanggal_jatuh_tempo: bankData.tanggal_jatuh_tempo
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateBank', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update basic bank information', async () => {
    const createdBank = await createTestBank();
    
    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      nama_bank: 'Updated Bank Name',
      limit_pinjaman: 75000000,
      tanggal_jatuh_tempo: 25
    };

    const result = await updateBank(updateInput);

    expect(result.id).toEqual(createdBank.id);
    expect(result.nama_bank).toEqual('Updated Bank Name');
    expect(result.limit_pinjaman).toEqual(75000000);
    expect(result.tanggal_jatuh_tempo).toEqual(25);
    expect(result.jenis_pinjaman).toEqual('KTA'); // Should remain unchanged
    expect(result.tanggal_cetak_billing).toBeNull(); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save updates to database', async () => {
    const createdBank = await createTestBank();
    
    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      nama_bank: 'Database Updated Bank'
    };

    await updateBank(updateInput);

    const savedBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, createdBank.id))
      .execute();

    expect(savedBank).toHaveLength(1);
    expect(savedBank[0].nama_bank).toEqual('Database Updated Bank');
    expect(parseFloat(savedBank[0].limit_pinjaman)).toEqual(50000000); // Should remain unchanged
  });

  it('should change loan type from KTA to KARTU_KREDIT with billing date', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 10
    };

    const result = await updateBank(updateInput);

    expect(result.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(result.tanggal_cetak_billing).toEqual(10);
  });

  it('should change loan type from KARTU_KREDIT to KTA and clear billing date', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 5
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      jenis_pinjaman: 'KTA'
    };

    const result = await updateBank(updateInput);

    expect(result.jenis_pinjaman).toEqual('KTA');
    expect(result.tanggal_cetak_billing).toBeNull();
  });

  it('should update billing date for existing KARTU_KREDIT bank', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 5
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      tanggal_cetak_billing: 15
    };

    const result = await updateBank(updateInput);

    expect(result.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(result.tanggal_cetak_billing).toEqual(15);
  });

  it('should throw error when changing to KARTU_KREDIT without billing date', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      jenis_pinjaman: 'KARTU_KREDIT'
      // No tanggal_cetak_billing provided
    };

    await expect(updateBank(updateInput)).rejects.toThrow(/tanggal cetak billing harus diisi/i);
  });

  it('should throw error when setting billing date to null for KARTU_KREDIT', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 10
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      tanggal_cetak_billing: null
    };

    await expect(updateBank(updateInput)).rejects.toThrow(/tanggal cetak billing harus diisi/i);
  });

  it('should throw error when setting billing date for non-KARTU_KREDIT loan type', async () => {
    const createdBank = await createTestBank({
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      tanggal_cetak_billing: 15 // Should not be allowed for KTA
    };

    await expect(updateBank(updateInput)).rejects.toThrow(/tanggal cetak billing hanya diperlukan untuk kartu kredit/i);
  });

  it('should throw error when bank does not exist', async () => {
    const updateInput: UpdateBankInput = {
      id: 999999, // Non-existent ID
      nama_bank: 'Updated Name'
    };

    await expect(updateBank(updateInput)).rejects.toThrow(/bank with id 999999 not found/i);
  });

  it('should handle partial updates correctly', async () => {
    const createdBank = await createTestBank({
      nama_bank: 'Original Bank',
      limit_pinjaman: 25000000,
      jenis_pinjaman: 'PAYLATER',
      tanggal_jatuh_tempo: 10
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      limit_pinjaman: 30000000 // Only update limit
    };

    const result = await updateBank(updateInput);

    // Updated field
    expect(result.limit_pinjaman).toEqual(30000000);
    
    // Unchanged fields
    expect(result.nama_bank).toEqual('Original Bank');
    expect(result.jenis_pinjaman).toEqual('PAYLATER');
    expect(result.tanggal_jatuh_tempo).toEqual(10);
    expect(result.tanggal_cetak_billing).toBeNull();
  });

  it('should maintain KARTU_KREDIT billing date when updating other fields', async () => {
    const createdBank = await createTestBank({
      nama_bank: 'Credit Card Bank',
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 20
    });

    const updateInput: UpdateBankInput = {
      id: createdBank.id,
      limit_pinjaman: 100000000 // Only update limit, keep loan type and billing date
    };

    const result = await updateBank(updateInput);

    expect(result.limit_pinjaman).toEqual(100000000);
    expect(result.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(result.tanggal_cetak_billing).toEqual(20); // Should be preserved
  });

  it('should handle all loan types correctly', async () => {
    // Test each loan type
    const loanTypes = ['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR'] as const;
    
    for (const loanType of loanTypes) {
      const createdBank = await createTestBank({
        nama_bank: `${loanType} Bank`,
        jenis_pinjaman: 'KTA', // Start with KTA
        tanggal_cetak_billing: null
      });

      const updateInput: UpdateBankInput = {
        id: createdBank.id,
        jenis_pinjaman: loanType,
        ...(loanType === 'KARTU_KREDIT' ? { tanggal_cetak_billing: 15 } : {})
      };

      const result = await updateBank(updateInput);

      expect(result.jenis_pinjaman).toEqual(loanType);
      if (loanType === 'KARTU_KREDIT') {
        expect(result.tanggal_cetak_billing).toEqual(15);
      } else {
        expect(result.tanggal_cetak_billing).toBeNull();
      }
    }
  });
});