import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { deleteBank } from '../handlers/delete_bank';
import { eq } from 'drizzle-orm';

describe('deleteBank', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully delete a bank with no related records', async () => {
    // Create a test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '100000',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Delete the bank
    const result = await deleteBank(bankId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify the bank no longer exists in database
    const deletedBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, bankId))
      .execute();

    expect(deletedBank).toHaveLength(0);
  });

  it('should throw error when trying to delete non-existent bank', async () => {
    const nonExistentId = 99999;

    await expect(deleteBank(nonExistentId)).rejects.toThrow(/Bank with ID 99999 not found/);
  });

  it('should throw error when bank has related loan transactions', async () => {
    // Create a test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank with Transactions',
        limit_pinjaman: '50000',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 1,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create a related loan transaction
    await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date(),
        keterangan_transaksi: 'Test transaction',
        jumlah_transaksi: '1000',
        is_cicilan: false
      })
      .execute();

    // Attempt to delete the bank should fail
    await expect(deleteBank(bankId)).rejects.toThrow(/Cannot delete bank with ID \d+\. There are 1 related loan transactions\./);

    // Verify the bank still exists
    const existingBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, bankId))
      .execute();

    expect(existingBank).toHaveLength(1);
  });

  it('should throw error when bank has related payments only (payments without transactions)', async () => {
    // Create two banks - one for transaction, one for payments-only test
    const bankResult1 = await db.insert(banksTable)
      .values({
        nama_bank: 'Transaction Bank',
        limit_pinjaman: '50000',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 5
      })
      .returning()
      .execute();

    const bankResult2 = await db.insert(banksTable)
      .values({
        nama_bank: 'Payment Only Bank',
        limit_pinjaman: '75000',
        jenis_pinjaman: 'PAYLATER',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 10
      })
      .returning()
      .execute();

    const transactionBankId = bankResult1[0].id;
    const paymentBankId = bankResult2[0].id;

    // Create a loan transaction in the first bank
    const transactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: transactionBankId,
        tanggal_transaksi: new Date(),
        keterangan_transaksi: 'Test transaction for payment',
        jumlah_transaksi: '2000',
        is_cicilan: true
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create a payment that references the second bank (no transactions in second bank)
    await db.insert(paymentsTable)
      .values({
        bank_id: paymentBankId,
        loan_transaction_id: transactionId,
        tanggal_pembayaran: new Date(),
        jumlah_pembayaran: '500'
      })
      .execute();

    // Attempt to delete the payment bank should fail due to payments
    await expect(deleteBank(paymentBankId)).rejects.toThrow(/Cannot delete bank with ID \d+\. There are 1 related payments\./);

    // Verify the bank still exists
    const existingBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, paymentBankId))
      .execute();

    expect(existingBank).toHaveLength(1);
  });

  it('should throw error when bank has both transactions and payments', async () => {
    // Create a test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank with Both',
        limit_pinjaman: '200000',
        jenis_pinjaman: 'KUR',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 30
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create multiple loan transactions
    const transaction1Result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date(),
        keterangan_transaksi: 'First transaction',
        jumlah_transaksi: '5000',
        is_cicilan: false
      })
      .returning()
      .execute();

    const transaction2Result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date(),
        keterangan_transaksi: 'Second transaction',
        jumlah_transaksi: '3000',
        is_cicilan: true
      })
      .returning()
      .execute();

    // Create payments for both transactions
    await db.insert(paymentsTable)
      .values({
        bank_id: bankId,
        loan_transaction_id: transaction1Result[0].id,
        tanggal_pembayaran: new Date(),
        jumlah_pembayaran: '1000'
      })
      .execute();

    await db.insert(paymentsTable)
      .values({
        bank_id: bankId,
        loan_transaction_id: transaction2Result[0].id,
        tanggal_pembayaran: new Date(),
        jumlah_pembayaran: '800'
      })
      .execute();

    // Attempt to delete should fail due to transactions (checked first)
    await expect(deleteBank(bankId)).rejects.toThrow(/Cannot delete bank with ID \d+\. There are 2 related loan transactions\./);

    // Verify the bank still exists
    const existingBank = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, bankId))
      .execute();

    expect(existingBank).toHaveLength(1);
  });

  it('should handle different loan types correctly', async () => {
    // Create banks with different loan types
    const kartKreditBank = await db.insert(banksTable)
      .values({
        nama_bank: 'Kartu Kredit Bank',
        limit_pinjaman: '30000',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 5,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();

    const paylaterBank = await db.insert(banksTable)
      .values({
        nama_bank: 'Paylater Bank',
        limit_pinjaman: '15000',
        jenis_pinjaman: 'PAYLATER',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    // Both should be deletable since they have no related records
    const result1 = await deleteBank(kartKreditBank[0].id);
    const result2 = await deleteBank(paylaterBank[0].id);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Verify both banks are deleted
    const remainingBanks = await db.select()
      .from(banksTable)
      .execute();

    expect(remainingBanks).toHaveLength(0);
  });
});