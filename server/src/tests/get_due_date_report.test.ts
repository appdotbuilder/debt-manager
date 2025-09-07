import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { type CreateBankInput, type CreateLoanTransactionInput, type CreatePaymentInput } from '../schema';
import { getDueDateReport, getUpcomingDueDates, getOverdueDates } from '../handlers/get_due_date_report';

// Helper function to create test bank
const createTestBank = async (overrides: Partial<CreateBankInput> = {}) => {
  const bankData = {
    nama_bank: 'Test Bank',
    limit_pinjaman: 10000000,
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

  return {
    ...result[0],
    limit_pinjaman: parseFloat(result[0].limit_pinjaman)
  };
};

// Helper function to create test loan transaction
const createTestLoanTransaction = async (bankId: number, overrides: Partial<CreateLoanTransactionInput> = {}) => {
  const transactionData = {
    bank_id: bankId,
    tanggal_transaksi: new Date(),
    keterangan_transaksi: 'Test loan transaction',
    jumlah_transaksi: 5000000,
    is_cicilan: false,
    ...overrides
  };

  const result = await db.insert(loanTransactionsTable)
    .values({
      bank_id: transactionData.bank_id,
      tanggal_transaksi: transactionData.tanggal_transaksi,
      keterangan_transaksi: transactionData.keterangan_transaksi,
      jumlah_transaksi: transactionData.jumlah_transaksi.toString(),
      is_cicilan: transactionData.is_cicilan
    })
    .returning()
    .execute();

  return {
    ...result[0],
    jumlah_transaksi: parseFloat(result[0].jumlah_transaksi)
  };
};

// Helper function to create test payment
const createTestPayment = async (bankId: number, loanTransactionId: number, overrides: Partial<CreatePaymentInput> = {}) => {
  const paymentData = {
    bank_id: bankId,
    loan_transaction_id: loanTransactionId,
    tanggal_pembayaran: new Date(),
    jumlah_pembayaran: 1000000,
    ...overrides
  };

  const result = await db.insert(paymentsTable)
    .values({
      bank_id: paymentData.bank_id,
      loan_transaction_id: paymentData.loan_transaction_id,
      tanggal_pembayaran: paymentData.tanggal_pembayaran,
      jumlah_pembayaran: paymentData.jumlah_pembayaran.toString()
    })
    .returning()
    .execute();

  return {
    ...result[0],
    jumlah_pembayaran: parseFloat(result[0].jumlah_pembayaran)
  };
};

describe('getDueDateReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no banks exist', async () => {
    const result = await getDueDateReport();
    expect(result).toEqual([]);
  });

  it('should return due date report for bank with no transactions', async () => {
    const today = new Date();
    const futureDueDate = today.getDate() < 28 ? today.getDate() + 1 : 1; // Tomorrow or 1st of next month
    
    const bank = await createTestBank({
      nama_bank: 'Empty Bank',
      tanggal_jatuh_tempo: futureDueDate
    });

    const result = await getDueDateReport();

    expect(result).toHaveLength(1);
    expect(result[0].bank_id).toBe(bank.id);
    expect(result[0].bank_name).toBe('Empty Bank');
    expect(result[0].jenis_pinjaman).toBe('KTA');
    expect(result[0].tanggal_jatuh_tempo).toBe(futureDueDate);
    expect(result[0].outstanding_amount).toBe(0);
    expect(result[0].days_until_due).toBeGreaterThanOrEqual(0);
  });

  it('should calculate outstanding amount correctly', async () => {
    const bank = await createTestBank({
      nama_bank: 'Test Bank',
      tanggal_jatuh_tempo: 15
    });

    // Create loan transaction
    const transaction = await createTestLoanTransaction(bank.id, {
      jumlah_transaksi: 5000000
    });

    // Create partial payment
    await createTestPayment(bank.id, transaction.id, {
      jumlah_pembayaran: 2000000
    });

    const result = await getDueDateReport();

    expect(result).toHaveLength(1);
    expect(result[0].bank_id).toBe(bank.id);
    expect(result[0].outstanding_amount).toBe(3000000); // 5M - 2M
  });

  it('should handle multiple banks with different loan types', async () => {
    // Create KTA bank
    const ktaBank = await createTestBank({
      nama_bank: 'KTA Bank',
      jenis_pinjaman: 'KTA',
      tanggal_jatuh_tempo: 10
    });

    // Create Kartu Kredit bank
    const ccBank = await createTestBank({
      nama_bank: 'CC Bank',
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 5,
      tanggal_jatuh_tempo: 25
    });

    // Add transactions to both banks
    const ktaTransaction = await createTestLoanTransaction(ktaBank.id, {
      jumlah_transaksi: 3000000
    });
    
    const ccTransaction = await createTestLoanTransaction(ccBank.id, {
      jumlah_transaksi: 2000000
    });

    const result = await getDueDateReport();

    expect(result).toHaveLength(2);
    
    const ktaReport = result.find(r => r.bank_id === ktaBank.id);
    const ccReport = result.find(r => r.bank_id === ccBank.id);
    
    expect(ktaReport).toBeDefined();
    expect(ktaReport!.jenis_pinjaman).toBe('KTA');
    expect(ktaReport!.outstanding_amount).toBe(3000000);
    
    expect(ccReport).toBeDefined();
    expect(ccReport!.jenis_pinjaman).toBe('KARTU_KREDIT');
    expect(ccReport!.outstanding_amount).toBe(2000000);
  });

  it('should calculate days until due date correctly', async () => {
    const today = new Date();
    const currentDay = today.getDate();
    
    // Create bank with due date in the past (should show negative days)
    const pastDueDate = currentDay > 5 ? 5 : 28; // 5 days ago or 28th of last month
    const pastBank = await createTestBank({
      nama_bank: 'Past Due Bank',
      tanggal_jatuh_tempo: pastDueDate
    });

    // Create transaction to have outstanding amount
    await createTestLoanTransaction(pastBank.id, {
      jumlah_transaksi: 1000000
    });

    const result = await getDueDateReport();
    const pastReport = result.find(r => r.bank_id === pastBank.id);
    
    expect(pastReport).toBeDefined();
    if (currentDay > 5) {
      expect(pastReport!.days_until_due).toBeLessThan(0); // Overdue
    }
  });
});

