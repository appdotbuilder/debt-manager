import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { deletePayment } from '../handlers/delete_payment';
import { eq } from 'drizzle-orm';

describe('deletePayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an existing payment', async () => {
    // Create test bank
    const [bank] = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 1,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    // Create test loan transaction
    const [loanTransaction] = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bank.id,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Test transaction',
        jumlah_transaksi: '500000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    // Create test payment
    const [payment] = await db.insert(paymentsTable)
      .values({
        bank_id: bank.id,
        loan_transaction_id: loanTransaction.id,
        tanggal_pembayaran: new Date('2024-01-20'),
        jumlah_pembayaran: '250000.00'
      })
      .returning()
      .execute();

    // Delete the payment
    const result = await deletePayment(payment.id);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify payment no longer exists in database
    const deletedPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment.id))
      .execute();

    expect(deletedPayments).toHaveLength(0);
  });

  it('should return false for non-existent payment', async () => {
    // Try to delete a payment with non-existent ID
    const result = await deletePayment(99999);

    // Verify deletion was not successful
    expect(result.success).toBe(false);
  });

  it('should not affect other payments when deleting one payment', async () => {
    // Create test bank
    const [bank] = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 1,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    // Create test loan transaction
    const [loanTransaction] = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bank.id,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Test transaction',
        jumlah_transaksi: '500000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    // Create two test payments
    const [payment1] = await db.insert(paymentsTable)
      .values({
        bank_id: bank.id,
        loan_transaction_id: loanTransaction.id,
        tanggal_pembayaran: new Date('2024-01-20'),
        jumlah_pembayaran: '250000.00'
      })
      .returning()
      .execute();

    const [payment2] = await db.insert(paymentsTable)
      .values({
        bank_id: bank.id,
        loan_transaction_id: loanTransaction.id,
        tanggal_pembayaran: new Date('2024-01-22'),
        jumlah_pembayaran: '100000.00'
      })
      .returning()
      .execute();

    // Delete the first payment
    const result = await deletePayment(payment1.id);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify first payment is deleted
    const deletedPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment1.id))
      .execute();

    expect(deletedPayments).toHaveLength(0);

    // Verify second payment still exists
    const remainingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment2.id))
      .execute();

    expect(remainingPayments).toHaveLength(1);
    expect(remainingPayments[0].id).toBe(payment2.id);
    expect(parseFloat(remainingPayments[0].jumlah_pembayaran)).toBe(100000);
  });

  it('should handle multiple delete operations correctly', async () => {
    // Create test bank
    const [bank] = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '10000000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    // Create test loan transaction
    const [loanTransaction] = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bank.id,
        tanggal_transaksi: new Date('2024-02-10'),
        keterangan_transaksi: 'Test transaction',
        jumlah_transaksi: '1000000.00',
        is_cicilan: true
      })
      .returning()
      .execute();

    // Create test payment
    const [payment] = await db.insert(paymentsTable)
      .values({
        bank_id: bank.id,
        loan_transaction_id: loanTransaction.id,
        tanggal_pembayaran: new Date('2024-02-15'),
        jumlah_pembayaran: '200000.00'
      })
      .returning()
      .execute();

    // First deletion should succeed
    const result1 = await deletePayment(payment.id);
    expect(result1.success).toBe(true);

    // Second deletion of same payment should fail (not found)
    const result2 = await deletePayment(payment.id);
    expect(result2.success).toBe(false);

    // Verify payment is actually gone
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, payment.id))
      .execute();

    expect(payments).toHaveLength(0);
  });
});