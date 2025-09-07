import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Clock, AlertCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { MonthlyReport, LoanTypeReport, DueDateReport, LoanType } from '../../../server/src/schema';

const loanTypeLabels: Record<LoanType, string> = {
  KARTU_KREDIT: 'Kartu Kredit',
  PAYLATER: 'Paylater',
  KTA: 'KTA',
  KUR: 'KUR'
};

export function ReportsManagement() {
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loanTypeReports, setLoanTypeReports] = useState<LoanTypeReport[]>([]);
  const [dueDateReports, setDueDateReports] = useState<DueDateReport[]>([]);
  const [upcomingDueDates, setUpcomingDueDates] = useState<DueDateReport[]>([]);
  const [overdueDates, setOverdueDates] = useState<DueDateReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states for monthly report
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [upcomingDays, setUpcomingDays] = useState<number>(7);

  const loadMonthlyReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getMonthlyReport.query({
        year: selectedYear,
        month: selectedMonth
      });
      setMonthlyReport(result);
    } catch (error) {
      console.error('Failed to load monthly report:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const loadLoanTypeReports = useCallback(async () => {
    try {
      const result = await trpc.getAllLoanTypeReports.query();
      setLoanTypeReports(result);
    } catch (error) {
      console.error('Failed to load loan type reports:', error);
    }
  }, []);

  const loadDueDateReports = useCallback(async () => {
    try {
      const [allDueDates, upcoming, overdue] = await Promise.all([
        trpc.getDueDateReport.query(),
        trpc.getUpcomingDueDates.query({ days: upcomingDays }),
        trpc.getOverdueDates.query()
      ]);
      setDueDateReports(allDueDates);
      setUpcomingDueDates(upcoming);
      setOverdueDates(overdue);
    } catch (error) {
      console.error('Failed to load due date reports:', error);
    }
  }, [upcomingDays]);

  useEffect(() => {
    loadLoanTypeReports();
    loadDueDateReports();
  }, [loadLoanTypeReports, loadDueDateReports]);

  const formatCurrency = (amount: number): string => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const getMonthName = (month: number): string => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
  };

  const getDueDateStatus = (daysUntilDue: number) => {
    if (daysUntilDue < 0) {
      return { label: 'Terlambat', variant: 'destructive' as const, icon: AlertCircle };
    } else if (daysUntilDue <= 3) {
      return { label: 'Urgent', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (daysUntilDue <= 7) {
      return { label: 'Segera', variant: 'secondary' as const, icon: Clock };
    } else {
      return { label: 'Normal', variant: 'outline' as const, icon: CheckCircle };
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Laporan Bulanan
          </TabsTrigger>
          <TabsTrigger value="loan-type" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Per Jenis Pinjaman
          </TabsTrigger>
          <TabsTrigger value="due-dates" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Jatuh Tempo
          </TabsTrigger>
        </TabsList>

        {/* Monthly Report Tab */}
        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Laporan Bulanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end mb-6">
                <div className="space-y-2">
                  <Label htmlFor="year">Tahun</Label>
                  <Input
                    id="year"
                    type="number"
                    value={selectedYear}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())
                    }
                    min="2000"
                    max="2050"
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="month">Bulan</Label>
                  <Select 
                    value={selectedMonth.toString()} 
                    onValueChange={(value: string) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month: number) => (
                        <SelectItem key={month} value={month.toString()}>
                          {getMonthName(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadMonthlyReport} disabled={isLoading}>
                  {isLoading ? 'Memuat...' : 'Lihat Laporan'}
                </Button>
              </div>

              {monthlyReport && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Pinjaman</p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(monthlyReport.total_loans)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {monthlyReport.transaction_count} transaksi
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Pembayaran</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(monthlyReport.total_payments)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {monthlyReport.payment_count} pembayaran
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <BarChart3 className={`h-4 w-4 ${monthlyReport.net_debt >= 0 ? 'text-red-600' : 'text-green-600'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Perubahan Hutang</p>
                          <p className={`text-2xl font-bold ${monthlyReport.net_debt >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {monthlyReport.net_debt >= 0 ? '+' : ''}{formatCurrency(monthlyReport.net_debt)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getMonthName(monthlyReport.month)} {monthlyReport.year}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan Type Report Tab */}
        <TabsContent value="loan-type" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Laporan per Jenis Pinjaman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={loadLoanTypeReports} className="mb-6">
                Refresh Laporan
              </Button>

              {loanTypeReports.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Belum ada data laporan jenis pinjaman.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {loanTypeReports.map((report: LoanTypeReport) => (
                    <Card key={report.jenis_pinjaman}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Badge variant="outline">
                              {loanTypeLabels[report.jenis_pinjaman]}
                            </Badge>
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Pinjaman</p>
                            <p className="text-lg font-semibold text-red-600">
                              {formatCurrency(report.total_loans)}
                            </p>
                            <p className="text-xs text-gray-500">{report.transaction_count} transaksi</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-600">Total Pembayaran</p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatCurrency(report.total_payments)}
                            </p>
                            <p className="text-xs text-gray-500">{report.payment_count} pembayaran</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-600">Sisa Hutang</p>
                            <p className="text-lg font-semibold text-orange-600">
                              {formatCurrency(report.outstanding_amount)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-600">Status</p>
                            <Badge 
                              variant={report.outstanding_amount <= 0 ? "default" : "secondary"}
                              className={report.outstanding_amount <= 0 ? "bg-green-100 text-green-800" : ""}
                            >
                              {report.outstanding_amount <= 0 ? 'Lunas' : 'Belum Lunas'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Due Dates Tab */}
        <TabsContent value="due-dates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Laporan Jatuh Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end mb-6">
                <div className="space-y-2">
                  <Label htmlFor="upcoming-days">Upcoming Days</Label>
                  <Input
                    id="upcoming-days"
                    type="number"
                    value={upcomingDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setUpcomingDays(parseInt(e.target.value) || 7)
                    }
                    min="1"
                    max="30"
                    className="w-32"
                  />
                </div>
                <Button onClick={loadDueDateReports}>
                  Refresh Laporan
                </Button>
              </div>

              {/* Overdue Section */}
              {overdueDates.length > 0 && (
                <Card className="border-red-200 mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Terlambat ({overdueDates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overdueDates.map((report: DueDateReport) => {
                        const status = getDueDateStatus(report.days_until_due);
                        const StatusIcon = status.icon;
                        
                        return (
                          <div key={report.bank_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <StatusIcon className="h-4 w-4 text-red-600" />
                              <div>
                                <p className="font-medium">{report.bank_name}</p>
                                <p className="text-sm text-gray-600">
                                  {loanTypeLabels[report.jenis_pinjaman]} • 
                                  Jatuh tempo tanggal {report.tanggal_jatuh_tempo} • 
                                  {Math.abs(report.days_until_due)} hari lalu
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">
                                {formatCurrency(report.outstanding_amount)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Upcoming Section */}
              {upcomingDueDates.length > 0 && (
                <Card className="border-yellow-200 mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-yellow-600 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Akan Jatuh Tempo ({upcomingDays} hari) - {upcomingDueDates.length} item
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {upcomingDueDates.map((report: DueDateReport) => {
                        const status = getDueDateStatus(report.days_until_due);
                        const StatusIcon = status.icon;
                        
                        return (
                          <div key={report.bank_id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <StatusIcon className={`h-4 w-4 ${report.days_until_due <= 3 ? 'text-red-600' : 'text-yellow-600'}`} />
                              <div>
                                <p className="font-medium">{report.bank_name}</p>
                                <p className="text-sm text-gray-600">
                                  {loanTypeLabels[report.jenis_pinjaman]} • 
                                  Jatuh tempo tanggal {report.tanggal_jatuh_tempo} • 
                                  {report.days_until_due} hari lagi
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={status.variant}>
                                {status.label}
                              </Badge>
                              <p className="font-semibold text-orange-600 mt-1">
                                {formatCurrency(report.outstanding_amount)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All Due Dates Section */}
              {dueDateReports.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Semua Jatuh Tempo ({dueDateReports.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dueDateReports.map((report: DueDateReport) => {
                        const status = getDueDateStatus(report.days_until_due);
                        const StatusIcon = status.icon;
                        
                        return (
                          <div key={report.bank_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <StatusIcon className="h-4 w-4 text-gray-600" />
                              <div>
                                <p className="font-medium">{report.bank_name}</p>
                                <p className="text-sm text-gray-600">
                                  {loanTypeLabels[report.jenis_pinjaman]} • 
                                  Jatuh tempo tanggal {report.tanggal_jatuh_tempo}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={status.variant}>
                                {report.days_until_due < 0 
                                  ? `${Math.abs(report.days_until_due)} hari lalu`
                                  : report.days_until_due === 0
                                  ? 'Hari ini'
                                  : `${report.days_until_due} hari lagi`
                                }
                              </Badge>
                              <p className="font-semibold mt-1">
                                {formatCurrency(report.outstanding_amount)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dueDateReports.length === 0 && upcomingDueDates.length === 0 && overdueDates.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Tidak ada data jatuh tempo.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}