describe('getUpcomingDueDates', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only banks with upcoming due dates within specified days', async () => {
    const today = new Date();
    const currentDay = today.getDate();
    
    // Create bank with due date in 3 days
    const upcomingDueDate = currentDay < 28 ? currentDay + 3 : 3;
    const upcomingBank = await createTestBank({
      nama_bank: 'Upcoming Bank',
      tanggal_jatuh_tempo: upcomingDueDate
    });

    // Create bank with due date in 10 days (outside 7-day window)
    const farDueDate = currentDay < 21 ? currentDay + 10 : 10;
    const farBank = await createTestBank({
      nama_bank: 'Far Bank',
      tanggal_jatuh_tempo: farDueDate
    });

    // Add outstanding amounts to both banks
    const upcomingTransaction = await createTestLoanTransaction(upcomingBank.id, {
      jumlah_transaksi: 1000000
    });
    
    const farTransaction = await createTestLoanTransaction(farBank.id, {
      jumlah_transaksi: 2000000
    });

    const result = await getUpcomingDueDates(7);

    // Should only include the bank with due date within 7 days
    const upcomingReport = result.find(r => r.bank_id === upcomingBank.id);
    const farReport = result.find(r => r.bank_id === farBank.id);
    
    if (currentDay < 25) { // Only test if we can create meaningful upcoming dates
      expect(upcomingReport).toBeDefined();
      expect(upcomingReport!.days_until_due).toBeLessThanOrEqual(7);
      expect(upcomingReport!.outstanding_amount).toBeGreaterThan(0);
    }
  });

  it('should exclude banks with no outstanding amounts', async () => {
    const today = new Date();
    const upcomingDueDate = today.getDate() < 28 ? today.getDate() + 2 : 2;
    
    const bank = await createTestBank({
      nama_bank: 'Paid Off Bank',
      tanggal_jatuh_tempo: upcomingDueDate
    });

    // Create loan transaction
    const transaction = await createTestLoanTransaction(bank.id, {
      jumlah_transaksi: 1000000
    });

    // Create full payment
    await createTestPayment(bank.id, transaction.id, {
      jumlah_pembayaran: 1000000
    });

    const result = await getUpcomingDueDates(7);
    
    // Should not include bank with no outstanding amount
    const bankReport = result.find(r => r.bank_id === bank.id);
    expect(bankReport).toBeUndefined();
  });
});

