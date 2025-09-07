import { db } from '../db';
import { loanTransactionsTable, paymentsTable } from '../db/schema';
import { type MonthlyReportInput, type MonthlyReport } from '../schema';
import { and, gte, lte, sql } from 'drizzle-orm';

export async function getMonthlyReport(input: MonthlyReportInput): Promise<MonthlyReport> {
  try {
    const { year, month } = input;
    
    // Calculate date range for the specified month
    const startDate = new Date(year, month - 1, 1); // month - 1 because Date months are 0-indexed
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

    // Query loan transactions for the month
    const loanResults = await db
      .select({
        total_amount: sql<string>`COALESCE(SUM(${loanTransactionsTable.jumlah_transaksi}), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(loanTransactionsTable)
      .where(
        and(
          gte(loanTransactionsTable.tanggal_transaksi, startDate),
          lte(loanTransactionsTable.tanggal_transaksi, endDate)
        )
      )
      .execute();

    // Query payments for the month
    const paymentResults = await db
      .select({
        total_amount: sql<string>`COALESCE(SUM(${paymentsTable.jumlah_pembayaran}), 0)`,
        count: sql<string>`COUNT(*)`,
      })
      .from(paymentsTable)
      .where(
        and(
          gte(paymentsTable.tanggal_pembayaran, startDate),
          lte(paymentsTable.tanggal_pembayaran, endDate)
        )
      )
      .execute();

    // Extract results with proper numeric conversion
    const totalLoans = parseFloat(loanResults[0].total_amount);
    const transactionCount = parseInt(loanResults[0].count);
    const totalPayments = parseFloat(paymentResults[0].total_amount);
    const paymentCount = parseInt(paymentResults[0].count);

    // Calculate net debt (loans - payments)
    const netDebt = totalLoans - totalPayments;

    return {
      year,
      month,
      total_loans: totalLoans,
      total_payments: totalPayments,
      net_debt: netDebt,
      transaction_count: transactionCount,
      payment_count: paymentCount,
    };
  } catch (error) {
    console.error('Monthly report generation failed:', error);
    throw error;
  }
}