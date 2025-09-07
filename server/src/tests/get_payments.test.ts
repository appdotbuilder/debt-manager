import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { getPayments, getPaymentsByBank, getPaymentsByTransaction } from '../handlers/get_payments';

// Test data setup
const testBank = {
  nama_bank: 'Test Bank',
  limit_pinjaman: '50000.00', // String for numeric column
  jenis_pinjaman: 'KARTU_KREDIT' as const,
  tanggal_cetak_billing: 1,
  tanggal_jatuh_tempo: 15
};

const testBank2 = {
  nama_bank: 'Second Bank',
  limit_pinjaman: '30000.00', // String for numeric column
  jenis_pinjaman: 'KTA' as const,
  tanggal_cetak_billing: null,
  tanggal_jatuh_tempo: 20
};

const testTransaction = {
  tanggal_transaksi: new Date('2024-01-15'),
  keterangan_transaksi: 'Test Purchase',
  jumlah_transaksi: '1500.00', // String for numeric column
  is_cicilan: false
};

const testTransaction2 = {
  tanggal_transaksi: new Date('2024-01-20'),
  keterangan_transaksi: 'Another Purchase',
  jumlah_transaksi: '2000.00', // String for numeric column
  is_cicilan: true
};

describe('getPayments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no payments exist', async () => {
    const result = await getPayments();
    expect(result).toEqual([]);
  });

  it('should fetch all payments with correct data types', async () => {
    // Create prerequisite data
    const [bank] = await db.insert(banksTable).values(testBank).returning().execute();
    const [transaction] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank.id })
      .returning()
      .execute();

    // Create payment
    const paymentData = {
      bank_id: bank.id,
      loan_transaction_id: transaction.id,
      tanggal_pembayaran: new Date('2024-01-16'),
      jumlah_pembayaran: '500.00' // String for numeric column
    };

    await db.insert(paymentsTable).values(paymentData).execute();

    const result = await getPayments();

    expect(result).toHaveLength(1);
    expect(result[0].bank_id).toEqual(bank.id);
    expect(result[0].loan_transaction_id).toEqual(transaction.id);
    expect(result[0].jumlah_pembayaran).toEqual(500.00);
    expect(typeof result[0].jumlah_pembayaran).toBe('number');
    expect(result[0].tanggal_pembayaran).toBeInstanceOf(Date);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should fetch multiple payments correctly', async () => {
    // Create prerequisite data
    const [bank1] = await db.insert(banksTable).values(testBank).returning().execute();
    const [bank2] = await db.insert(banksTable).values(testBank2).returning().execute();
    const [transaction1] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank1.id })
      .returning()
      .execute();
    const [transaction2] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction2, bank_id: bank2.id })
      .returning()
      .execute();

    // Create payments
    const payment1Data = {
      bank_id: bank1.id,
      loan_transaction_id: transaction1.id,
      tanggal_pembayaran: new Date('2024-01-16'),
      jumlah_pembayaran: '500.00'
    };

    const payment2Data = {
      bank_id: bank2.id,
      loan_transaction_id: transaction2.id,
      tanggal_pembayaran: new Date('2024-01-21'),
      jumlah_pembayaran: '750.50'
    };

    await db.insert(paymentsTable).values([payment1Data, payment2Data]).execute();

    const result = await getPayments();

    expect(result).toHaveLength(2);
    
    // Check first payment
    const firstPayment = result.find(p => p.bank_id === bank1.id);
    expect(firstPayment).toBeDefined();
    expect(firstPayment!.jumlah_pembayaran).toEqual(500.00);
    expect(typeof firstPayment!.jumlah_pembayaran).toBe('number');

    // Check second payment
    const secondPayment = result.find(p => p.bank_id === bank2.id);
    expect(secondPayment).toBeDefined();
    expect(secondPayment!.jumlah_pembayaran).toEqual(750.50);
    expect(typeof secondPayment!.jumlah_pembayaran).toBe('number');
  });
});

