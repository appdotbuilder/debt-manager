import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Receipt } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { Bank, LoanTransaction, Payment, CreatePaymentInput } from '../../../server/src/schema';

export function PaymentManagement() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('all');

  const [formData, setFormData] = useState<CreatePaymentInput>({
    bank_id: 0,
    loan_transaction_id: 0,
    tanggal_pembayaran: new Date(),
    jumlah_pembayaran: 0
  });

  const loadBanks = useCallback(async () => {
    try {
      const result = await trpc.getBanks.query();
      setBanks(result);
    } catch (error) {
      console.error('Failed to load banks:', error);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const result = await trpc.getLoanTransactions.query();
      setTransactions(result);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      if (selectedBankId && selectedBankId !== 'all') {
        const result = await trpc.getPaymentsByBank.query({ bankId: parseInt(selectedBankId) });
        setPayments(result);
      } else {
        const result = await trpc.getPayments.query();
        setPayments(result);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  }, [selectedBankId]);

  useEffect(() => {
    loadBanks();
    loadTransactions();
  }, [loadBanks, loadTransactions]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingPayment) {
        await trpc.updatePayment.mutate({
          id: editingPayment.id,
          ...formData
        });
      } else {
        await trpc.createPayment.mutate(formData);
      }
      
      await loadPayments();
      resetForm();
    } catch (error) {
      console.error('Failed to save payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      bank_id: payment.bank_id,
      loan_transaction_id: payment.loan_transaction_id,
      tanggal_pembayaran: payment.tanggal_pembayaran,
      jumlah_pembayaran: payment.jumlah_pembayaran
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await trpc.deletePayment.mutate({ id });
      await loadPayments();
    } catch (error) {
      console.error('Failed to delete payment:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      bank_id: 0,
      loan_transaction_id: 0,
      tanggal_pembayaran: new Date(),
      jumlah_pembayaran: 0
    });
    setEditingPayment(null);
    setShowForm(false);
  };

  const getBankName = (bankId: number): string => {
    const bank = banks.find((b: Bank) => b.id === bankId);
    return bank ? bank.nama_bank : 'Unknown Bank';
  };

  const getTransactionDescription = (transactionId: number): string => {
    const transaction = transactions.find((t: LoanTransaction) => t.id === transactionId);
    return transaction ? transaction.keterangan_transaksi : 'Unknown Transaction';
  };

  const getTransactionAmount = (transactionId: number): number => {
    const transaction = transactions.find((t: LoanTransaction) => t.id === transactionId);
    return transaction ? transaction.jumlah_transaksi : 0;
  };

  const getAvailableTransactions = (bankId: number): LoanTransaction[] => {
    return transactions.filter((t: LoanTransaction) => t.bank_id === bankId);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('id-ID');
  };

  const formatDateForInput = (date: Date): string => {
    return new Date(date).toISOString().split('T')[0];
  };

  const getTotalPayments = (transactionId: number): number => {
    return payments
      .filter((p: Payment) => p.loan_transaction_id === transactionId)
      .reduce((sum: number, p: Payment) => sum + p.jumlah_pembayaran, 0);
  };

  const getRemainingAmount = (transactionId: number): number => {
    const transactionAmount = getTransactionAmount(transactionId);
    const totalPayments = getTotalPayments(transactionId);
    return transactionAmount - totalPayments;
  };

  return (
    <div className="space-y-6">
      {/* Filter by Bank */}
      <div className="flex gap-4 items-center">
        <Label htmlFor="bank-filter">Filter Bank:</Label>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Semua Bank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bank</SelectItem>
            {banks.map((bank: Bank) => (
              <SelectItem key={bank.id} value={bank.id.toString()}>
                {bank.nama_bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {editingPayment ? 'Edit Pembayaran' : 'Tambah Pembayaran Baru'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_id">Bank</Label>
                  <Select 
                    value={formData.bank_id.toString()} 
                    onValueChange={(value: string) => {
                      const bankId = parseInt(value);
                      setFormData((prev: CreatePaymentInput) => ({ 
                        ...prev, 
                        bank_id: bankId,
                        loan_transaction_id: 0 // Reset transaction selection
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank: Bank) => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.nama_bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loan_transaction_id">Transaksi Pinjaman</Label>
                  <Select 
                    value={formData.loan_transaction_id.toString()} 
                    onValueChange={(value: string) => 
                      setFormData((prev: CreatePaymentInput) => ({ 
                        ...prev, 
                        loan_transaction_id: parseInt(value) 
                      }))
                    }
                    disabled={formData.bank_id === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih transaksi" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTransactions(formData.bank_id).map((transaction: LoanTransaction) => {
                        const remaining = getRemainingAmount(transaction.id);
                        return (
                          <SelectItem key={transaction.id} value={transaction.id.toString()}>
                            {transaction.keterangan_transaksi} 
                            (Sisa: Rp {remaining.toLocaleString('id-ID')})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tanggal_pembayaran">Tanggal Pembayaran</Label>
                  <Input
                    id="tanggal_pembayaran"
                    type="date"
                    value={formatDateForInput(formData.tanggal_pembayaran)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePaymentInput) => ({ 
                        ...prev, 
                        tanggal_pembayaran: new Date(e.target.value) 
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumlah_pembayaran">Jumlah Pembayaran (Rp)</Label>
                  <Input
                    id="jumlah_pembayaran"
                    type="number"
                    placeholder="0"
                    value={formData.jumlah_pembayaran}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePaymentInput) => ({ 
                        ...prev, 
                        jumlah_pembayaran: parseFloat(e.target.value) || 0 
                      }))
                    }
                    min="0"
                    step="1000"
                    required
                  />
                </div>
              </div>

              {/* Show remaining amount */}
              {formData.loan_transaction_id > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    Sisa hutang: <span className="font-medium">
                      Rp {getRemainingAmount(formData.loan_transaction_id).toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : (editingPayment ? 'Update' : 'Tambah')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add Payment Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-4">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Pembayaran
        </Button>
      )}

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            {selectedBankId && selectedBankId !== 'all' ? 'Belum ada pembayaran untuk bank ini.' : 'Belum ada pembayaran. Tambah pembayaran pertama Anda!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment: Payment) => {
            const remainingAfterPayment = getRemainingAmount(payment.loan_transaction_id);
            const transactionAmount = getTransactionAmount(payment.loan_transaction_id);
            const isFullyPaid = remainingAfterPayment <= 0;
            
            return (
              <Card key={payment.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{getBankName(payment.bank_id)}</h3>
                        {isFullyPaid && (
                          <Badge className="bg-green-100 text-green-800">Lunas</Badge>
                        )}
                      </div>
                      <p className="text-gray-600 mb-2">{getTransactionDescription(payment.loan_transaction_id)}</p>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Jumlah Pembayaran: <span className="font-medium text-green-600">Rp {payment.jumlah_pembayaran.toLocaleString('id-ID')}</span></p>
                        <p>Tanggal: {formatDate(payment.tanggal_pembayaran)}</p>
                        <p>Total Hutang: <span className="font-medium">Rp {transactionAmount.toLocaleString('id-ID')}</span></p>
                        <p>Sisa Hutang: <span className={`font-medium ${remainingAfterPayment <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rp {Math.max(0, remainingAfterPayment).toLocaleString('id-ID')}
                        </span></p>
                        <p className="text-xs">Dibuat: {formatDate(payment.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(payment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Pembayaran</AlertDialogTitle>
                            <AlertDialogDescription>
                              Apakah Anda yakin ingin menghapus pembayaran ini? 
                              Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(payment.id)}>
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}