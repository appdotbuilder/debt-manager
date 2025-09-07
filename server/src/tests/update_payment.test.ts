import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, banksTable, loanTransactionsTable } from '../db/schema';
import { type UpdatePaymentInput } from '../schema';
import { updatePayment } from '../handlers/update_payment';
import { eq } from 'drizzle-orm';

describe('updatePayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testBankId: number;
  let testLoanTransactionId: number;
  let testPaymentId: number;

  beforeEach(async () => {
    // Create test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 1,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();
    testBankId = bankResult[0].id;

    // Create test loan transaction
    const loanTransactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: testBankId,
        tanggal_transaksi: new Date('2024-01-01'),
        keterangan_transaksi: 'Test Transaction',
        jumlah_transaksi: '5000000.00',
        is_cicilan: false
      })
      .returning()
      .execute();
    testLoanTransactionId = loanTransactionResult[0].id;

    // Create test payment
    const paymentResult = await db.insert(paymentsTable)
      .values({
        bank_id: testBankId,
        loan_transaction_id: testLoanTransactionId,
        tanggal_pembayaran: new Date('2024-01-15'),
        jumlah_pembayaran: '1000000.00'
      })
      .returning()
      .execute();
    testPaymentId = paymentResult[0].id;
  });

  it('should update payment amount', async () => {
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      jumlah_pembayaran: 1500000
    };

    const result = await updatePayment(updateInput);

    expect(result.id).toEqual(testPaymentId);
    expect(result.jumlah_pembayaran).toEqual(1500000);
    expect(typeof result.jumlah_pembayaran).toEqual('number');
    expect(result.bank_id).toEqual(testBankId);
    expect(result.loan_transaction_id).toEqual(testLoanTransactionId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update payment date', async () => {
    const newDate = new Date('2024-01-20');
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      tanggal_pembayaran: newDate
    };

    const result = await updatePayment(updateInput);

    expect(result.id).toEqual(testPaymentId);
    expect(result.tanggal_pembayaran).toEqual(newDate);
    expect(result.jumlah_pembayaran).toEqual(1000000); // Should remain unchanged
  });

  it('should update multiple fields simultaneously', async () => {
    const newDate = new Date('2024-01-25');
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      tanggal_pembayaran: newDate,
      jumlah_pembayaran: 2000000
    };

    const result = await updatePayment(updateInput);

    expect(result.id).toEqual(testPaymentId);
    expect(result.tanggal_pembayaran).toEqual(newDate);
    expect(result.jumlah_pembayaran).toEqual(2000000);
    expect(typeof result.jumlah_pembayaran).toEqual('number');
  });

  it('should save updated payment to database', async () => {
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      jumlah_pembayaran: 1750000
    };

    await updatePayment(updateInput);

    // Query directly from database to verify changes
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, testPaymentId))
      .execute();

    expect(payments).toHaveLength(1);
    expect(parseFloat(payments[0].jumlah_pembayaran)).toEqual(1750000);
    expect(payments[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update bank_id with proper validation', async () => {
    // Create another bank
    const anotherBankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Another Bank',
        limit_pinjaman: '5000000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();
    const anotherBankId = anotherBankResult[0].id;

    // Create loan transaction for the new bank
    const newLoanTransactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: anotherBankId,
        tanggal_transaksi: new Date('2024-01-01'),
        keterangan_transaksi: 'New Bank Transaction',
        jumlah_transaksi: '3000000.00',
        is_cicilan: true
      })
      .returning()
      .execute();
    const newLoanTransactionId = newLoanTransactionResult[0].id;

    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      bank_id: anotherBankId,
      loan_transaction_id: newLoanTransactionId
    };

    const result = await updatePayment(updateInput);

    expect(result.bank_id).toEqual(anotherBankId);
    expect(result.loan_transaction_id).toEqual(newLoanTransactionId);
  });

  it('should throw error when payment not found', async () => {
    const updateInput: UpdatePaymentInput = {
      id: 99999,
      jumlah_pembayaran: 1000000
    };

    await expect(updatePayment(updateInput)).rejects.toThrow(/payment with id 99999 not found/i);
  });

  it('should throw error when bank not found', async () => {
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      bank_id: 99999
    };

    await expect(updatePayment(updateInput)).rejects.toThrow(/bank with id 99999 not found/i);
  });

  it('should throw error when loan transaction not found', async () => {
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      loan_transaction_id: 99999
    };

    await expect(updatePayment(updateInput)).rejects.toThrow(/loan transaction with id 99999 not found/i);
  });

  it('should throw error when loan transaction does not belong to bank', async () => {
    // Create another bank
    const anotherBankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Another Bank',
        limit_pinjaman: '5000000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();
    const anotherBankId = anotherBankResult[0].id;

    // Try to update payment to use loan transaction from original bank with different bank
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      bank_id: anotherBankId,
      loan_transaction_id: testLoanTransactionId // This belongs to testBankId, not anotherBankId
    };

    await expect(updatePayment(updateInput)).rejects.toThrow(/loan transaction with id .* not found for bank id/i);
  });

  it('should validate loan transaction belongs to existing bank when only updating loan_transaction_id', async () => {
    // Create another bank with its own loan transaction
    const anotherBankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Another Bank',
        limit_pinjaman: '5000000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();
    const anotherBankId = anotherBankResult[0].id;

    const anotherLoanTransactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: anotherBankId,
        tanggal_transaksi: new Date('2024-01-01'),
        keterangan_transaksi: 'Another Bank Transaction',
        jumlah_transaksi: '3000000.00',
        is_cicilan: true
      })
      .returning()
      .execute();
    const anotherLoanTransactionId = anotherLoanTransactionResult[0].id;

    // Try to update only loan_transaction_id to one that belongs to different bank
    const updateInput: UpdatePaymentInput = {
      id: testPaymentId,
      loan_transaction_id: anotherLoanTransactionId // This belongs to anotherBankId, but payment belongs to testBankId
    };

    await expect(updatePayment(updateInput)).rejects.toThrow(/loan transaction with id .* not found for bank id/i);
  });
});