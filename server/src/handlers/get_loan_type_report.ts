import { db } from '../db';
import { banksTable, loanTransactionsTable, paymentsTable } from '../db/schema';
import { type LoanTypeReportInput, type LoanTypeReport, loanTypeEnum } from '../schema';
import { eq, sum, count, sql } from 'drizzle-orm';

export async function getLoanTypeReport(input: LoanTypeReportInput): Promise<LoanTypeReport> {
  try {
    // Get loan transactions summary for the specified loan type
    const loanSummary = await db
      .select({
        total_loans: sum(loanTransactionsTable.jumlah_transaksi),
        transaction_count: count(loanTransactionsTable.id)
      })
      .from(loanTransactionsTable)
      .innerJoin(banksTable, eq(loanTransactionsTable.bank_id, banksTable.id))
      .where(eq(banksTable.jenis_pinjaman, input.jenis_pinjaman))
      .execute();

    // Get payments summary for the specified loan type
    const paymentSummary = await db
      .select({
        total_payments: sum(paymentsTable.jumlah_pembayaran),
        payment_count: count(paymentsTable.id)
      })
      .from(paymentsTable)
      .innerJoin(banksTable, eq(paymentsTable.bank_id, banksTable.id))
      .where(eq(banksTable.jenis_pinjaman, input.jenis_pinjaman))
      .execute();

    // Extract values and handle null cases
    const totalLoans = loanSummary[0]?.total_loans ? parseFloat(loanSummary[0].total_loans) : 0;
    const transactionCount = loanSummary[0]?.transaction_count || 0;
    const totalPayments = paymentSummary[0]?.total_payments ? parseFloat(paymentSummary[0].total_payments) : 0;
    const paymentCount = paymentSummary[0]?.payment_count || 0;

    // Calculate outstanding amount
    const outstandingAmount = totalLoans - totalPayments;

    return {
      jenis_pinjaman: input.jenis_pinjaman,
      total_loans: totalLoans,
      total_payments: totalPayments,
      outstanding_amount: outstandingAmount,
      transaction_count: transactionCount,
      payment_count: paymentCount
    };
  } catch (error) {
    console.error('Loan type report generation failed:', error);
    throw error;
  }
}

export async function getAllLoanTypeReports(): Promise<LoanTypeReport[]> {
  try {
    // Get all loan types from the enum
    const loanTypes = loanTypeEnum.options;
    
    // Generate reports for all loan types
    const reports = await Promise.all(
      loanTypes.map(loanType => 
        getLoanTypeReport({ jenis_pinjaman: loanType })
      )
    );

    return reports;
  } catch (error) {
    console.error('All loan type reports generation failed:', error);
    throw error;
  }
}