import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatRupiahDisplay } from '../../utils/formatRupiah';
import { withSqliteRetry } from '../../services/database';
import { getBusinessDate } from '../../utils/sessionHelper';
import { ReceiptPreviewModal } from '../../components/receipt-preview-modal';
import { PrintReceiptData } from '../../services/print';
import { exportTableToPdf } from '../../services/export';
import { exportTransactionsCsv, exportCashLedgerCsv } from '../../services/backup';
import {
  buildPeriodSqlCondition,
  getPreviousMonth,
  getNextMonth,
  getPreviousDay,
  getNextDay,
  PeriodFilterMode,
} from '../../stores/financialStore';

type HistoryTab = 'sales' | 'cash_in' | 'cash_out';
type PeriodFilterType = 'today' | '7days' | 'month' | 'custom';
type CustomSelectorMode = 'month' | 'date';
type StatusFilterType = 'all' | 'completed' | 'pending' | 'merged' | 'cancelled';

interface TransactionRow {
  id: number;
  invoice_number: string;
  business_date: string;
  table_number: string;
  customer_id: number | null;
  customer_name: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_amount: number;
  change_amount: number;
  status: string;
  created_at: string;
  cashier_name: string;
  items_json: string;
}

interface CashRow {
  id: number;
  business_date: string;
  type: string;
  affects_pnl: number;
  category: string;
  amount: number;
  notes: string;
  created_at: string;
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const todayBizDate = getBusinessDate();

  const [activeTab, setActiveTab] = useState<HistoryTab>('sales');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('today');
  const [customMode, setCustomMode] = useState<CustomSelectorMode>('month');
  const [customMonth, setCustomMonth] = useState<string>(todayBizDate.substring(0, 7));
  const [customDate, setCustomDate] = useState<string>(todayBizDate);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');

