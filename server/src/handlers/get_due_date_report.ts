import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { type DueDateReport } from '../schema';
import { eq, sum, isNull, and, lte, gte, SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Helper function to calculate days until due date
function calculateDaysUntilDue(targetDay: number): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  
  // Create due date for current month
  let dueDate = new Date(currentYear, currentMonth, targetDay);
  
  // If due date has passed this month, it's overdue
  if (targetDay < currentDay) {
    // Calculate how many days overdue (negative number)
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays; // This will be negative
  }
  
  // Due date is today or in the future this month
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export async function getDueDateReport(): Promise<DueDateReport[]> {
  try {
    // Get all banks with their outstanding amounts
    const results = await db
      .select({
        bank_id: banksTable.id,
        bank_name: banksTable.nama_bank,
        jenis_pinjaman: banksTable.jenis_pinjaman,
        tanggal_jatuh_tempo: banksTable.tanggal_jatuh_tempo,
        total_loans: sum(loanTransactionsTable.jumlah_transaksi),
        total_payments: sum(paymentsTable.jumlah_pembayaran)
      })
      .from(banksTable)
      .leftJoin(loanTransactionsTable, eq(banksTable.id, loanTransactionsTable.bank_id))
      .leftJoin(paymentsTable, eq(banksTable.id, paymentsTable.bank_id))
      .groupBy(
        banksTable.id,
        banksTable.nama_bank,
        banksTable.jenis_pinjaman,
        banksTable.tanggal_jatuh_tempo
      )
      .execute();

    return results.map(result => {
      const totalLoans = result.total_loans ? parseFloat(result.total_loans) : 0;
      const totalPayments = result.total_payments ? parseFloat(result.total_payments) : 0;
      const outstanding = totalLoans - totalPayments;
      const daysUntilDue = calculateDaysUntilDue(result.tanggal_jatuh_tempo);

      return {
        bank_id: result.bank_id,
        bank_name: result.bank_name,
        jenis_pinjaman: result.jenis_pinjaman,
        tanggal_jatuh_tempo: result.tanggal_jatuh_tempo,
        days_until_due: daysUntilDue,
        outstanding_amount: outstanding
      };
    });
  } catch (error) {
    console.error('Due date report generation failed:', error);
    throw error;
  }
}

export async function getUpcomingDueDates(days: number = 7): Promise<DueDateReport[]> {
  try {
    const allReports = await getDueDateReport();
    
    // Filter for banks with due dates within the specified days and have outstanding amounts
    return allReports.filter(report => 
      report.days_until_due >= 0 && 
      report.days_until_due <= days &&
      report.outstanding_amount > 0
    );
  } catch (error) {
    console.error('Upcoming due dates retrieval failed:', error);
    throw error;
  }
}

export async function getOverdueDates(): Promise<DueDateReport[]> {
  try {
    const allReports = await getDueDateReport();
    
    // Filter for banks with overdue payments (negative days_until_due) and outstanding amounts
    return allReports.filter(report => 
      report.days_until_due < 0 &&
      report.outstanding_amount > 0
    );
  } catch (error) {
    console.error('Overdue dates retrieval failed:', error);
    throw error;
  }
}