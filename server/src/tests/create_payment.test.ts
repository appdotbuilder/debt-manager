import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, banksTable, loanTransactionsTable } from '../db/schema';
import { type CreatePaymentInput } from '../schema';
import { createPayment } from '../handlers/create_payment';
import { eq, and } from 'drizzle-orm';

describe('createPayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test bank for prerequisite data
  const createTestBank = async () => {
    const result = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 15,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();
    
    return result[0];
  };

  // Create test loan transaction for prerequisite data
  const createTestLoanTransaction = async (bankId: number) => {
    const result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Test Transaction',
        jumlah_transaksi: '5000000',
        is_cicilan: false
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should create a payment successfully', async () => {
    // Create prerequisite data
    const bank = await createTestBank();
    const loanTransaction = await createTestLoanTransaction(bank.id);

    const testInput: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    const result = await createPayment(testInput);

    // Basic field validation
    expect(result.bank_id).toEqual(bank.id);
    expect(result.loan_transaction_id).toEqual(loanTransaction.id);
    expect(result.tanggal_pembayaran).toEqual(testInput.tanggal_pembayaran);
    expect(result.jumlah_pembayaran).toEqual(2500000);
    expect(typeof result.jumlah_pembayaran).toBe('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save payment to database correctly', async () => {
    // Create prerequisite data
    const bank = await createTestBank();
    const loanTransaction = await createTestLoanTransaction(bank.id);

    const testInput: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    const result = await createPayment(testInput);

    // Query database to verify payment was saved
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, result.id))
      .execute();

    expect(payments).toHaveLength(1);
    const savedPayment = payments[0];
    expect(savedPayment.bank_id).toEqual(bank.id);
    expect(savedPayment.loan_transaction_id).toEqual(loanTransaction.id);
    expect(savedPayment.tanggal_pembayaran).toEqual(testInput.tanggal_pembayaran);
    expect(parseFloat(savedPayment.jumlah_pembayaran)).toEqual(2500000);
    expect(savedPayment.created_at).toBeInstanceOf(Date);
    expect(savedPayment.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when bank does not exist', async () => {
    const testInput: CreatePaymentInput = {
      bank_id: 99999, // Non-existent bank
      loan_transaction_id: 1,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    await expect(createPayment(testInput)).rejects.toThrow(/Bank with ID 99999 does not exist/i);
  });

  it('should throw error when loan transaction does not exist', async () => {
    // Create prerequisite bank
    const bank = await createTestBank();

    const testInput: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: 99999, // Non-existent loan transaction
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    await expect(createPayment(testInput)).rejects.toThrow(/Loan transaction with ID 99999 does not exist/i);
  });

  it('should throw error when loan transaction does not belong to specified bank', async () => {
    // Create two banks and a loan transaction for the first bank
    const bank1 = await createTestBank();
    const bank2 = await db.insert(banksTable)
      .values({
        nama_bank: 'Second Bank',
        limit_pinjaman: '15000000',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 30
      })
      .returning()
      .execute();

    const loanTransaction = await createTestLoanTransaction(bank1.id);

    const testInput: CreatePaymentInput = {
      bank_id: bank2[0].id, // Different bank than the loan transaction
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    await expect(createPayment(testInput)).rejects.toThrow(/does not belong to bank/i);
  });

  it('should handle decimal amounts correctly', async () => {
    // Create prerequisite data
    const bank = await createTestBank();
    const loanTransaction = await createTestLoanTransaction(bank.id);

    const testInput: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000.75 // Decimal amount
    };

    const result = await createPayment(testInput);

    // Verify decimal precision is maintained
    expect(result.jumlah_pembayaran).toEqual(2500000.75);
    expect(typeof result.jumlah_pembayaran).toBe('number');

    // Verify in database
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, result.id))
      .execute();

    expect(parseFloat(payments[0].jumlah_pembayaran)).toEqual(2500000.75);
  });

  it('should create multiple payments for same loan transaction', async () => {
    // Create prerequisite data
    const bank = await createTestBank();
    const loanTransaction = await createTestLoanTransaction(bank.id);

    const firstPayment: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-20'),
      jumlah_pembayaran: 2500000
    };

    const secondPayment: CreatePaymentInput = {
      bank_id: bank.id,
      loan_transaction_id: loanTransaction.id,
      tanggal_pembayaran: new Date('2024-01-25'),
      jumlah_pembayaran: 1500000
    };

    const result1 = await createPayment(firstPayment);
    const result2 = await createPayment(secondPayment);

    // Verify both payments were created
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.jumlah_pembayaran).toEqual(2500000);
    expect(result2.jumlah_pembayaran).toEqual(1500000);

    // Verify in database
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, loanTransaction.id))
      .execute();

    expect(payments).toHaveLength(2);
  });
});