import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable } from '../db/schema';
import { type CreateLoanTransactionInput } from '../schema';
import { createLoanTransaction } from '../handlers/create_loan_transaction';
import { eq } from 'drizzle-orm';

describe('createLoanTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data
  const testBank = {
    nama_bank: 'Test Bank',
    limit_pinjaman: '100000.00',
    jenis_pinjaman: 'KTA' as const,
    tanggal_cetak_billing: null,
    tanggal_jatuh_tempo: 25
  };

  const testKartuKreditBank = {
    nama_bank: 'Bank Kartu Kredit',
    limit_pinjaman: '50000.00',
    jenis_pinjaman: 'KARTU_KREDIT' as const,
    tanggal_cetak_billing: 15,
    tanggal_jatuh_tempo: 25
  };

  const testTransactionInput: CreateLoanTransactionInput = {
    bank_id: 1,
    tanggal_transaksi: new Date('2024-01-20'),
    keterangan_transaksi: 'Test transaction',
    jumlah_transaksi: 5000,
    is_cicilan: false
  };

  it('should create a loan transaction', async () => {
    // Create a test bank first
    await db.insert(banksTable).values(testBank).execute();

    const result = await createLoanTransaction(testTransactionInput);

    // Basic field validation
    expect(result.bank_id).toEqual(1);
    expect(result.tanggal_transaksi).toEqual(testTransactionInput.tanggal_transaksi);
    expect(result.keterangan_transaksi).toEqual(testTransactionInput.keterangan_transaksi);
    expect(result.jumlah_transaksi).toEqual(5000);
    expect(typeof result.jumlah_transaksi).toBe('number');
    expect(result.is_cicilan).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save loan transaction to database', async () => {
    // Create a test bank first
    await db.insert(banksTable).values(testBank).execute();

    const result = await createLoanTransaction(testTransactionInput);

    // Query the database to verify the record was saved
    const transactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].bank_id).toEqual(1);
    expect(transactions[0].keterangan_transaksi).toEqual('Test transaction');
    expect(parseFloat(transactions[0].jumlah_transaksi)).toEqual(5000);
    expect(transactions[0].is_cicilan).toEqual(false);
    expect(transactions[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent bank', async () => {
    // Don't create a bank, so bank_id 1 doesn't exist
    await expect(createLoanTransaction(testTransactionInput))
      .rejects.toThrow(/bank not found/i);
  });

  it('should throw error when exceeding bank limit', async () => {
    // Create a bank with low limit
    const lowLimitBank = {
      ...testBank,
      limit_pinjaman: '1000.00'
    };
    await db.insert(banksTable).values(lowLimitBank).execute();

    // Try to create a transaction exceeding the limit
    const highAmountTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 1500
    };

    await expect(createLoanTransaction(highAmountTransaction))
      .rejects.toThrow(/exceed bank limit/i);
  });

  it('should allow transaction within bank limit', async () => {
    // Create a bank with sufficient limit
    await db.insert(banksTable).values(testBank).execute();

    // Create first transaction
    const firstTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 30000
    };
    await createLoanTransaction(firstTransaction);

    // Create second transaction that brings total close to but not exceeding limit
    const secondTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 60000
    };
    const result = await createLoanTransaction(secondTransaction);

    expect(result.jumlah_transaksi).toEqual(60000);
    expect(result.id).toBeDefined();
  });

  it('should validate Kartu Kredit cicilan transaction date', async () => {
    // Create a Kartu Kredit bank
    await db.insert(banksTable).values(testKartuKreditBank).execute();

    // Try to create cicilan transaction before billing date (15th)
    const invalidCicilanTransaction = {
      ...testTransactionInput,
      tanggal_transaksi: new Date('2024-01-10'), // Before billing date (15th)
      is_cicilan: true
    };

    await expect(createLoanTransaction(invalidCicilanTransaction))
      .rejects.toThrow(/after billing date/i);
  });

  it('should allow Kartu Kredit cicilan transaction after billing date', async () => {
    // Create a Kartu Kredit bank
    await db.insert(banksTable).values(testKartuKreditBank).execute();

    // Create valid cicilan transaction after billing date (15th)
    const validCicilanTransaction = {
      ...testTransactionInput,
      tanggal_transaksi: new Date('2024-01-20'), // After billing date (15th)
      is_cicilan: true
    };

    const result = await createLoanTransaction(validCicilanTransaction);

    expect(result.is_cicilan).toEqual(true);
    expect(result.tanggal_transaksi).toEqual(validCicilanTransaction.tanggal_transaksi);
    expect(result.id).toBeDefined();
  });

  it('should allow non-cicilan Kartu Kredit transaction regardless of date', async () => {
    // Create a Kartu Kredit bank
    await db.insert(banksTable).values(testKartuKreditBank).execute();

    // Create non-cicilan transaction before billing date - should be allowed
    const nonCicilanTransaction = {
      ...testTransactionInput,
      tanggal_transaksi: new Date('2024-01-10'), // Before billing date (15th)
      is_cicilan: false
    };

    const result = await createLoanTransaction(nonCicilanTransaction);

    expect(result.is_cicilan).toEqual(false);
    expect(result.tanggal_transaksi).toEqual(nonCicilanTransaction.tanggal_transaksi);
    expect(result.id).toBeDefined();
  });

  it('should allow non-Kartu Kredit cicilan transaction regardless of date', async () => {
    // Create a non-Kartu Kredit bank
    await db.insert(banksTable).values(testBank).execute();

    // Create cicilan transaction - should be allowed regardless of date for non-Kartu Kredit
    const cicilanTransaction = {
      ...testTransactionInput,
      is_cicilan: true
    };

    const result = await createLoanTransaction(cicilanTransaction);

    expect(result.is_cicilan).toEqual(true);
    expect(result.id).toBeDefined();
  });

  it('should handle multiple transactions and cumulative limit checking', async () => {
    // Create a bank with moderate limit
    const moderateLimitBank = {
      ...testBank,
      limit_pinjaman: '15000.00'
    };
    await db.insert(banksTable).values(moderateLimitBank).execute();

    // Create first transaction
    const firstTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 7000
    };
    await createLoanTransaction(firstTransaction);

    // Create second transaction - should succeed
    const secondTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 6000
    };
    const result = await createLoanTransaction(secondTransaction);
    expect(result.jumlah_transaksi).toEqual(6000);

    // Try to create third transaction that would exceed limit
    const thirdTransaction = {
      ...testTransactionInput,
      jumlah_transaksi: 3000 // 7000 + 6000 + 3000 = 16000 > 15000
    };
    await expect(createLoanTransaction(thirdTransaction))
      .rejects.toThrow(/exceed bank limit/i);
  });
});