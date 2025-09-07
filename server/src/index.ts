import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createBankInputSchema,
  updateBankInputSchema,
  createLoanTransactionInputSchema,
  updateLoanTransactionInputSchema,
  createPaymentInputSchema,
  updatePaymentInputSchema,
  monthlyReportInputSchema,
  loanTypeReportInputSchema
} from './schema';

// Import handlers
import { createBank } from './handlers/create_bank';
import { getBanks } from './handlers/get_banks';
import { updateBank } from './handlers/update_bank';
import { deleteBank } from './handlers/delete_bank';
import { createLoanTransaction } from './handlers/create_loan_transaction';
import { getLoanTransactions, getLoanTransactionsByBank } from './handlers/get_loan_transactions';
import { updateLoanTransaction } from './handlers/update_loan_transaction';
import { deleteLoanTransaction } from './handlers/delete_loan_transaction';
import { createPayment } from './handlers/create_payment';
import { getPayments, getPaymentsByBank, getPaymentsByTransaction } from './handlers/get_payments';
import { updatePayment } from './handlers/update_payment';
import { deletePayment } from './handlers/delete_payment';
import { getMonthlyReport } from './handlers/get_monthly_report';
import { getLoanTypeReport, getAllLoanTypeReports } from './handlers/get_loan_type_report';
import { getDueDateReport, getUpcomingDueDates, getOverdueDates } from './handlers/get_due_date_report';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Bank management routes
  createBank: publicProcedure
    .input(createBankInputSchema)
    .mutation(({ input }) => createBank(input)),

  getBanks: publicProcedure
    .query(() => getBanks()),

  updateBank: publicProcedure
    .input(updateBankInputSchema)
    .mutation(({ input }) => updateBank(input)),

  deleteBank: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteBank(input.id)),

  // Loan transaction management routes
  createLoanTransaction: publicProcedure
    .input(createLoanTransactionInputSchema)
    .mutation(({ input }) => createLoanTransaction(input)),

  getLoanTransactions: publicProcedure
    .query(() => getLoanTransactions()),

  getLoanTransactionsByBank: publicProcedure
    .input(z.object({ bankId: z.number() }))
    .query(({ input }) => getLoanTransactionsByBank(input.bankId)),

  updateLoanTransaction: publicProcedure
    .input(updateLoanTransactionInputSchema)
    .mutation(({ input }) => updateLoanTransaction(input)),

  deleteLoanTransaction: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteLoanTransaction(input.id)),

  // Payment management routes
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input)),

  getPayments: publicProcedure
    .query(() => getPayments()),

  getPaymentsByBank: publicProcedure
    .input(z.object({ bankId: z.number() }))
    .query(({ input }) => getPaymentsByBank(input.bankId)),

  getPaymentsByTransaction: publicProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(({ input }) => getPaymentsByTransaction(input.transactionId)),

  updatePayment: publicProcedure
    .input(updatePaymentInputSchema)
    .mutation(({ input }) => updatePayment(input)),

  deletePayment: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePayment(input.id)),

  // Report routes
  getMonthlyReport: publicProcedure
    .input(monthlyReportInputSchema)
    .query(({ input }) => getMonthlyReport(input)),

  getLoanTypeReport: publicProcedure
    .input(loanTypeReportInputSchema)
    .query(({ input }) => getLoanTypeReport(input)),

  getAllLoanTypeReports: publicProcedure
    .query(() => getAllLoanTypeReports()),

  getDueDateReport: publicProcedure
    .query(() => getDueDateReport()),

  getUpcomingDueDates: publicProcedure
    .input(z.object({ days: z.number().int().positive().optional().default(7) }))
    .query(({ input }) => getUpcomingDueDates(input.days)),

  getOverdueDates: publicProcedure
    .query(() => getOverdueDates()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();