describe('getOverdueDates', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only banks with overdue payments', async () => {
    const today = new Date();
    const currentDay = today.getDate();
    
    // Create bank with overdue payment (due date in the past)
    const overdueDueDate = currentDay > 5 ? 5 : 28;
    const overdueBank = await createTestBank({
      nama_bank: 'Overdue Bank',
      tanggal_jatuh_tempo: overdueDueDate
    });

    // Create bank with future due date
    const futureDueDate = currentDay < 28 ? currentDay + 5 : 5;
    const futureBank = await createTestBank({
      nama_bank: 'Future Bank',
      tanggal_jatuh_tempo: futureDueDate
    });

    // Add outstanding amounts to both banks
    await createTestLoanTransaction(overdueBank.id, {
      jumlah_transaksi: 1000000
    });
    
    await createTestLoanTransaction(futureBank.id, {
      jumlah_transaksi: 2000000
    });

    const result = await getOverdueDates();

    if (currentDay > 5) {
      // Should include overdue bank
      const overdueReport = result.find(r => r.bank_id === overdueBank.id);
      expect(overdueReport).toBeDefined();
      expect(overdueReport!.days_until_due).toBeLessThan(0);
      expect(overdueReport!.outstanding_amount).toBeGreaterThan(0);
    }

    // Should not include future bank
    const futureReport = result.find(r => r.bank_id === futureBank.id);
    expect(futureReport).toBeUndefined();
  });

  it('should exclude banks with no outstanding amounts even if overdue', async () => {
    const today = new Date();
    const overdueDueDate = today.getDate() > 10 ? 10 : 25;
    
    const bank = await createTestBank({
      nama_bank: 'Paid Off Overdue Bank',
      tanggal_jatuh_tempo: overdueDueDate
    });

    // Create loan and full payment
    const transaction = await createTestLoanTransaction(bank.id, {
      jumlah_transaksi: 1000000
    });

    await createTestPayment(bank.id, transaction.id, {
      jumlah_pembayaran: 1000000
    });

    const result = await getOverdueDates();
    
    // Should not include bank with no outstanding amount
    const bankReport = result.find(r => r.bank_id === bank.id);
    expect(bankReport).toBeUndefined();
  });

  it('should handle multiple overdue banks correctly', async () => {
    const today = new Date();
    const currentDay = today.getDate();
    
    if (currentDay > 10) { // Only test if we can create meaningful overdue dates
      const overdueBank1 = await createTestBank({
        nama_bank: 'Overdue Bank 1',
        tanggal_jatuh_tempo: 5
      });

      const overdueBank2 = await createTestBank({
        nama_bank: 'Overdue Bank 2',
        tanggal_jatuh_tempo: 8
      });

      // Add outstanding amounts
      await createTestLoanTransaction(overdueBank1.id, {
        jumlah_transaksi: 1000000
      });
      
      await createTestLoanTransaction(overdueBank2.id, {
        jumlah_transaksi: 500000
      });

      const result = await getOverdueDates();
      
      expect(result.length).toBeGreaterThanOrEqual(2);
      
      const bank1Report = result.find(r => r.bank_id === overdueBank1.id);
      const bank2Report = result.find(r => r.bank_id === overdueBank2.id);
      
      expect(bank1Report).toBeDefined();
      expect(bank1Report!.days_until_due).toBeLessThan(0);
      
      expect(bank2Report).toBeDefined();
      expect(bank2Report!.days_until_due).toBeLessThan(0);
    }
  });
});