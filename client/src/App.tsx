import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CreditCard, Receipt, BarChart3 } from 'lucide-react';
import { BankManagement } from '@/components/BankManagement';
import { TransactionManagement } from '@/components/TransactionManagement';
import { PaymentManagement } from '@/components/PaymentManagement';
import { ReportsManagement } from '@/components/ReportsManagement';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">💰 Manajemen Hutang</h1>
          <p className="text-lg text-gray-600">Kelola pinjaman dan pembayaran Anda dengan mudah</p>
        </div>

        <Tabs defaultValue="banks" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="banks" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Data Bank
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Transaksi
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Pembayaran
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Laporan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="banks">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Manajemen Data Bank
                </CardTitle>
                <CardDescription>
                  Kelola informasi bank dan limit pinjaman Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BankManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Daftar Transaksi Pinjaman
                </CardTitle>
                <CardDescription>
                  Catat dan kelola semua transaksi pinjaman Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Manajemen Pembayaran
                </CardTitle>
                <CardDescription>
                  Lacak semua pembayaran yang telah dilakukan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Laporan dan Analisis
                </CardTitle>
                <CardDescription>
                  Analisis keuangan dan laporan jatuh tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReportsManagement />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;