  const [search, setSearch] = useState('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [cashEntries, setCashEntries] = useState<CashRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);
  const [selectedReceiptData, setSelectedReceiptData] = useState<PrintReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, periodFilter, customMode, customMonth, customDate, statusFilter]);

  const getActivePeriodMode = (): { mode: PeriodFilterMode; customVal?: string } => {
    if (periodFilter === 'today') return { mode: 'today' };
    if (periodFilter === '7days') return { mode: '7days' };
    if (periodFilter === 'month') return { mode: 'month' };
    if (customMode === 'month') return { mode: 'custom_month', customVal: customMonth };
    return { mode: 'custom_date', customVal: customDate };
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { mode, customVal } = getActivePeriodMode();

      if (activeTab === 'sales') {
        const { whereSql, params, label } = buildPeriodSqlCondition(
          mode,
          todayBizDate,
          customVal,
          't.business_date'
        );
        setPeriodLabel(label);

        let statusClause = '';
        const queryParams = [...params];
        if (statusFilter !== 'all') {
          statusClause = ' AND t.status = ?';
          queryParams.push(statusFilter);
        }

        const query = `
          SELECT t.*, (
            SELECT json_group_array(json_object(
              'name', ti.menu_name,
              'price', ti.price,
              'qty', ti.qty,
              'subtotal', ti.subtotal,
              'is_additional', ti.is_additional
            ))
            FROM transaction_items ti WHERE ti.transaction_id = t.id
          ) as items_json
          FROM transactions t
          WHERE ${whereSql}${statusClause}
          ORDER BY t.id DESC
        `;

        const rows = await withSqliteRetry(() =>
          db.getAllAsync<TransactionRow>(query, queryParams)
        );
        setTransactions(rows || []);
      } else {
        const typeCondition =
          activeTab === 'cash_in'
            ? "type IN ('income', 'in')"
            : "type IN ('expense', 'out')";

        const { whereSql, params, label } = buildPeriodSqlCondition(
          mode,
          todayBizDate,
          customVal,
          'business_date'
        );
        setPeriodLabel(label);

        const query = `
          SELECT * FROM cash_ledger
          WHERE ${typeCondition} AND ${whereSql}
          ORDER BY id DESC
        `;

        const rows = await withSqliteRetry(() =>
          db.getAllAsync<CashRow>(query, params)
        );
        setCashEntries(rows || []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReceipt = async (tx: TransactionRow) => {
    try {
      const items = tx.items_json ? JSON.parse(tx.items_json) : [];
      const receiptData: PrintReceiptData = {
        storeName: 'Angkringan Jogja',
        invoiceNumber: tx.invoice_number,
        businessDate: tx.business_date,
        dateTimeString: tx.created_at,
        tableNumber: tx.table_number,
        customerName: tx.customer_name,
        cashierName: tx.cashier_name || 'Kasir',
        items,
        subtotal: tx.subtotal,
        taxAmount: tx.tax_amount,
        discountAmount: tx.discount_amount,
        total: tx.total,
        paymentMethod: tx.payment_method,
        paymentAmount: tx.payment_amount,
        changeAmount: tx.change_amount,
      };

      setSelectedReceiptData(receiptData);
      setReceiptModalVisible(true);
    } catch (err) {
      Alert.alert('Gagal Membuka Struk', 'Data item transaksi tidak valid.');
    }
  };

  // Omset & Payment method calculations
  const completedTransactions = transactions.filter((t) => t.status === 'completed');
  const totalOmset = completedTransactions.reduce((sum, t) => sum + t.total, 0);
  const salesTunai = completedTransactions
    .filter((t) => (t.payment_method || '').toLowerCase() === 'tunai')
    .reduce((sum, t) => sum + t.total, 0);
  const salesQris = completedTransactions
    .filter((t) => (t.payment_method || '').toLowerCase() === 'qris')
    .reduce((sum, t) => sum + t.total, 0);
  const salesTransfer = completedTransactions
    .filter((t) => (t.payment_method || '').toLowerCase() === 'transfer')
    .reduce((sum, t) => sum + t.total, 0);

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const mergedCount = transactions.filter((t) => t.status === 'merged').length;
  const completedCount = completedTransactions.length;
  const cancelledCount = transactions.filter((t) => t.status === 'cancelled').length;

  const totalCashAmount = cashEntries.reduce((sum, c) => sum + c.amount, 0);
  const totalCashPnl = cashEntries
    .filter((c) => c.affects_pnl === 1)
    .reduce((sum, c) => sum + c.amount, 0);
  const totalCashNonPnl = cashEntries
    .filter((c) => c.affects_pnl !== 1)
    .reduce((sum, c) => sum + c.amount, 0);

  const filteredTransactions = transactions.filter(
    (t) =>
      t.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      t.table_number.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCash = cashEntries.filter(
    (c) =>
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const isDismissalError = (err: any): boolean => {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('cancel') ||
      msg.includes('dismiss') ||
      msg.includes('user did not share') ||
      msg.includes('abort')
    );
  };

  const handleExportPdf = async () => {
    if (activeTab === 'sales') {
      if (filteredTransactions.length === 0) {
        Alert.alert('Tidak Ada Data', 'Tidak ada data transaksi untuk diekspor pada periode ini.');
        return;
      }
    } else {
      if (filteredCash.length === 0) {
        Alert.alert('Tidak Ada Data', 'Tidak ada data mutasi kas untuk diekspor pada periode ini.');
        return;
      }
    }

    setIsExporting(true);
    try {
      if (activeTab === 'sales') {
        const headers = ['No. Invoice', 'Tanggal', 'Status', 'Meja', 'Customer', 'Pembayaran', 'Total (Rp)'];
        const rows = filteredTransactions.map((t) => [
          t.invoice_number,
          t.business_date,
          t.status.toUpperCase(),
          `Meja ${t.table_number}`,
          t.customer_name || 'Umum',
          t.payment_method.toUpperCase(),
          formatRupiahDisplay(t.total),
        ]);
        await exportTableToPdf(
          'Riwayat Transaksi Penjualan',
          periodLabel || 'Seluruh Riwayat',
          headers,
          rows,
          [
            `Total Omset Selesai: ${formatRupiahDisplay(totalOmset)} (${completedCount} transaksi)`,
            `Rincian Omset: Tunai: ${formatRupiahDisplay(salesTunai)} | QRIS: ${formatRupiahDisplay(salesQris)} | Transfer: ${formatRupiahDisplay(salesTransfer)}`,
            `Status Lain: Pending: ${pendingCount} | Digabung: ${mergedCount} | Batal: ${cancelledCount}`,
          ]
        );
      } else {
        const title = activeTab === 'cash_in' ? 'Riwayat Kas Masuk' : 'Riwayat Kas Keluar';
        const headers = ['ID', 'Tanggal', 'Kategori', 'Keterangan', 'Jenis', 'Nominal (Rp)'];
        const rows = filteredCash.map((c) => [
          `#${c.id}`,
          c.business_date,
          c.category,
          c.notes || '-',
          c.affects_pnl === 1 ? 'Operasional (PnL)' : 'Non-Operasional',
          formatRupiahDisplay(c.amount),
        ]);
        await exportTableToPdf(
          title,
          periodLabel || 'Seluruh Riwayat',
          headers,
          rows,
          [
            `Total Mutasi Kas: ${formatRupiahDisplay(totalCashAmount)} (${filteredCash.length} catatan)`,
            `Operasional (PnL): ${formatRupiahDisplay(totalCashPnl)} | Non-Operasional: ${formatRupiahDisplay(totalCashNonPnl)}`,
          ]
        );
      }
      Alert.alert('Export Berhasil', 'Berkas berhasil dibuat dan siap dibagikan.');
    } catch (err: any) {
      if (isDismissalError(err)) {
        Alert.alert('Export Berhasil', 'Berkas berhasil dibuat dan siap dibagikan.');
      } else {
        Alert.alert('Export Gagal', err.message || 'Gagal mengekspor data ke format PDF.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (activeTab === 'sales') {
      if (filteredTransactions.length === 0) {
        Alert.alert('Tidak Ada Data', 'Tidak ada data transaksi untuk diekspor pada periode ini.');
        return;
      }
    } else {
      if (filteredCash.length === 0) {
        Alert.alert('Tidak Ada Data', 'Tidak ada data mutasi kas untuk diekspor pada periode ini.');
        return;
      }
    }

    setIsExporting(true);
    try {
      if (activeTab === 'sales') {
        await exportTransactionsCsv(filteredTransactions, periodLabel || 'periode');
      } else {
        await exportCashLedgerCsv(
          filteredCash,
          periodLabel || 'periode',
          activeTab === 'cash_in' ? 'income' : 'expense'
        );
      }
      Alert.alert('Export Berhasil', 'Berkas berhasil dibuat dan siap dibagikan.');
    } catch (err: any) {
      if (isDismissalError(err)) {
        Alert.alert('Export Berhasil', 'Berkas berhasil dibuat dan siap dibagikan.');
      } else {
        Alert.alert('Export Gagal', err.message || 'Gagal mengekspor data ke format CSV.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge label="Selesai" variant="success" size="sm" />;
      case 'pending':
        return <Badge label="Pending" variant="warning" size="sm" />;
      case 'merged':
        return <Badge label="Digabung" variant="info" size="sm" />;
      case 'cancelled':
        return <Badge label="Batal" variant="danger" size="sm" />;
      default:
        return <Badge label={status.toUpperCase()} variant="neutral" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Riwayat & Audit Transaksi</Text>
          <Text style={styles.headerSubtitle}>
            Penjualan Meja, Mutasi Kas Masuk & Kas Keluar ({periodLabel || 'Hari Ini'})
          </Text>
        </View>

        <View style={styles.headerRight}>
          <RealtimeClockBadge showDate={false} />
          <Button
            title="Unduh PDF"
            variant="outline"
            size="sm"
            onPress={handleExportPdf}
            loading={isExporting}
            style={[styles.headerBtn, styles.headerOutlineBtn]}
            textStyle={styles.headerOutlineBtnText}
          />
          <Button
            title="Unduh CSV"
            variant="outline"
            size="sm"
            onPress={handleExportCsv}
            loading={isExporting}
            style={[styles.headerBtn, styles.headerOutlineBtn]}
            textStyle={styles.headerOutlineBtnText}
          />
        </View>
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'sales' && styles.tabBtnActive]}
          onPress={() => setActiveTab('sales')}
        >
          <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>
            Penjualan & Pesanan ({transactions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'cash_in' && styles.tabBtnActive]}
          onPress={() => setActiveTab('cash_in')}
        >
          <Text style={[styles.tabText, activeTab === 'cash_in' && styles.tabTextActive]}>
            Buku Kas Masuk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'cash_out' && styles.tabBtnActive]}
          onPress={() => setActiveTab('cash_out')}
        >
          <Text style={[styles.tabText, activeTab === 'cash_out' && styles.tabTextActive]}>
            Buku Kas Keluar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Period Filter Bar */}
      <View style={styles.periodFilterBar}>
        <Text style={styles.periodLabelTitle}>Periode:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodButtonsScroll}>
          <TouchableOpacity
            style={[styles.periodBtn, periodFilter === 'today' && styles.periodBtnActive]}
            onPress={() => setPeriodFilter('today')}
          >
            <Text style={[styles.periodBtnText, periodFilter === 'today' && styles.periodBtnTextActive]}>
              Hari Ini
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodBtn, periodFilter === '7days' && styles.periodBtnActive]}
            onPress={() => setPeriodFilter('7days')}
          >
            <Text style={[styles.periodBtnText, periodFilter === '7days' && styles.periodBtnTextActive]}>
              7 Hari Terakhir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodBtn, periodFilter === 'month' && styles.periodBtnActive]}
            onPress={() => setPeriodFilter('month')}
          >
            <Text style={[styles.periodBtnText, periodFilter === 'month' && styles.periodBtnTextActive]}>
              1 Bulan Ini
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodBtn, periodFilter === 'custom' && styles.periodBtnActive]}
            onPress={() => setPeriodFilter('custom')}
          >
            <Text style={[styles.periodBtnText, periodFilter === 'custom' && styles.periodBtnTextActive]}>
              Pilih Bulan / Tanggal
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Custom Period Sub-bar */}
      {periodFilter === 'custom' && (
        <View style={styles.customSelectorBar}>
          <View style={styles.customModeToggle}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, customMode === 'month' && styles.modeToggleBtnActive]}
              onPress={() => setCustomMode('month')}
            >
              <Text style={[styles.modeToggleText, customMode === 'month' && styles.modeToggleTextActive]}>
                Per Bulan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeToggleBtn, customMode === 'date' && styles.modeToggleBtnActive]}
              onPress={() => setCustomMode('date')}
            >
              <Text style={[styles.modeToggleText, customMode === 'date' && styles.modeToggleTextActive]}>
                Per Tanggal
              </Text>
            </TouchableOpacity>
          </View>

          {customMode === 'month' ? (
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCustomMonth(getPreviousMonth(customMonth))}
              >
                <Text style={styles.navBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.navValText}>{customMonth}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCustomMonth(getNextMonth(customMonth))}
              >
                <Text style={styles.navBtnText}>▶</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCustomDate(getPreviousDay(customDate))}
              >
                <Text style={styles.navBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.navValText}>{customDate}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCustomDate(getNextDay(customDate))}
              >
                <Text style={styles.navBtnText}>▶</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.todayQuickBtn}
                onPress={() => setCustomDate(todayBizDate)}
              >
                <Text style={styles.todayQuickText}>Hari Ini</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Payment Method Breakdown Cards (Requirement 3) */}
      {activeTab === 'sales' ? (
        <View style={styles.metricsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsScroll}>
            <Card style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricLabel}>Total Omset (Selesai)</Text>
              <Text style={[styles.metricVal, { color: Colors.primary }]}>
                {formatRupiahDisplay(totalOmset)}
              </Text>
              <Text style={styles.metricSub}>{completedCount} transaksi sukses</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Tunai (Cash)</Text>
              <Text style={[styles.metricVal, { color: '#059669' }]}>
                {formatRupiahDisplay(salesTunai)}
              </Text>
              <Text style={styles.metricSub}>Masuk ke kas fisik</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>QRIS</Text>
              <Text style={[styles.metricVal, { color: '#2563eb' }]}>
                {formatRupiahDisplay(salesQris)}
              </Text>
              <Text style={styles.metricSub}>Non-tunai digital</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Transfer Bank</Text>
              <Text style={[styles.metricVal, { color: '#7c3aed' }]}>
                {formatRupiahDisplay(salesTransfer)}
              </Text>
              <Text style={styles.metricSub}>Rekening usaha</Text>
            </Card>

            {(pendingCount > 0 || mergedCount > 0 || cancelledCount > 0) && (
              <Card style={styles.metricCard}>
                <Text style={styles.metricLabel}>Status Non-Selesai</Text>
                <Text style={styles.metricValMuted}>
                  {pendingCount} Pending • {mergedCount} Gabung
                </Text>
                <Text style={styles.metricSub}>{cancelledCount} Batal</Text>
              </Card>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.metricsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsScroll}>
            <Card style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricLabel}>
                Total {activeTab === 'cash_in' ? 'Kas Masuk' : 'Kas Keluar'}
              </Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: activeTab === 'cash_in' ? Colors.primary : Colors.danger },
                ]}
              >
                {formatRupiahDisplay(totalCashAmount)}
              </Text>
              <Text style={styles.metricSub}>{cashEntries.length} catatan mutasi</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Operasional (PnL)</Text>
              <Text style={[styles.metricVal, { color: '#d97706' }]}>
                {formatRupiahDisplay(totalCashPnl)}
              </Text>
              <Text style={styles.metricSub}>Mempengaruhi laba rugi</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Non-Operasional</Text>
              <Text style={[styles.metricVal, { color: Colors.textMuted }]}>
                {formatRupiahDisplay(totalCashNonPnl)}
              </Text>
              <Text style={styles.metricSub}>Setor bank / modal / prive</Text>
            </Card>
          </ScrollView>
        </View>
      )}

      {/* Status Filter Chips (Requirement 2: Visibility of Pending & Merged) */}
      {activeTab === 'sales' && (
        <View style={styles.statusFilterBar}>
          <Text style={styles.statusFilterTitle}>Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipsScroll}>
            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'all' && styles.statusChipActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'all' && styles.statusChipTextActive]}>
                Semua ({transactions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'completed' && styles.statusChipActive]}
              onPress={() => setStatusFilter('completed')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'completed' && styles.statusChipTextActive]}>
                Selesai ({completedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'pending' && styles.statusChipActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'pending' && styles.statusChipTextActive]}>
                Pending ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'merged' && styles.statusChipActive]}
              onPress={() => setStatusFilter('merged')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'merged' && styles.statusChipTextActive]}>
                Digabung ({mergedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'cancelled' && styles.statusChipActive]}
              onPress={() => setStatusFilter('cancelled')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'cancelled' && styles.statusChipTextActive]}>
                Batal ({cancelledCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Filter & Search Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'sales'
              ? 'Cari no. invoice, meja, atau nama customer...'
              : 'Cari kategori atau keterangan kas...'
          }
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat riwayat...</Text>
          </View>
        ) : activeTab === 'sales' ? (
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Tidak ada riwayat transaksi penjualan.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const itemsList = item.items_json ? JSON.parse(item.items_json) : [];
              const isExpanded = expandedTxId === item.id;

              return (
                <Card style={styles.txCard}>
                  <View style={styles.txHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.txTitleRow}>
                        <Text style={styles.txInvoice}>{item.invoice_number}</Text>
                        {renderStatusBadge(item.status)}
                        <Badge label={`Meja ${item.table_number}`} variant="neutral" size="sm" />
                        <Badge
                          label={(item.payment_method || 'TUNAI').toUpperCase()}
                          variant="primary"
                          size="sm"
                        />
                      </View>
                      <Text style={styles.txMeta}>
                        Customer: <Text style={{ fontWeight: '700' }}>{item.customer_name || 'Umum'}</Text> • {item.created_at}
                      </Text>
                    </View>

                    <Text style={styles.txTotal}>{formatRupiahDisplay(item.total)}</Text>
                  </View>

                  {/* Expanded Items */}
                  {isExpanded && (
                    <View style={styles.itemsBox}>
                      <Text style={styles.itemsHeaderTitle}>Rincian Pesanan:</Text>
                      {itemsList.map((it: any, idx: number) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemName}>
                            {it.qty}x {it.name}
                            {it.is_additional === 1 ? ' (Sambungan)' : ''}
                          </Text>
                          <Text style={styles.itemSubtotal}>{formatRupiahDisplay(it.subtotal)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.txActionsRow}>
                    <Button
                      title={isExpanded ? 'Sembunyikan Item' : `Lihat Item (${itemsList.length})`}
                      variant="outline"
                      size="sm"
                      onPress={() => setExpandedTxId(isExpanded ? null : item.id)}
                    />
                    <Button
                      title="Lihat / Cetak Struk"
                      variant="primary"
                      size="sm"
                      onPress={() => handleOpenReceipt(item)}
                    />
                  </View>
                </Card>
              );
            }}
          />
        ) : (
          <FlatList
            data={filteredCash}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Tidak ada riwayat catatan kas.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isExpense = item.type === 'expense' || item.type === 'out';
              const isPnl = item.affects_pnl === 1;

              return (
                <Card style={styles.txCard}>
                  <View style={styles.txHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.txTitleRow}>
                        <Text style={styles.txInvoice}>{item.category}</Text>
                        <Badge
                          label={isPnl ? 'Operasional (PnL)' : 'Non-Operasional'}
                          variant={isPnl ? 'warning' : 'neutral'}
                          size="sm"
                        />
                      </View>
                      <Text style={styles.txMeta}>
                        {item.business_date} • {item.created_at}
                      </Text>
                      {item.notes ? (
                        <Text style={styles.cashNotesText}>Catatan: {item.notes}</Text>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.txTotal,
                        { color: isExpense ? Colors.danger : Colors.primary },
                      ]}
                    >
                      {isExpense ? '-' : '+'} {formatRupiahDisplay(item.amount)}
                    </Text>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>

      {/* Receipt Modal */}
      <ReceiptPreviewModal
        visible={receiptModalVisible}
        data={selectedReceiptData}
        onClose={() => setReceiptModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    borderColor: '#ffffff',
  },
  headerOutlineBtn: {
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerOutlineBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  periodFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  periodLabelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginRight: 8,
  },
  periodButtonsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  periodBtnActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  periodBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  customSelectorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    padding: 2,
  },
  modeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modeToggleBtnActive: {
    backgroundColor: '#ffffff',
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modeToggleTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  navValText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 80,
    textAlign: 'center',
  },
  todayQuickBtn: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  todayQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  metricsContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metricsScroll: {
    paddingHorizontal: 14,
    gap: 10,
  },
  metricCard: {
    minWidth: 140,
    padding: 10,
  },
  metricCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  metricValMuted: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statusFilterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginRight: 8,
  },
  statusChipsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  statusChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  listPadding: {
    padding: 14,
    gap: 10,
  },
  txCard: {
    padding: 14,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  txInvoice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  txMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  txTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  itemsBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  itemsHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  itemName: {
    fontSize: 12,
    color: Colors.text,
  },
  itemSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  txActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cashNotesText: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 4,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
