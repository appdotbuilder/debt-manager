import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Building2 } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { Bank, CreateBankInput, LoanType } from '../../../server/src/schema';

const loanTypeLabels: Record<LoanType, string> = {
  KARTU_KREDIT: 'Kartu Kredit',
  PAYLATER: 'Paylater',
  KTA: 'KTA',
  KUR: 'KUR'
};

export function BankManagement() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<CreateBankInput>({
    nama_bank: '',
    limit_pinjaman: 0,
    jenis_pinjaman: 'KARTU_KREDIT',
    tanggal_cetak_billing: null,
    tanggal_jatuh_tempo: 1
  });

  const loadBanks = useCallback(async () => {
    try {
      const result = await trpc.getBanks.query();
      setBanks(result);
    } catch (error) {
      console.error('Failed to load banks:', error);
    }
  }, []);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingBank) {
        await trpc.updateBank.mutate({
          id: editingBank.id,
          ...formData
        });
      } else {
        await trpc.createBank.mutate(formData);
      }
      
      await loadBanks();
      resetForm();
    } catch (error) {
      console.error('Failed to save bank:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      nama_bank: bank.nama_bank,
      limit_pinjaman: bank.limit_pinjaman,
      jenis_pinjaman: bank.jenis_pinjaman,
      tanggal_cetak_billing: bank.tanggal_cetak_billing,
      tanggal_jatuh_tempo: bank.tanggal_jatuh_tempo
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await trpc.deleteBank.mutate({ id });
      await loadBanks();
    } catch (error) {
      console.error('Failed to delete bank:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      nama_bank: '',
      limit_pinjaman: 0,
      jenis_pinjaman: 'KARTU_KREDIT',
      tanggal_cetak_billing: null,
      tanggal_jatuh_tempo: 1
    });
    setEditingBank(null);
    setShowForm(false);
  };

  const handleLoanTypeChange = (value: LoanType) => {
    setFormData((prev: CreateBankInput) => ({
      ...prev,
      jenis_pinjaman: value,
      tanggal_cetak_billing: value === 'KARTU_KREDIT' ? 1 : null
    }));
  };

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {editingBank ? 'Edit Bank' : 'Tambah Bank Baru'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nama_bank">Nama Bank</Label>
                  <Input
                    id="nama_bank"
                    placeholder="Masukkan nama bank"
                    value={formData.nama_bank}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateBankInput) => ({ ...prev, nama_bank: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit_pinjaman">Limit Pinjaman (Rp)</Label>
                  <Input
                    id="limit_pinjaman"
                    type="number"
                    placeholder="0"
                    value={formData.limit_pinjaman}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateBankInput) => ({ ...prev, limit_pinjaman: parseFloat(e.target.value) || 0 }))
                    }
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jenis_pinjaman">Jenis Pinjaman</Label>
                  <Select value={formData.jenis_pinjaman || 'KARTU_KREDIT'} onValueChange={handleLoanTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis pinjaman" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KARTU_KREDIT">Kartu Kredit</SelectItem>
                      <SelectItem value="PAYLATER">Paylater</SelectItem>
                      <SelectItem value="KTA">KTA</SelectItem>
                      <SelectItem value="KUR">KUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.jenis_pinjaman === 'KARTU_KREDIT' && (
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_cetak_billing">Tanggal Cetak Billing</Label>
                    <Input
                      id="tanggal_cetak_billing"
                      type="number"
                      placeholder="1-31"
                      value={formData.tanggal_cetak_billing || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateBankInput) => ({ 
                          ...prev, 
                          tanggal_cetak_billing: parseInt(e.target.value) || null 
                        }))
                      }
                      min="1"
                      max="31"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tanggal_jatuh_tempo">Tanggal Jatuh Tempo</Label>
                  <Input
                    id="tanggal_jatuh_tempo"
                    type="number"
                    placeholder="1-31"
                    value={formData.tanggal_jatuh_tempo}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateBankInput) => ({ ...prev, tanggal_jatuh_tempo: parseInt(e.target.value) || 1 }))
                    }
                    min="1"
                    max="31"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : (editingBank ? 'Update' : 'Tambah')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add Bank Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="mb-4">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Bank
        </Button>
      )}

      {/* Banks List */}
      {banks.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Belum ada data bank. Tambah bank pertama Anda!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {banks.map((bank: Bank) => (
            <Card key={bank.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{bank.nama_bank}</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Limit: <span className="font-medium">Rp {bank.limit_pinjaman.toLocaleString('id-ID')}</span></p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {loanTypeLabels[bank.jenis_pinjaman]}
                        </Badge>
                      </div>
                      {bank.tanggal_cetak_billing && (
                        <p>Cetak Billing: Tanggal {bank.tanggal_cetak_billing}</p>
                      )}
                      <p>Jatuh Tempo: Tanggal {bank.tanggal_jatuh_tempo}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(bank)}
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
                          <AlertDialogTitle>Hapus Bank</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus bank "{bank.nama_bank}"? 
                            Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(bank.id)}>
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