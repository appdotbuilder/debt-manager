import { type CreatePaymentInput, type Payment } from '../schema';

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a new payment record linked to
    // a specific loan transaction and bank. Should validate that the loan transaction
    // exists and belongs to the specified bank.
    return Promise.resolve({
        id: 0, // Placeholder ID
        bank_id: input.bank_id,
        loan_transaction_id: input.loan_transaction_id,
        tanggal_pembayaran: input.tanggal_pembayaran,
        jumlah_pembayaran: input.jumlah_pembayaran,
        created_at: new Date(),
        updated_at: new Date()
    } as Payment);
}