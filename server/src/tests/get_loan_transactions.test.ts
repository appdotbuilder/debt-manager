import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable, loanTransactionsTable } from '../db/schema';
import { getLoanTransactions, getLoanTransactionsByBank } from '../handlers/get_loan_transactions';

// Test data
const testBank1 = {
  nama_bank: 'BCA',
  limit_pinjaman: '10000000',
  jenis_pinjaman: 'KARTU_KREDIT' as const,
  tanggal_cetak_billing: 15,
  tanggal_jatuh_tempo: 20
};

const testBank2 = {
  nama_bank: 'Mandiri',
  limit_pinjaman: '5000000',
  jenis_pinjaman: 'KTA' as const,
  tanggal_cetak_billing: null,
  tanggal_jatuh_tempo: 10
};

const testTransaction1 = {
  keterangan_transaksi: 'Pembelian laptop',
  jumlah_transaksi: '15000000',
  tanggal_transaksi: new Date('2024-01-15'),
  is_cicilan: false
};

const testTransaction2 = {
  keterangan_transaksi: 'Cicilan motor',
  jumlah_transaksi: '2500000',
  tanggal_transaksi: new Date('2024-01-10'),
  is_cicilan: true
};

const testTransaction3 = {
  keterangan_transaksi: 'Belanja bulanan',
  jumlah_transaksi: '1200000',
  tanggal_transaksi: new Date('2024-01-20'),
  is_cicilan: false
};

describe('getLoanTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no transactions exist', async () => {
    const result = await getLoanTransactions();
    expect(result).toEqual([]);
  });

  it('should fetch all loan transactions', async () => {
    // Create test banks
    const banks = await db.insert(banksTable)
      .values([testBank1, testBank2])
      .returning()
      .execute();

    const bank1 = banks[0];
    const bank2 = banks[1];

    // Create test transactions
    await db.insert(loanTransactionsTable)
      .values([
        {
          ...testTransaction1,
          bank_id: bank1.id
        },
        {
          ...testTransaction2,
          bank_id: bank1.id
        },
        {
          ...testTransaction3,
          bank_id: bank2.id
        }
      ])
      .execute();

    const result = await getLoanTransactions();

    expect(result).toHaveLength(3);
    
    // Verify numeric conversion
    result.forEach(transaction => {
      expect(typeof transaction.jumlah_transaksi).toBe('number');
      expect(transaction.jumlah_transaksi).toBeGreaterThan(0);
    });

    // Verify basic properties
    expect(result.some(t => t.keterangan_transaksi === 'Pembelian laptop')).toBe(true);
    expect(result.some(t => t.keterangan_transaksi === 'Cicilan motor')).toBe(true);
    expect(result.some(t => t.keterangan_transaksi === 'Belanja bulanan')).toBe(true);
  });

  it('should return transactions ordered by date descending', async () => {
    // Create test bank
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    // Create transactions with different dates
    await db.insert(loanTransactionsTable)
      .values([
        {
          ...testTransaction1,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-10')
        },
        {
          ...testTransaction2,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-20')
        },
        {
          ...testTransaction3,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-15')
        }
      ])
      .execute();

    const result = await getLoanTransactions();

    expect(result).toHaveLength(3);
    
    // Verify descending order
    expect(result[0].tanggal_transaksi >= result[1].tanggal_transaksi).toBe(true);
    expect(result[1].tanggal_transaksi >= result[2].tanggal_transaksi).toBe(true);
  });

  it('should handle numeric field conversion correctly', async () => {
    // Create test bank
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    // Create transaction with specific amount
    await db.insert(loanTransactionsTable)
      .values({
        ...testTransaction1,
        bank_id: bank[0].id,
        jumlah_transaksi: '123456.78'
      })
      .execute();

    const result = await getLoanTransactions();

    expect(result).toHaveLength(1);
    expect(typeof result[0].jumlah_transaksi).toBe('number');
    expect(result[0].jumlah_transaksi).toBe(123456.78);
  });
});

