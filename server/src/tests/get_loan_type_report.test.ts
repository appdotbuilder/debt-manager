import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { type LoanTypeReportInput, type CreateBankInput, type CreateLoanTransactionInput, type CreatePaymentInput } from '../schema';
import { getLoanTypeReport, getAllLoanTypeReports } from '../handlers/get_loan_type_report';

describe('getLoanTypeReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate report for loan type with transactions and payments', async () => {
    // Create test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank KTA',
        limit_pinjaman: '100000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    const bankId = bankResult[0].id;

    // Create test loan transactions
    const transaction1Result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Loan Transaction 1',
        jumlah_transaksi: '50000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    const transaction2Result = await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankId,
        tanggal_transaksi: new Date('2024-02-15'),
        keterangan_transaksi: 'Loan Transaction 2',
        jumlah_transaksi: '30000.00',
        is_cicilan: true
      })
      .returning()
      .execute();

    // Create test payments
    await db.insert(paymentsTable)
      .values({
        bank_id: bankId,
        loan_transaction_id: transaction1Result[0].id,
        tanggal_pembayaran: new Date('2024-01-20'),
        jumlah_pembayaran: '15000.00'
      })
      .execute();

    await db.insert(paymentsTable)
      .values({
        bank_id: bankId,
        loan_transaction_id: transaction2Result[0].id,
        tanggal_pembayaran: new Date('2024-02-20'),
        jumlah_pembayaran: '10000.00'
      })
      .execute();

    const input: LoanTypeReportInput = {
      jenis_pinjaman: 'KTA'
    };

    const result = await getLoanTypeReport(input);

    // Validate report data
    expect(result.jenis_pinjaman).toEqual('KTA');
    expect(result.total_loans).toEqual(80000); // 50000 + 30000
    expect(result.total_payments).toEqual(25000); // 15000 + 10000
    expect(result.outstanding_amount).toEqual(55000); // 80000 - 25000
    expect(result.transaction_count).toEqual(2);
    expect(result.payment_count).toEqual(2);
  });

  it('should return zero values for loan type with no data', async () => {
    const input: LoanTypeReportInput = {
      jenis_pinjaman: 'PAYLATER'
    };

    const result = await getLoanTypeReport(input);

    // Validate empty report
    expect(result.jenis_pinjaman).toEqual('PAYLATER');
    expect(result.total_loans).toEqual(0);
    expect(result.total_payments).toEqual(0);
    expect(result.outstanding_amount).toEqual(0);
    expect(result.transaction_count).toEqual(0);
    expect(result.payment_count).toEqual(0);
  });

  it('should handle loan type with transactions but no payments', async () => {
    // Create test bank
    const bankResult = await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank Kartu Kredit',
        limit_pinjaman: '75000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 5,
        tanggal_jatuh_tempo: 20
      })
      .returning()
      .execute();

    // Create loan transaction without payments
    await db.insert(loanTransactionsTable)
      .values({
        bank_id: bankResult[0].id,
        tanggal_transaksi: new Date('2024-03-10'),
        keterangan_transaksi: 'Credit Card Transaction',
        jumlah_transaksi: '25000.00',
        is_cicilan: false
      })
      .execute();

    const input: LoanTypeReportInput = {
      jenis_pinjaman: 'KARTU_KREDIT'
    };

    const result = await getLoanTypeReport(input);

    expect(result.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(result.total_loans).toEqual(25000);
    expect(result.total_payments).toEqual(0);
    expect(result.outstanding_amount).toEqual(25000);
    expect(result.transaction_count).toEqual(1);
    expect(result.payment_count).toEqual(0);
  });

  it('should filter by loan type correctly when multiple types exist', async () => {
    // Create banks for different loan types
    const ktaBank = await db.insert(banksTable)
      .values({
        nama_bank: 'KTA Bank',
        limit_pinjaman: '50000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 10
      })
      .returning()
      .execute();

    const creditCardBank = await db.insert(banksTable)
      .values({
        nama_bank: 'Credit Card Bank',
        limit_pinjaman: '100000.00',
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 1,
        tanggal_jatuh_tempo: 25
      })
      .returning()
      .execute();

    // Create transactions for both types
    await db.insert(loanTransactionsTable)
      .values({
        bank_id: ktaBank[0].id,
        tanggal_transaksi: new Date('2024-01-10'),
        keterangan_transaksi: 'KTA Transaction',
        jumlah_transaksi: '20000.00',
        is_cicilan: false
      })
      .execute();

    await db.insert(loanTransactionsTable)
      .values({
        bank_id: creditCardBank[0].id,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'Credit Card Transaction',
        jumlah_transaksi: '35000.00',
        is_cicilan: false
      })
      .execute();

    // Test KTA report only includes KTA data
    const ktaResult = await getLoanTypeReport({ jenis_pinjaman: 'KTA' });
    expect(ktaResult.jenis_pinjaman).toEqual('KTA');
    expect(ktaResult.total_loans).toEqual(20000);
    expect(ktaResult.transaction_count).toEqual(1);

    // Test Credit Card report only includes Credit Card data
    const creditResult = await getLoanTypeReport({ jenis_pinjaman: 'KARTU_KREDIT' });
    expect(creditResult.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(creditResult.total_loans).toEqual(35000);
    expect(creditResult.transaction_count).toEqual(1);
  });
});

