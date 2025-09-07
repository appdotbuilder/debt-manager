import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable } from '../db/schema';
import { type CreateBankInput } from '../schema';
import { getBanks } from '../handlers/get_banks';

// Test data for different loan types
const testBanks: CreateBankInput[] = [
  {
    nama_bank: 'BCA',
    limit_pinjaman: 10000000,
    jenis_pinjaman: 'KARTU_KREDIT',
    tanggal_cetak_billing: 15,
    tanggal_jatuh_tempo: 20
  },
  {
    nama_bank: 'BNI PayLater',
    limit_pinjaman: 5000000,
    jenis_pinjaman: 'PAYLATER',
    tanggal_cetak_billing: null,
    tanggal_jatuh_tempo: 10
  },
  {
    nama_bank: 'Mandiri KTA',
    limit_pinjaman: 25000000,
    jenis_pinjaman: 'KTA',
    tanggal_cetak_billing: null,
    tanggal_jatuh_tempo: 5
  }
];

describe('getBanks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no banks exist', async () => {
    const result = await getBanks();

    expect(result).toEqual([]);
  });

  it('should return all banks with correct data types', async () => {
    // Create test banks
    for (const bankData of testBanks) {
      await db.insert(banksTable)
        .values({
          ...bankData,
          limit_pinjaman: bankData.limit_pinjaman.toString() // Convert to string for insertion
        })
        .execute();
    }

    const result = await getBanks();

    expect(result).toHaveLength(3);

    // Verify each bank has correct structure and types
    result.forEach(bank => {
      expect(bank.id).toBeDefined();
      expect(typeof bank.nama_bank).toBe('string');
      expect(typeof bank.limit_pinjaman).toBe('number'); // Should be converted back to number
      expect(['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR']).toContain(bank.jenis_pinjaman);
      expect(typeof bank.tanggal_jatuh_tempo).toBe('number');
      expect(bank.created_at).toBeInstanceOf(Date);
      expect(bank.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return banks with correct data values', async () => {
    // Create a specific test bank
    await db.insert(banksTable)
      .values({
        nama_bank: 'Test Bank',
        limit_pinjaman: '15000000.50', // Insert as string
        jenis_pinjaman: 'KARTU_KREDIT',
        tanggal_cetak_billing: 25,
        tanggal_jatuh_tempo: 30
      })
      .execute();

    const result = await getBanks();

    expect(result).toHaveLength(1);

    const bank = result[0];
    expect(bank.nama_bank).toBe('Test Bank');
    expect(bank.limit_pinjaman).toBe(15000000.50); // Should be converted to number
    expect(bank.jenis_pinjaman).toBe('KARTU_KREDIT');
    expect(bank.tanggal_cetak_billing).toBe(25);
    expect(bank.tanggal_jatuh_tempo).toBe(30);
  });

  it('should handle different loan types correctly', async () => {
    // Create banks with different loan types
    const bankTypes = ['KARTU_KREDIT', 'PAYLATER', 'KTA', 'KUR'] as const;
    
    for (const [index, loanType] of bankTypes.entries()) {
      await db.insert(banksTable)
        .values({
          nama_bank: `Bank ${loanType}`,
          limit_pinjaman: ((index + 1) * 1000000).toString(),
          jenis_pinjaman: loanType,
          tanggal_cetak_billing: loanType === 'KARTU_KREDIT' ? 15 : null,
          tanggal_jatuh_tempo: (index + 1) * 5
        })
        .execute();
    }

    const result = await getBanks();

    expect(result).toHaveLength(4);

    // Verify each loan type is present
    const resultTypes = result.map(bank => bank.jenis_pinjaman);
    bankTypes.forEach(type => {
      expect(resultTypes).toContain(type);
    });

    // Verify Kartu Kredit has billing date, others don't
    const kartruKreditBank = result.find(bank => bank.jenis_pinjaman === 'KARTU_KREDIT');
    expect(kartruKreditBank?.tanggal_cetak_billing).toBe(15);

    const nonKreditBanks = result.filter(bank => bank.jenis_pinjaman !== 'KARTU_KREDIT');
    nonKreditBanks.forEach(bank => {
      expect(bank.tanggal_cetak_billing).toBeNull();
    });
  });

  it('should handle large numbers correctly', async () => {
    // Test with a large limit amount
    const largeAmount = 999999999.99;
    
    await db.insert(banksTable)
      .values({
        nama_bank: 'High Limit Bank',
        limit_pinjaman: largeAmount.toString(),
        jenis_pinjaman: 'KTA',
        tanggal_cetak_billing: null,
        tanggal_jatuh_tempo: 15
      })
      .execute();

    const result = await getBanks();

    expect(result).toHaveLength(1);
    expect(result[0].limit_pinjaman).toBe(largeAmount);
    expect(typeof result[0].limit_pinjaman).toBe('number');
  });
});