import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { deleteLoanTransaction } from '../handlers/delete_loan_transaction';
import { eq } from 'drizzle-orm';

describe('deleteLoanTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testBankId: number;
  let testTransactionId: number;
  let testPaymentId: number;

  beforeEach(async () => {
    // Create a test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 15,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();
    
    testBankId = bankResult[0].id;

    // Create a test loan transaction
    const transactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: testBankId,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Test Transaction',
        jumlah_transaksi: '500000.00',
        is_cicilan: false
      })
      .returning()
      .execute();
    
    testTransactionId = transactionResult[0].id;

    // Create a related payment
    const paymentResult = await db.insert(paymentsTable)
      .values({
        bank_id: testBankId,
        loan_transaction_id: testTransactionId,
        tanggal_pembayaran: new Date('2024-01-20'),
        jumlah_pembayaran: '200000.00'
      })
      .returning()
      .execute();
    
    testPaymentId = paymentResult[0].id;
  });

  it('should successfully delete a loan transaction and its related payments', async () => {
    const result = await deleteLoanTransaction(testTransactionId);

    expect(result.success).toBe(true);

    // Verify transaction is deleted
    const transactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, testTransactionId))
      .execute();
    
    expect(transactions).toHaveLength(0);

    // Verify related payments are deleted
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, testTransactionId))
      .execute();
    
    expect(payments).toHaveLength(0);
  });

  it('should delete only related payments, not other payments', async () => {
    // Create another transaction with its own payment
    const anotherTransactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: testBankId,
        tanggal_transaksi: new Date('2024-01-16'),
        keterangan_transaksi: 'Another Transaction',
        jumlah_transaksi: '300000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    const anotherTransactionId = anotherTransactionResult[0].id;

    const anotherPaymentResult = await db.insert(paymentsTable)
      .values({
        bank_id: testBankId,
        loan_transaction_id: anotherTransactionId,
        tanggal_pembayaran: new Date('2024-01-22'),
        jumlah_pembayaran: '150000.00'
      })
      .returning()
      .execute();

    const anotherPaymentId = anotherPaymentResult[0].id;

    // Delete the first transaction
    const result = await deleteLoanTransaction(testTransactionId);

    expect(result.success).toBe(true);

    // Verify the first transaction and its payment are deleted
    const deletedTransactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, testTransactionId))
      .execute();
    
    expect(deletedTransactions).toHaveLength(0);

    const deletedPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, testPaymentId))
      .execute();
    
    expect(deletedPayments).toHaveLength(0);

    // Verify the other transaction and payment still exist
    const remainingTransactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, anotherTransactionId))
      .execute();
    
    expect(remainingTransactions).toHaveLength(1);

    const remainingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, anotherPaymentId))
      .execute();
    
    expect(remainingPayments).toHaveLength(1);
  });

  it('should delete transaction even if it has no related payments', async () => {
    // Create a transaction without payments
    const transactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: testBankId,
        tanggal_transaksi: new Date('2024-01-17'),
        keterangan_transaksi: 'Transaction without payments',
        jumlah_transaksi: '100000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    const transactionWithoutPaymentsId = transactionResult[0].id;

    const result = await deleteLoanTransaction(transactionWithoutPaymentsId);

    expect(result.success).toBe(true);

    // Verify transaction is deleted
    const transactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, transactionWithoutPaymentsId))
      .execute();
    
    expect(transactions).toHaveLength(0);
  });

  it('should delete transaction with multiple related payments', async () => {
    // Create additional payments for the same transaction
    await db.insert(paymentsTable)
      .values({
        bank_id: testBankId,
        loan_transaction_id: testTransactionId,
        tanggal_pembayaran: new Date('2024-01-25'),
        jumlah_pembayaran: '150000.00'
      })
      .execute();

    await db.insert(paymentsTable)
      .values({
        bank_id: testBankId,
        loan_transaction_id: testTransactionId,
        tanggal_pembayaran: new Date('2024-01-30'),
        jumlah_pembayaran: '150000.00'
      })
      .execute();

    // Verify we have 3 payments for this transaction
    const initialPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, testTransactionId))
      .execute();
    
    expect(initialPayments).toHaveLength(3);

    // Delete the transaction
    const result = await deleteLoanTransaction(testTransactionId);

    expect(result.success).toBe(true);

    // Verify all related payments are deleted
    const remainingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.loan_transaction_id, testTransactionId))
      .execute();
    
    expect(remainingPayments).toHaveLength(0);

    // Verify transaction is deleted
    const transactions = await db.select()
      .from(loanTransactionsTable)
      .where(eq(loanTransactionsTable.id, testTransactionId))
      .execute();
    
    expect(transactions).toHaveLength(0);
  });

  it('should throw error for non-existent transaction ID', async () => {
    const nonExistentId = 99999;

    await expect(deleteLoanTransaction(nonExistentId))
      .rejects
      .toThrow(/Loan transaction with ID 99999 not found/i);
  });
});