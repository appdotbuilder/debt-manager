import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { banksTable } from '../db/schema';
import { type CreateBankInput } from '../schema';
import { createBank } from '../handlers/create_bank';
import { eq } from 'drizzle-orm';

describe('createBank', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a Kartu Kredit bank with billing date', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'BCA Credit Card',
      limit_pinjaman: 50000000,
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 15,
      tanggal_jatuh_tempo: 25
    };

    const result = await createBank(testInput);

    // Basic field validation
    expect(result.nama_bank).toEqual('BCA Credit Card');
    expect(result.limit_pinjaman).toEqual(50000000);
    expect(typeof result.limit_pinjaman).toEqual('number');
    expect(result.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(result.tanggal_cetak_billing).toEqual(15);
    expect(result.tanggal_jatuh_tempo).toEqual(25);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a KTA bank without billing date', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'Mandiri KTA',
      limit_pinjaman: 100000000,
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 10
    };

    const result = await createBank(testInput);

    // Basic field validation
    expect(result.nama_bank).toEqual('Mandiri KTA');
    expect(result.limit_pinjaman).toEqual(100000000);
    expect(typeof result.limit_pinjaman).toEqual('number');
    expect(result.jenis_pinjaman).toEqual('KTA');
    expect(result.tanggal_cetak_billing).toBeNull();
    expect(result.tanggal_jatuh_tempo).toEqual(10);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a PAYLATER bank without billing date', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'Shopee PayLater',
      limit_pinjaman: 5000000,
      jenis_pinjaman: 'PAYLATER',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 30
    };

    const result = await createBank(testInput);

    // Basic field validation
    expect(result.nama_bank).toEqual('Shopee PayLater');
    expect(result.limit_pinjaman).toEqual(5000000);
    expect(typeof result.limit_pinjaman).toEqual('number');
    expect(result.jenis_pinjaman).toEqual('PAYLATER');
    expect(result.tanggal_cetak_billing).toBeNull();
    expect(result.tanggal_jatuh_tempo).toEqual(30);
    expect(result.id).toBeDefined();
  });

  it('should create a KUR bank without billing date', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'BRI KUR',
      limit_pinjaman: 25000000,
      jenis_pinjaman: 'KUR',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 5
    };

    const result = await createBank(testInput);

    // Basic field validation
    expect(result.nama_bank).toEqual('BRI KUR');
    expect(result.limit_pinjaman).toEqual(25000000);
    expect(typeof result.limit_pinjaman).toEqual('number');
    expect(result.jenis_pinjaman).toEqual('KUR');
    expect(result.tanggal_cetak_billing).toBeNull();
    expect(result.tanggal_jatuh_tempo).toEqual(5);
  });

  it('should save bank to database correctly', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'Test Bank',
      limit_pinjaman: 75000000,
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 20,
      tanggal_jatuh_tempo: 28
    };

    const result = await createBank(testInput);

    // Query using proper drizzle syntax
    const banks = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, result.id))
      .execute();

    expect(banks).toHaveLength(1);
    const savedBank = banks[0];
    expect(savedBank.nama_bank).toEqual('Test Bank');
    expect(parseFloat(savedBank.limit_pinjaman)).toEqual(75000000);
    expect(savedBank.jenis_pinjaman).toEqual('KARTU_KREDIT');
    expect(savedBank.tanggal_cetak_billing).toEqual(20);
    expect(savedBank.tanggal_jatuh_tempo).toEqual(28);
    expect(savedBank.created_at).toBeInstanceOf(Date);
    expect(savedBank.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal limit amounts correctly', async () => {
    const testInput: CreateBankInput = {
      nama_bank: 'Decimal Bank',
      limit_pinjaman: 12345.67,
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 15
    };

    const result = await createBank(testInput);

    // Verify numeric conversion works correctly
    expect(result.limit_pinjaman).toEqual(12345.67);
    expect(typeof result.limit_pinjaman).toEqual('number');

    // Verify database storage
    const banks = await db.select()
      .from(banksTable)
      .where(eq(banksTable.id, result.id))
      .execute();

    expect(parseFloat(banks[0].limit_pinjaman)).toEqual(12345.67);
  });

  it('should handle minimum and maximum due dates', async () => {
    const testInputMin: CreateBankInput = {
      nama_bank: 'Min Date Bank',
      limit_pinjaman: 1000000,
      jenis_pinjaman: 'KTA',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 1
    };

    const testInputMax: CreateBankInput = {
      nama_bank: 'Max Date Bank',
      limit_pinjaman: 2000000,
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: 31,
      tanggal_jatuh_tempo: 31
    };

    const resultMin = await createBank(testInputMin);
    const resultMax = await createBank(testInputMax);

    expect(resultMin.tanggal_jatuh_tempo).toEqual(1);
    expect(resultMax.tanggal_jatuh_tempo).toEqual(31);
    expect(resultMax.tanggal_cetak_billing).toEqual(31);
  });
});