import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, CreditCard, AlertTriangle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { Bank, LoanTransaction, CreateLoanTransactionInput } from '../../../server/src/schema';

export function TransactionManagement() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<LoanTransaction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('all');

  const [formData, setFormData] = useState<CreateLoanTransactionInput>({
    bank_id: 0,
    tanggal_transaksi: new Date(),
    keterangan_transaksi: '',
    jumlah_transaksi: 0,
    is_cicilan: false
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
      if (selectedBankId && selectedBankId !== 'all') {
        const result = await trpc.getLoanTransactionsByBank.query({ bankId: parseInt(selectedBankId) });
        setTransactions(result);
      } else {
        const result = await trpc.getLoanTransactions.query();
        setTransactions(result);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, [selectedBankId]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for Kartu Kredit cicilan
    const selectedBank = banks.find((bank: Bank) => bank.id === formData.bank_id);
    if (selectedBank && selectedBank.jenis_pinjaman === 'KARTU_KREDIT' && formData.is_cicilan && selectedBank.tanggal_cetak_billing) {
      const transactionDate = new Date(formData.tanggal_transaksi);
      const currentMonth = transactionDate.getMonth();
      const currentYear = transactionDate.getFullYear();
      
      // Check if transaction date is after billing date
      const billingDate = new Date(currentYear, currentMonth, selectedBank.tanggal_cetak_billing);
      if (transactionDate < billingDate) {
        alert('Untuk cicilan Kartu Kredit, transaksi harus dilakukan setelah tanggal cetak billing!');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (editingTransaction) {
        await trpc.updateLoanTransaction.mutate({
          id: editingTransaction.id,
          ...formData
        });
      } else {
        await trpc.createLoanTransaction.mutate(formData);
      }
      
      await loadTransactions();
      resetForm();
    } catch (error) {
      console.error('Failed to save transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (transaction: LoanTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      bank_id: transaction.bank_id,
      tanggal_transaksi: transaction.tanggal_transaksi,
      keterangan_transaksi: transaction.keterangan_transaksi,
      jumlah_transaksi: transaction.jumlah_transaksi,
      is_cicilan: transaction.is_cicilan
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await trpc.deleteLoanTransaction.mutate({ id });
      await loadTransactions();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      bank_id: 0,
      tanggal_transaksi: new Date(),
      keterangan_transaksi: '',
      jumlah_transaksi: 0,
      is_cicilan: false
    });
    setEditingTransaction(null);
    setShowForm(false);
  };

  const getBankName = (bankId: number): string => {
    const bank = banks.find((b: Bank) => b.id === bankId);
    return bank ? bank.nama_bank : 'Unknown Bank';
  };

  const getBankType = (bankId: number): string => {
    const bank = banks.find((b: Bank) => b.id === bankId);
    return bank ? bank.jenis_pinjaman : '';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('id-ID');
  };

  const formatDateForInput = (date: Date): string => {
    return new Date(date).toISOString().split('T')[0];
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
              {editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_id">Bank</Label>
                  <Select 
                    value={formData.bank_id.toString()} 
                    onValueChange={(value: string) => 
                      setFormData((prev: CreateLoanTransactionInput) => ({ ...prev, bank_id: parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank: Bank) => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.nama_bank} ({bank.jenis_pinjaman})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tanggal_transaksi">Tanggal Transaksi</Label>
                  <Input
                    id="tanggal_transaksi"
                    type="date"
                    value={formatDateForInput(formData.tanggal_transaksi)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateLoanTransactionInput) => ({ 
                        ...prev, 
                        tanggal_transaksi: new Date(e.target.value) 
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumlah_transaksi">Jumlah Transaksi (Rp)</Label>
                  <Input
                    id="jumlah_transaksi"
                    type="number"
                    placeholder="0"
                    value={formData.jumlah_transaksi}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateLoanTransactionInput) => ({ 
                        ...prev, 
                        jumlah_transaksi: parseFloat(e.target.value) || 0 
                      }))
                    }
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_cicilan"
                      checked={formData.is_cicilan}
                      onCheckedChange={(checked: boolean) =>
                        setFormData((prev: CreateLoanTransactionInput) => ({ ...prev, is_cicilan: checked }))
                      }
                    />
                    <Label htmlFor="is_cicilan">Transaksi Cicilan</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keterangan_transaksi">Keterangan Transaksi</Label>
                <Textarea
                  id="keterangan_transaksi"
                  placeholder="Masukkan keterangan transaksi"
                  value={formData.keterangan_transaksi}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateLoanTransactionInput) => ({ 
                      ...prev, 
                      keterangan_transaksi: e.target.value 
                    }))
                  }
                  required
                />
              </div>

              {/* Warning for Kartu Kredit cicilan */}
              {formData.bank_id > 0 && formData.is_cicilan && getBankType(formData.bank_id) === 'KARTU_KREDIT' && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Untuk cicilan Kartu Kredit, pastikan tanggal transaksi setelah tanggal cetak billing.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : (editingTransaction ? 'Update' : 'Tambah')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add Transaction Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-4">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Transaksi
        </Button>
      )}

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            {selectedBankId && selectedBankId !== 'all' ? 'Belum ada transaksi untuk bank ini.' : 'Belum ada transaksi. Tambah transaksi pertama Anda!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {transactions.map((transaction: LoanTransaction) => (
            <Card key={transaction.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{getBankName(transaction.bank_id)}</h3>
                      {transaction.is_cicilan && (
                        <Badge variant="secondary">Cicilan</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{transaction.keterangan_transaksi}</p>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>Jumlah: <span className="font-medium text-red-600">Rp {transaction.jumlah_transaksi.toLocaleString('id-ID')}</span></p>
                      <p>Tanggal: {formatDate(transaction.tanggal_transaksi)}</p>
                      <p className="text-xs">Dibuat: {formatDate(transaction.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(transaction)}
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
                          <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus transaksi ini? 
                            Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(transaction.id)}>
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}