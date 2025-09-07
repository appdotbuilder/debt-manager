import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { type MonthlyReportInput } from '../schema';
import { getMonthlyReport } from '../handlers/get_monthly_report';

describe('getMonthlyReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty report for month with no transactions', async () => {
    const input: MonthlyReportInput = {
      year: 2024,
      month: 1
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(1);
    expect(result.total_loans).toEqual(0);
    expect(result.total_payments).toEqual(0);
    expect(result.net_debt).toEqual(0);
    expect(result.transaction_count).toEqual(0);
    expect(result.payment_count).toEqual(0);
  });

  it('should calculate monthly report with loans only', async () => {
    // Create a test bank first
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '100000',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 15,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create loan transactions in January 2024
    await db.insert(loanTransactionsTable)
      .values([
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-01-15'),
          keterangan_transaksi: 'Purchase 1',
          jumlah_transaksi: '1500.00',
          is_cicilan: false
        },
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-01-20'),
          keterangan_transaksi: 'Purchase 2',
          jumlah_transaksi: '2500.00',
          is_cicilan: false
        }
      ])
      .execute();

    const input: MonthlyReportInput = {
      year: 2024,
      month: 1
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(1);
    expect(result.total_loans).toEqual(4000);
    expect(result.total_payments).toEqual(0);
    expect(result.net_debt).toEqual(4000);
    expect(result.transaction_count).toEqual(2);
    expect(result.payment_count).toEqual(0);
  });

  it('should calculate monthly report with payments only', async () => {
    // Create a test bank first
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '100000',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 15,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create a loan transaction first (needed for foreign key)
    const loanResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date('2023-12-15'),
        keterangan_transaksi: 'Previous Purchase',
        jumlah_transaksi: '5000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    const loanTransactionId = loanResult[0].id;

    // Create payments in January 2024
    await db.insert(paymentsTable)
      .values([
        {
          bank_id: bankId,
          loan_transaction_id: loanTransactionId,
          tanggal_pembayaran: new Date('2024-01-10'),
          jumlah_pembayaran: '1000.00'
        },
        {
          bank_id: bankId,
          loan_transaction_id: loanTransactionId,
          tanggal_pembayaran: new Date('2024-01-25'),
          jumlah_pembayaran: '2000.00'
        }
      ])
      .execute();

    const input: MonthlyReportInput = {
      year: 2024,
      month: 1
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(1);
    expect(result.total_loans).toEqual(0);
    expect(result.total_payments).toEqual(3000);
    expect(result.net_debt).toEqual(-3000); // Negative because more payments than loans
    expect(result.transaction_count).toEqual(0);
    expect(result.payment_count).toEqual(2);
  });

  it('should calculate complete monthly report with both loans and payments', async () => {
    // Create a test bank first
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '100000',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 30
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create loan transactions in February 2024
    const loanResults = await db.insert(loanTransactionsTable)
      .values([
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-02-05'),
          keterangan_transaksi: 'Loan disbursement',
          jumlah_transaksi: '10000.00',
          is_cicilan: true
        },
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-02-15'),
          keterangan_transaksi: 'Additional loan',
          jumlah_transaksi: '5000.00',
          is_cicilan: false
        }
      ])
      .returning()
      .execute();

    // Create payments in February 2024
    await db.insert(paymentsTable)
      .values([
        {
          bank_id: bankId,
          loan_transaction_id: loanResults[0].id,
          tanggal_pembayaran: new Date('2024-02-10'),
          jumlah_pembayaran: '2000.00'
        },
        {
          bank_id: bankId,
          loan_transaction_id: loanResults[1].id,
          tanggal_pembayaran: new Date('2024-02-20'),
          jumlah_pembayaran: '1500.00'
        },
        {
          bank_id: bankId,
          loan_transaction_id: loanResults[0].id,
          tanggal_pembayaran: new Date('2024-02-25'),
          jumlah_pembayaran: '2500.00'
        }
      ])
      .execute();

    const input: MonthlyReportInput = {
      year: 2024,
      month: 2
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(2);
    expect(result.total_loans).toEqual(15000);
    expect(result.total_payments).toEqual(6000);
    expect(result.net_debt).toEqual(9000);
    expect(result.transaction_count).toEqual(2);
    expect(result.payment_count).toEqual(3);
  });

  it('should only include transactions from the specified month', async () => {
    // Create a test bank first
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '100000',
        jenis_pinjaman: 'PAYLATER',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create transactions in different months
    const loanResults = await db.insert(loanTransactionsTable)
      .values([
        // January 2024 - should not be included
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-01-15'),
          keterangan_transaksi: 'January loan',
          jumlah_transaksi: '1000.00',
          is_cicilan: false
        },
        // March 2024 - should be included
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-03-01'),
          keterangan_transaksi: 'March loan 1',
          jumlah_transaksi: '2000.00',
          is_cicilan: false
        },
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-03-31'),
          keterangan_transaksi: 'March loan 2',
          jumlah_transaksi: '3000.00',
          is_cicilan: false
        },
        // April 2024 - should not be included
        {
          bank_id: bankId,
          tanggal_transaksi: new Date('2024-04-01'),
          keterangan_transaksi: 'April loan',
          jumlah_transaksi: '1500.00',
          is_cicilan: false
        }
      ])
      .returning()
      .execute();

    // Create payments in different months
    await db.insert(paymentsTable)
      .values([
        // February 2024 - should not be included
        {
          bank_id: bankId,
          loan_transaction_id: loanResults[0].id,
          tanggal_pembayaran: new Date('2024-02-15'),
          jumlah_pembayaran: '500.00'
        },
        // March 2024 - should be included
        {
          bank_id: bankId,
          loan_transaction_id: loanResults[1].id,
          tanggal_pembayaran: new Date('2024-03-15'),
          jumlah_pembayaran: '1000.00'
        }
      ])
      .execute();

    const input: MonthlyReportInput = {
      year: 2024,
      month: 3
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(3);
    expect(result.total_loans).toEqual(5000); // Only March transactions
    expect(result.total_payments).toEqual(1000); // Only March payments
    expect(result.net_debt).toEqual(4000);
    expect(result.transaction_count).toEqual(2);
    expect(result.payment_count).toEqual(1);
  });

  it('should handle decimal amounts correctly', async () => {
    // Create a test bank first
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '50000.50',
        jenis_pinjaman: 'KUR',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create loan transaction with decimal amount
    const loanResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date('2024-06-15'),
        keterangan_transaksi: 'Decimal loan',
        jumlah_transaksi: '1234.56',
        is_cicilan: false
      })
      .returning()
      .execute();

    // Create payment with decimal amount
    await db.insert(paymentsTable)
      .values({
        bank_id: bankId,
        loan_transaction_id: loanResult[0].id,
        tanggal_pembayaran: new Date('2024-06-20'),
        jumlah_pembayaran: '789.12'
      })
      .execute();

    const input: MonthlyReportInput = {
      year: 2024,
      month: 6
    };

    const result = await getMonthlyReport(input);

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(6);
    expect(result.total_loans).toEqual(1234.56);
    expect(result.total_payments).toEqual(789.12);
    expect(result.net_debt).toBeCloseTo(445.44, 2); // Use toBeCloseTo for floating point comparison
    expect(result.transaction_count).toEqual(1);
    expect(result.payment_count).toEqual(1);
  });
});