describe('getPaymentsByBank', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when bank has no payments', async () => {
    const result = await getPaymentsByBank(999);
    expect(result).toEqual([]);
  });

  it('should fetch payments for specific bank only', async () => {
    // Create prerequisite data
    const [bank1] = await db.insert(banksTable).values(testBank).returning().execute();
    const [bank2] = await db.insert(banksTable).values(testBank2).returning().execute();
    const [transaction1] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank1.id })
      .returning()
      .execute();
    const [transaction2] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction2, bank_id: bank2.id })
      .returning()
      .execute();

    // Create payments for both banks
    const payment1Data = {
      bank_id: bank1.id,
      loan_transaction_id: transaction1.id,
      tanggal_pembayaran: new Date('2024-01-16'),
      jumlah_pembayaran: '500.00'
    };

    const payment2Data = {
      bank_id: bank2.id,
      loan_transaction_id: transaction2.id,
      tanggal_pembayaran: new Date('2024-01-21'),
      jumlah_pembayaran: '750.50'
    };

    const payment3Data = {
      bank_id: bank1.id, // Another payment for bank1
      loan_transaction_id: transaction1.id,
      tanggal_pembayaran: new Date('2024-01-17'),
      jumlah_pembayaran: '300.25'
    };

    await db.insert(paymentsTable).values([payment1Data, payment2Data, payment3Data]).execute();

    // Test filtering by bank1
    const bank1Payments = await getPaymentsByBank(bank1.id);
    expect(bank1Payments).toHaveLength(2);
    bank1Payments.forEach(payment => {
      expect(payment.bank_id).toEqual(bank1.id);
      expect(typeof payment.jumlah_pembayaran).toBe('number');
    });

    // Test filtering by bank2
    const bank2Payments = await getPaymentsByBank(bank2.id);
    expect(bank2Payments).toHaveLength(1);
    expect(bank2Payments[0].bank_id).toEqual(bank2.id);
    expect(bank2Payments[0].jumlah_pembayaran).toEqual(750.50);
    expect(typeof bank2Payments[0].jumlah_pembayaran).toBe('number');
  });

  it('should handle numeric conversion correctly for bank payments', async () => {
    // Create prerequisite data
    const [bank] = await db.insert(banksTable).values(testBank).returning().execute();
    const [transaction] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank.id })
      .returning()
      .execute();

    // Create payment with decimal amount
    const paymentData = {
      bank_id: bank.id,
      loan_transaction_id: transaction.id,
      tanggal_pembayaran: new Date('2024-01-16'),
      jumlah_pembayaran: '1234.56'
    };

    await db.insert(paymentsTable).values(paymentData).execute();

    const result = await getPaymentsByBank(bank.id);

    expect(result).toHaveLength(1);
    expect(result[0].jumlah_pembayaran).toEqual(1234.56);
    expect(typeof result[0].jumlah_pembayaran).toBe('number');
  });
});

describe('getPaymentsByTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when transaction has no payments', async () => {
    const result = await getPaymentsByTransaction(999);
    expect(result).toEqual([]);
  });

  it('should fetch payments for specific transaction only', async () => {
    // Create prerequisite data
    const [bank] = await db.insert(banksTable).values(testBank).returning().execute();
    const [transaction1] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank.id })
      .returning()
      .execute();
    const [transaction2] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction2, bank_id: bank.id })
      .returning()
      .execute();

    // Create payments for both transactions
    const payment1Data = {
      bank_id: bank.id,
      loan_transaction_id: transaction1.id,
      tanggal_pembayaran: new Date('2024-01-16'),
      jumlah_pembayaran: '500.00'
    };

    const payment2Data = {
      bank_id: bank.id,
      loan_transaction_id: transaction2.id,
      tanggal_pembayaran: new Date('2024-01-21'),
      jumlah_pembayaran: '750.50'
    };

    const payment3Data = {
      bank_id: bank.id,
      loan_transaction_id: transaction1.id, // Another payment for transaction1
      tanggal_pembayaran: new Date('2024-01-17'),
      jumlah_pembayaran: '250.75'
    };

    await db.insert(paymentsTable).values([payment1Data, payment2Data, payment3Data]).execute();

    // Test filtering by transaction1
    const transaction1Payments = await getPaymentsByTransaction(transaction1.id);
    expect(transaction1Payments).toHaveLength(2);
    transaction1Payments.forEach(payment => {
      expect(payment.loan_transaction_id).toEqual(transaction1.id);
      expect(typeof payment.jumlah_pembayaran).toBe('number');
    });

    // Test filtering by transaction2
    const transaction2Payments = await getPaymentsByTransaction(transaction2.id);
    expect(transaction2Payments).toHaveLength(1);
    expect(transaction2Payments[0].loan_transaction_id).toEqual(transaction2.id);
    expect(transaction2Payments[0].jumlah_pembayaran).toEqual(750.50);
    expect(typeof transaction2Payments[0].jumlah_pembayaran).toBe('number');
  });

  it('should handle multiple payments per transaction correctly', async () => {
    // Create prerequisite data
    const [bank] = await db.insert(banksTable).values(testBank).returning().execute();
    const [transaction] = await db.insert(loanTransactionsTable)
      .values({ ...testTransaction, bank_id: bank.id })
      .returning()
      .execute();

    // Create multiple payments for the same transaction
    const paymentsData = [
      {
        bank_id: bank.id,
        loan_transaction_id: transaction.id,
        tanggal_pembayaran: new Date('2024-01-16'),
        jumlah_pembayaran: '100.00'
      },
      {
        bank_id: bank.id,
        loan_transaction_id: transaction.id,
        tanggal_pembayaran: new Date('2024-01-17'),
        jumlah_pembayaran: '200.50'
      },
      {
        bank_id: bank.id,
        loan_transaction_id: transaction.id,
        tanggal_pembayaran: new Date('2024-01-18'),
        jumlah_pembayaran: '300.75'
      }
    ];

    await db.insert(paymentsTable).values(paymentsData).execute();

    const result = await getPaymentsByTransaction(transaction.id);

    expect(result).toHaveLength(3);
    
    // Verify all payments belong to the correct transaction
    result.forEach(payment => {
      expect(payment.loan_transaction_id).toEqual(transaction.id);
      expect(payment.bank_id).toEqual(bank.id);
      expect(typeof payment.jumlah_pembayaran).toBe('number');
    });

    // Verify specific amounts
    const amounts = result.map(p => p.jumlah_pembayaran).sort();
    expect(amounts).toEqual([100.00, 200.50, 300.75]);
  });
});