describe('getLoanTransactionsByBank', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no transactions exist for bank', async () => {
    // Create test bank but no transactions
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    const result = await getLoanTransactionsByBank(bank[0].id);
    expect(result).toEqual([]);
  });

  it('should fetch transactions for specific bank only', async () => {
    // Create test banks
    const banks = await db.insert(banksTable)
      .values([testBank1, testBank2])
      .returning()
      .execute();

    const bank1 = banks[0];
    const bank2 = banks[1];

    // Create transactions for both banks
    await db.insert(loanTransactionsTable)
      .values([
        {
          ...testTransaction1,
          bank_id: bank1.id,
          keterangan_transaksi: 'Bank1 Transaction 1'
        },
        {
          ...testTransaction2,
          bank_id: bank1.id,
          keterangan_transaksi: 'Bank1 Transaction 2'
        },
        {
          ...testTransaction3,
          bank_id: bank2.id,
          keterangan_transaksi: 'Bank2 Transaction'
        }
      ])
      .execute();

    const resultBank1 = await getLoanTransactionsByBank(bank1.id);
    const resultBank2 = await getLoanTransactionsByBank(bank2.id);

    // Bank 1 should have 2 transactions
    expect(resultBank1).toHaveLength(2);
    expect(resultBank1.every(t => t.bank_id === bank1.id)).toBe(true);
    expect(resultBank1.some(t => t.keterangan_transaksi === 'Bank1 Transaction 1')).toBe(true);
    expect(resultBank1.some(t => t.keterangan_transaksi === 'Bank1 Transaction 2')).toBe(true);

    // Bank 2 should have 1 transaction
    expect(resultBank2).toHaveLength(1);
    expect(resultBank2[0].bank_id).toBe(bank2.id);
    expect(resultBank2[0].keterangan_transaksi).toBe('Bank2 Transaction');
  });

  it('should return transactions ordered by date descending', async () => {
    // Create test bank
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    // Create transactions with different dates
    await db.insert(loanTransactionsTable)
      .values([
        {
          ...testTransaction1,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-05')
        },
        {
          ...testTransaction2,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-25')
        },
        {
          ...testTransaction3,
          bank_id: bank[0].id,
          tanggal_transaksi: new Date('2024-01-15')
        }
      ])
      .execute();

    const result = await getLoanTransactionsByBank(bank[0].id);

    expect(result).toHaveLength(3);
    
    // Verify descending order by date
    expect(result[0].tanggal_transaksi >= result[1].tanggal_transaksi).toBe(true);
    expect(result[1].tanggal_transaksi >= result[2].tanggal_transaksi).toBe(true);
  });

  it('should handle numeric field conversion correctly', async () => {
    // Create test bank
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    // Create transaction with specific amounts
    await db.insert(loanTransactionsTable)
      .values([
        {
          ...testTransaction1,
          bank_id: bank[0].id,
          jumlah_transaksi: '987654.32'
        },
        {
          ...testTransaction2,
          bank_id: bank[0].id,
          jumlah_transaksi: '100000.00'
        }
      ])
      .execute();

    const result = await getLoanTransactionsByBank(bank[0].id);

    expect(result).toHaveLength(2);
    
    result.forEach(transaction => {
      expect(typeof transaction.jumlah_transaksi).toBe('number');
      expect(transaction.jumlah_transaksi).toBeGreaterThan(0);
    });

    const amounts = result.map(t => t.jumlah_transaksi).sort();
    expect(amounts).toContain(100000.00);
    expect(amounts).toContain(987654.32);
  });

  it('should return empty array for non-existent bank', async () => {
    const result = await getLoanTransactionsByBank(999999);
    expect(result).toEqual([]);
  });

  it('should verify all transaction fields are present', async () => {
    // Create test bank
    const bank = await db.insert(banksTable)
      .values(testBank1)
      .returning()
      .execute();

    // Create transaction
    await db.insert(loanTransactionsTable)
      .values({
        ...testTransaction1,
        bank_id: bank[0].id
      })
      .execute();

    const result = await getLoanTransactionsByBank(bank[0].id);

    expect(result).toHaveLength(1);
    
    const transaction = result[0];
    expect(transaction.id).toBeDefined();
    expect(transaction.bank_id).toBe(bank[0].id);
    expect(transaction.tanggal_transaksi).toBeInstanceOf(Date);
    expect(transaction.keterangan_transaksi).toBe('Pembelian laptop');
    expect(typeof transaction.jumlah_transaksi).toBe('number');
    expect(typeof transaction.is_cicilan).toBe('boolean');
    expect(transaction.created_at).toBeInstanceOf(Date);
    expect(transaction.updated_at).toBeInstanceOf(Date);
  });
});