describe('getAllLoanTypeReports', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate reports for all loan types', async () => {
    // Create data for multiple loan types
    const ktaBank = await db.insert(banksTable)
      .values({
        nama_bank: 'KTA Bank',
        limit_pinjaman: '50000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 10
      })
      .returning()
      .execute();

    const payLaterBank = await db.insert(banksTable)
      .values({
        nama_bank: 'PayLater Bank',
        limit_pinjaman: '25000.00',
        jenis_pinjaman: 'PAYLATER',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 30
      })
      .returning()
      .execute();

    // Create transactions
    await db.insert(loanTransactionsTable)
      .values({
        bank_id: ktaBank[0].id,
        tanggal_transaksi: new Date('2024-01-10'),
        keterangan_transaksi: 'KTA Transaction',
        jumlah_transaksi: '15000.00',
        is_cicilan: false
      })
      .execute();

    await db.insert(loanTransactionsTable)
      .values({
        bank_id: payLaterBank[0].id,
        tanggal_transaksi: new Date('2024-01-15'),
        keterangan_transaksi: 'PayLater Transaction',
        jumlah_transaksi: '8000.00',
        is_cicilan: true
      })
      .execute();

    const results = await getAllLoanTypeReports();

    // Should return reports for all 4 loan types
    expect(results).toHaveLength(4);
    
    // Find specific loan type reports
    const ktaReport = results.find(r => r.jenis_pinjaman === 'KTA');
    const payLaterReport = results.find(r => r.jenis_pinjaman === 'PAYLATER');
    const creditCardReport = results.find(r => r.jenis_pinjaman === 'KARTU_KREDIT');
    const kurReport = results.find(r => r.jenis_pinjaman === 'KUR');

    expect(ktaReport).toBeDefined();
    expect(ktaReport!.total_loans).toEqual(15000);
    expect(ktaReport!.transaction_count).toEqual(1);

    expect(payLaterReport).toBeDefined();
    expect(payLaterReport!.total_loans).toEqual(8000);
    expect(payLaterReport!.transaction_count).toEqual(1);

    // Loan types with no data should have zero values
    expect(creditCardReport).toBeDefined();
    expect(creditCardReport!.total_loans).toEqual(0);
    expect(creditCardReport!.transaction_count).toEqual(0);

    expect(kurReport).toBeDefined();
    expect(kurReport!.total_loans).toEqual(0);
    expect(kurReport!.transaction_count).toEqual(0);
  });

  it('should return all loan types even when no data exists', async () => {
    const results = await getAllLoanTypeReports();

    // Should return reports for all 4 loan types
    expect(results).toHaveLength(4);
    
    // All reports should have zero values
    results.forEach(report => {
      expect(['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR']).toContain(report.jenis_pinjaman);
      expect(report.total_loans).toEqual(0);
      expect(report.total_payments).toEqual(0);
      expect(report.outstanding_amount).toEqual(0);
      expect(report.transaction_count).toEqual(0);
      expect(report.payment_count).toEqual(0);
    });
  });

  it('should calculate outstanding amounts correctly across all types', async () => {
    // Create comprehensive test data
    const ktaBank = await db.insert(banksTable)
      .values({
        nama_bank: 'KTA Bank',
        limit_pinjaman: '100000.00',
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .returning()
      .execute();

    // Create transaction
    const transactionResult = await db.insert(loanTransactionsTable)
      .values({
        bank_id: ktaBank[0].id,
        tanggal_transaksi: new Date('2024-01-10'),
        keterangan_transaksi: 'KTA Loan',
        jumlah_transaksi: '40000.00',
        is_cicilan: false
      })
      .returning()
      .execute();

    // Create partial payment
    await db.insert(paymentsTable)
      .values({
        bank_id: ktaBank[0].id,
        loan_transaction_id: transactionResult[0].id,
        tanggal_pembayaran: new Date('2024-01-20'),
        jumlah_pembayaran: '12000.00'
      })
      .execute();

    const results = await getAllLoanTypeReports();
    const ktaReport = results.find(r => r.jenis_pinjaman === 'KTA');

    expect(ktaReport).toBeDefined();
    expect(ktaReport!.total_loans).toEqual(40000);
    expect(ktaReport!.total_payments).toEqual(12000);
    expect(ktaReport!.outstanding_amount).toEqual(28000);
  });
});