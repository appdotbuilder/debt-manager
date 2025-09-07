import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable } from '../db/schema';
import { type UpdateLoanTransactionInput, type CreateBankInput, type CreateLoanTransactionInput } from '../schema';
import { updateLoanTransaction } from '../handlers/update_loan_transaction';
import { eq } from 'drizzle-orm';

// Test bank data
const testBankInput: CreateBankInput = {
  nama_bank: 'Test Bank',
  limit_pinjaman: 10000000,
  jenis_pinjaman: 'KARTU_KREDIT',
  tanggal_cetak_billing: 15,
  tanggal_jatuh_tempo: 25
};

const testBankInput2: CreateBankInput = {
  nama_bank: 'Another Bank',
  limit_pinjaman: 5000000,
  jenis_pinjaman: 'KTA',
  tanggal_cetak_billing: null,
  tanggal_jatuh_tempo: 20
};

// Test loan transaction data
const testLoanTransactionInput: CreateLoanTransactionInput = {
  bank_id: 1, // Will be set after bank creation
  tanggal_transaksi: new Date('2024-01-15'),
  keterangan_transaksi: 'Test Transaction',
  jumlah_transaksi: 1000000,
  is_cicilan: false
};

describe('updateLoanTransaction', () => {
  let bankId: number;
  let loanTransactionId: number;

  beforeEach(async () => {
    await createDB();

    // Create test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: testBankInput.nama_bank,
        limit_pinjaman: testBankInput.limit_pinjaman.toString(),
        jenis_pinjaman: testBankInput.jenis_pinjaman,
        tanggal_cetak_billing: testBankInput.tanggal_cetak_billing,
        tanggal_jatuh_tempo: testBankInput.tanggal_jatuh_tempo
      })
      .returning()
      .execute();
    bankId = bankResult[0].id;

    // Create test loan transaction
    const loanTransactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: testLoanTransactionInput.tanggal_transaksi,
        keterangan_transaksi: testLoanTransactionInput.keterangan_transaksi,
        jumlah_transaksi: testLoanTransactionInput.jumlah_transaksi.toString(),
        is_cicilan: testLoanTransactionInput.is_cicilan
      })
      .returning()
      .execute();
    loanTransactionId = loanTransactionResult[0].id;
  });

  afterEach(resetDB);

  it('should update loan transaction with all fields', async () => {
    // Create another bank for testing bank_id update
    const bank2Result = await db.insert(banksTable)
      .values({
        nama_bank: testBankInput2.nama_bank,
        limit_pinjaman: testBankInput2.limit_pinjaman.toString(),
        jenis_pinjaman: testBankInput2.jenis_pinjaman,
        tanggal_cetak_billing: testBankInput2.tanggal_cetak_billing,
        tanggal_jatuh_tempo: testBankInput2.tanggal_jatuh_tempo
      })
      .returning()
      .execute();
    const bank2Id = bank2Result[0].id;

    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      bank_id: bank2Id,
      tanggal_transaksi: new Date('2024-02-20'),
      keterangan_transaksi: 'Updated Transaction',
      jumlah_transaksi: 2000000,
      is_cicilan: true
    };

    const result = await updateLoanTransaction(updateInput);

    // Verify all fields are updated
    expect(result.id).toEqual(loanTransactionId);
    expect(result.bank_id).toEqual(bank2Id);
    expect(result.tanggal_transaksi).toEqual(new Date('2024-02-20'));
    expect(result.keterangan_transaksi).toEqual('Updated Transaction');
    expect(result.jumlah_transaksi).toEqual(2000000);
    expect(typeof result.jumlah_transaksi).toEqual('number');
    expect(result.is_cicilan).toEqual(true);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update loan transaction with partial fields', async () => {
    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      keterangan_transaksi: 'Partially Updated Transaction',
      jumlah_transaksi: 1500000
    };

    const result = await updateLoanTransaction(updateInput);

    // Verify only specified fields are updated, others remain unchanged
    expect(result.id).toEqual(loanTransactionId);
    expect(result.bank_id).toEqual(bankId); // Should remain unchanged
    expect(result.tanggal_transaksi).toEqual(new Date('2024-01-15')); // Should remain unchanged
    expect(result.keterangan_transaksi).toEqual('Partially Updated Transaction');
    expect(result.jumlah_transaksi).toEqual(1500000);
    expect(result.is_cicilan).toEqual(false); // Should remain unchanged
  });

  it('should update loan transaction in database', async () => {
    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      keterangan_transaksi: 'Database Update Test',
      jumlah_transaksi: 3000000
    };

    await updateLoanTransaction(updateInput);

    // Verify changes are persisted in database
    const updatedTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, loanTransactionId))
      .execute();

    expect(updatedTransaction).toHaveLength(1);
    expect(updatedTransaction[0].keterangan_transaksi).toEqual('Database Update Test');
    expect(parseFloat(updatedTransaction[0].jumlah_transaksi)).toEqual(3000000);
    expect(updatedTransaction[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent loan transaction', async () => {
    const updateInput: UpdateLoanTransactionInput = {
      id: 99999, // Non-existent ID
      keterangan_transaksi: 'Should not work'
    };

    expect(updateLoanTransaction(updateInput)).rejects.toThrow(/transaction with id 99999 not found/i);
  });

  it('should throw error for non-existent bank when updating bank_id', async () => {
    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      bank_id: 99999 // Non-existent bank ID
    };

    expect(updateLoanTransaction(updateInput)).rejects.toThrow(/bank with id 99999 not found/i);
  });

  it('should handle date updates correctly', async () => {
    const newDate = new Date('2024-12-31');
    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      tanggal_transaksi: newDate
    };

    const result = await updateLoanTransaction(updateInput);

    expect(result.tanggal_transaksi).toEqual(newDate);
    
    // Verify in database
    const updatedTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, loanTransactionId))
      .execute();

    expect(updatedTransaction[0].tanggal_transaksi).toEqual(newDate);
  });

  it('should handle boolean field updates correctly', async () => {
    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      is_cicilan: true
    };

    const result = await updateLoanTransaction(updateInput);

    expect(result.is_cicilan).toEqual(true);
    
    // Verify in database
    const updatedTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, loanTransactionId))
      .execute();

    expect(updatedTransaction[0].is_cicilan).toEqual(true);
  });

  it('should update updated_at timestamp', async () => {
    // Get original timestamp
    const originalTransaction = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, loanTransactionId))
      .execute();

    const originalUpdatedAt = originalTransaction[0].updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateLoanTransactionInput = {
      id: loanTransactionId,
      keterangan_transaksi: 'Timestamp test'
    };

    const result = await updateLoanTransaction(updateInput);

    // Verify updated_at is changed
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });
});