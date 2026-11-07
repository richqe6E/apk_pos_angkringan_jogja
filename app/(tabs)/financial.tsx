import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { formatRupiahDisplay } from '../../utils/formatRupiah';
import {
  useFinancialStore,
  CashEntry,
  getPreviousMonth,
  getNextMonth,
  getPreviousDay,
  getNextDay,
  PeriodFilterMode,
} from '../../stores/financialStore';
import { CashEntryModal } from '../../components/cash-entry-modal';
import { MonthlyCogsModal } from '../../components/monthly-cogs-modal';
import { AdminPinModal } from '../../components/admin-pin-modal';
import { exportTableToPdf } from '../../services/export';
import { exportFinancialReportCsv } from '../../services/backup';
import { getBusinessDate } from '../../utils/sessionHelper';

type FinancialTab = 'pnl' | 'ledger';
type PeriodFilterType = 'today' | '7days' | 'month' | 'custom';
type CustomSelectorMode = 'month' | 'date';

export default function FinancialScreen() {
  const db = useSQLiteContext();
  const todayBizDate = getBusinessDate();

  const {
    cashEntries,
    summary,
    selectedMonth,
    isLoading,
    setSelectedMonth,
    loadFinancialData,
    deleteCashEntry,
  } = useFinancialStore();

  const [activeTab, setActiveTab] = useState<FinancialTab>('pnl');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('month');
  const [customMode, setCustomMode] = useState<CustomSelectorMode>('month');
  const [customMonth, setCustomMonth] = useState<string>(selectedMonth || todayBizDate.substring(0, 7));
  const [customDate, setCustomDate] = useState<string>(todayBizDate);

  const [cashModalVisible, setCashModalVisible] = useState(false);
  const [cogsModalVisible, setCogsModalVisible] = useState(false);
  const [adminPinVisible, setAdminPinVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    refreshData();
  }, [db, periodFilter, customMode, customMonth, customDate]);

  const refreshData = () => {
    if (periodFilter === 'today') {
      loadFinancialData(db, { mode: 'today' });
    } else if (periodFilter === '7days') {
      loadFinancialData(db, { mode: '7days' });
    } else if (periodFilter === 'month') {
      loadFinancialData(db, { mode: 'month' });
    } else if (customMode === 'month') {
      setSelectedMonth(customMonth);
      loadFinancialData(db, { mode: 'custom_month', targetMonth: customMonth });
    } else {
      loadFinancialData(db, { mode: 'custom_date', customDate: customDate });
    }
  };

  const handlePrevMonth = () => {
    const prev = getPreviousMonth(customMonth);
    setCustomMonth(prev);
    setSelectedMonth(prev);
  };

  const handleNextMonth = () => {
    const next = getNextMonth(customMonth);
    setCustomMonth(next);
    setSelectedMonth(next);
  };

  const handleOpenCogs = () => {
    setAdminPinVisible(true);
  };

  const handleAdminPinSuccess = () => {
    setAdminPinVisible(false);
    setCogsModalVisible(true);
  };

  const handleDeleteEntry = (entry: CashEntry) => {
    Alert.alert(
      'Hapus Catatan Kas?',
      `Yakin ingin menghapus catatan ${entry.type === 'expense' ? 'pengeluaran' : 'pemasukan'} ${entry.category} senilai ${formatRupiahDisplay(entry.amount)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCashEntry(db, entry.id);
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const headers = ['Komponen Laba Rugi', 'Nominal (Rp)', 'Keterangan'];
      const rows = [
        ['(+) Penjualan Bruto Toko (Omset)', formatRupiahDisplay(summary.totalGrossSales), `${summary.totalTxCount} transaksi completed`],
        ['    - Penjualan Tunai (Cash)', formatRupiahDisplay(summary.salesTunai || 0), 'Metode bayar Tunai'],
        ['    - Penjualan QRIS', formatRupiahDisplay(summary.salesQris || 0), 'Metode bayar QRIS'],
        ['    - Penjualan Transfer Bank', formatRupiahDisplay(summary.salesTransfer || 0), 'Metode bayar Transfer'],
        ['(+) Pendapatan Operasional Lain', formatRupiahDisplay(summary.totalOperationalIncome), 'Pendapatan non-transaksi kasir (PnL)'],
        ['(-) HPP Bahan Baku (Owner)', formatRupiahDisplay(summary.monthlyCogs), summary.monthlyCogsNotes || 'Input HPP global akhir bulan'],
        ['(=) Laba Kotor (Gross Profit)', formatRupiahDisplay(summary.grossProfit), 'Omset - HPP Bahan'],
        ['(-) Beban Kas Operasional', formatRupiahDisplay(summary.totalOperationalExpenses), 'Arang, listrik, air, plastik, dll'],
        ['(=) LABA OPERASIONAL BERSIH', formatRupiahDisplay(summary.netOperatingProfit), 'Laba bersih operasional toko'],
      ];

      const summaries = [
        `Periode Laporan: ${summary.periodMonth}`,
        `Total Setor Bank / Prive Non-PnL: ${formatRupiahDisplay(summary.totalNonPnlExpenses)}`,
        `Total Modal Masuk Non-PnL: ${formatRupiahDisplay(summary.totalNonPnlIncome)}`,
      ];

      await exportTableToPdf('Laporan Keuangan & Laba Rugi', `Periode ${summary.periodMonth}`, headers, rows, summaries);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await exportFinancialReportCsv(summary, cashEntries, summary.periodMonth);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const renderPnlTab = () => (
    <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
      {/* Laporan Laba Rugi Formal */}
      <Card style={styles.statementCard}>
        <Text style={styles.cardHeaderTitle}>
          Laporan Laba Rugi Operasional ({summary.periodMonth})
        </Text>

        <View style={styles.statementRow}>
          <Text style={styles.statementLabel}>(+) Penjualan Bruto Toko (Omset)</Text>
          <Text style={styles.statementValueBold}>{formatRupiahDisplay(summary.totalGrossSales)}</Text>
        </View>

        {/* Breakdown Pembayaran di Laporan Laba Rugi */}
        <View style={styles.paymentBreakdownDetails}>
          <Text style={styles.paymentBreakdownItem}>
            • Tunai (Cash): {formatRupiahDisplay(summary.salesTunai || 0)}
          </Text>
          <Text style={styles.paymentBreakdownItem}>
            • QRIS: {formatRupiahDisplay(summary.salesQris || 0)}
          </Text>
          <Text style={styles.paymentBreakdownItem}>
            • Transfer Bank: {formatRupiahDisplay(summary.salesTransfer || 0)}
          </Text>
        </View>

        {summary.totalOperationalIncome > 0 && (
          <View style={styles.statementRow}>
            <Text style={styles.statementLabel}>(+) Pendapatan Operasional Lain</Text>
            <Text style={styles.statementValue}>{formatRupiahDisplay(summary.totalOperationalIncome)}</Text>
          </View>
        )}

        <View style={[styles.statementRow, styles.statementSubItem]}>
          <Text style={styles.statementLabel}>(-) HPP Global Bahan Baku (Owner)</Text>
          <Text style={[styles.statementValue, { color: Colors.danger }]}>
            - {formatRupiahDisplay(summary.monthlyCogs)}
          </Text>
        </View>

        <View style={[styles.statementRow, styles.subtotalRow]}>
          <Text style={styles.subtotalLabel}>(=) Laba Kotor (Gross Profit)</Text>
          <Text style={[styles.subtotalValue, { color: summary.grossProfit >= 0 ? Colors.primary : Colors.danger }]}>
            {formatRupiahDisplay(summary.grossProfit)}
          </Text>
        </View>

        <View style={[styles.statementRow, styles.statementSubItem]}>
          <Text style={styles.statementLabel}>(-) Total Beban Kas Operasional Toko</Text>
          <Text style={[styles.statementValue, { color: Colors.danger }]}>
            - {formatRupiahDisplay(summary.totalOperationalExpenses)}
          </Text>
        </View>

        {/* Category breakdown of operational expenses */}
        {summary.expenseByCategory.map((cat) => {
          const pct = summary.totalOperationalExpenses > 0
            ? Math.round((cat.total / summary.totalOperationalExpenses) * 100)
            : 0;

          return (
            <View key={cat.category} style={styles.catBreakdownRow}>
              <Text style={styles.catName}>• {cat.category}</Text>
              <Text style={styles.catVal}>
                {formatRupiahDisplay(cat.total)} ({pct}%)
              </Text>
            </View>
          );
        })}

        <View style={[styles.statementRow, styles.netProfitRow]}>
          <View>
            <Text style={styles.netProfitLabel}>(=) LABA OPERASIONAL BERSIH</Text>
            <Text style={styles.netProfitSub}>Sebelum pajak & transaksi non-operasional</Text>
          </View>
          <Text
            style={[
              styles.netProfitValue,
              { color: summary.netOperatingProfit >= 0 ? Colors.primary : Colors.danger },
            ]}
          >
            {formatRupiahDisplay(summary.netOperatingProfit)}
          </Text>
        </View>
      </Card>

      {/* Non-PnL Activity Card */}
      <Card style={styles.nonPnlCard}>
        <Text style={styles.cardHeaderTitle}>Arus Kas Non-Operasional (TIDAK Mempengaruhi Laba Rugi)</Text>
        <Text style={styles.nonPnlDesc}>
          Setoran tunai ke rekening bank pemilik, penarikan prive pribadi owner, atau suntikan modal awal.
        </Text>

        <View style={styles.nonPnlStatsRow}>
          <View style={styles.nonPnlStatBox}>
            <Text style={styles.nonPnlStatLabel}>Total Setor Bank / Prive</Text>
            <Text style={[styles.nonPnlStatVal, { color: '#d97706' }]}>
              {formatRupiahDisplay(summary.totalNonPnlExpenses)}
            </Text>
          </View>

          <View style={styles.nonPnlStatBox}>
            <Text style={styles.nonPnlStatLabel}>Total Modal Masuk / Pinjaman</Text>
            <Text style={[styles.nonPnlStatVal, { color: Colors.primary }]}>
              {formatRupiahDisplay(summary.totalNonPnlIncome)}
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );

  const renderLedgerTab = () => (
    <View style={styles.ledgerContainer}>
      <FlatList
        data={cashEntries}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada catatan mutasi kas pada periode ini.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpense = item.type === 'expense';
          const isPnl = item.affects_pnl === 1;

          return (
            <Card style={styles.ledgerCard}>
              <View style={styles.ledgerHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.ledgerTitleRow}>
                    <Text style={styles.ledgerCategory}>{item.category}</Text>
                    {isPnl ? (
                      <Badge
                        label={isExpense ? 'Beban Operasional (PnL)' : 'Pendapatan (PnL)'}
                        variant={isExpense ? 'warning' : 'success'}
                        size="sm"
                      />
                    ) : (
                      <Badge label="Non-Operasional" variant="neutral" size="sm" />
                    )}
                  </View>
                  <Text style={styles.ledgerMeta}>
                    {item.business_date} • {item.created_at}
                  </Text>
                  {item.notes ? (
                    <Text style={styles.ledgerNotes}>Catatan: {item.notes}</Text>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text
                    style={[
                      styles.ledgerAmount,
                      { color: isExpense ? Colors.danger : Colors.primary },
                    ]}
                  >
                    {isExpense ? '-' : '+'} {formatRupiahDisplay(item.amount)}
                  </Text>
                  <Button
                    title="Hapus"
                    variant="outline"
                    size="sm"
                    onPress={() => handleDeleteEntry(item)}
                  />
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Laporan Keuangan & Buku Kas</Text>
          <Text style={styles.headerSubtitle}>
            Segregasi Beban PnL, Mutasi Kas & HPP ({summary.periodMonth})
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <Button
            title="Unduh PDF"
            variant="outline"
            size="sm"
            onPress={handleExportPdf}
            loading={isExporting}
            style={styles.headerBtn}
          />
          <Button
            title="Unduh CSV"
            variant="outline"
            size="sm"
            onPress={handleExportCsv}
            loading={isExporting}
            style={styles.headerBtn}
          />
          <Button
            title="HPP Global"
            variant="outline"
            size="sm"
            onPress={handleOpenCogs}
            style={styles.headerBtn}
          />
          <Button
            title="+ Catat Kas"
            size="sm"
            onPress={() => setCashModalVisible(true)}
            style={styles.headerBtn}
          />
        </View>
      </View>

      {/* Period Filter Bar (Requirement 1) */}
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

      {/* Custom Selector Sub-bar */}
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
              <TouchableOpacity style={styles.navBtn} onPress={handlePrevMonth}>
                <Text style={styles.navBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.navValText}>{customMonth}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={handleNextMonth}>
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

      {/* 4 Metric Highlight Cards */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Penjualan Bruto (Omset)</Text>
          <Text style={[styles.metricValue, { color: Colors.primary }]}>
            {formatRupiahDisplay(summary.totalGrossSales)}
          </Text>
          <Text style={styles.metricSub}>{summary.totalTxCount} transaksi selesai</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>HPP Bahan Baku</Text>
          <Text style={[styles.metricValue, { color: '#d97706' }]}>
            {formatRupiahDisplay(summary.monthlyCogs)}
          </Text>
          <Text style={styles.metricSub}>Input bulanan pemilik</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Beban Kas Operasional</Text>
          <Text style={[styles.metricValue, { color: Colors.danger }]}>
            {formatRupiahDisplay(summary.totalOperationalExpenses)}
          </Text>
          <Text style={styles.metricSub}>Arang, listrik, plastik, dll</Text>
        </Card>

        <Card style={[styles.metricCard, summary.netOperatingProfit >= 0 ? styles.profitCard : styles.lossCard]}>
          <Text style={styles.metricLabel}>Laba Operasional Bersih</Text>
          <Text
            style={[
              styles.metricValue,
              { color: summary.netOperatingProfit >= 0 ? Colors.primary : Colors.danger },
            ]}
          >
            {formatRupiahDisplay(summary.netOperatingProfit)}
          </Text>
          <Text style={styles.metricSub}>Laba bersih operasional</Text>
        </Card>
      </View>

      {/* Payment Method Breakdown Cards (Requirement 3) */}
      <View style={styles.paymentBreakdownBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentBreakdownScroll}>
          <View style={styles.payChip}>
            <Text style={styles.payChipLabel}>💵 Tunai (Cash):</Text>
            <Text style={[styles.payChipVal, { color: '#059669' }]}>
              {formatRupiahDisplay(summary.salesTunai || 0)}
            </Text>
          </View>
          <View style={styles.payChip}>
            <Text style={styles.payChipLabel}>📱 QRIS:</Text>
            <Text style={[styles.payChipVal, { color: '#2563eb' }]}>
              {formatRupiahDisplay(summary.salesQris || 0)}
            </Text>
          </View>
          <View style={styles.payChip}>
            <Text style={styles.payChipLabel}>🏦 Transfer:</Text>
            <Text style={[styles.payChipVal, { color: '#7c3aed' }]}>
              {formatRupiahDisplay(summary.salesTransfer || 0)}
            </Text>
          </View>
          <View style={styles.payChip}>
            <Text style={styles.payChipLabel}>📊 Total Omset:</Text>
            <Text style={[styles.payChipVal, { color: Colors.primary }]}>
              {formatRupiahDisplay(summary.totalGrossSales)}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pnl' && styles.tabBtnActive]}
          onPress={() => setActiveTab('pnl')}
        >
          <Text style={[styles.tabText, activeTab === 'pnl' && styles.tabTextActive]}>
            Laporan Laba Rugi Operasional
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ledger' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ledger')}
        >
          <Text style={[styles.tabText, activeTab === 'ledger' && styles.tabTextActive]}>
            Buku Mutasi Kas ({cashEntries.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Menghitung laporan keuangan...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'pnl' && renderPnlTab()}
            {activeTab === 'ledger' && renderLedgerTab()}
          </>
        )}
      </View>

      {/* Cash Entry Modal */}
      <CashEntryModal
        visible={cashModalVisible}
        onClose={() => setCashModalVisible(false)}
      />

      {/* Monthly COGS Modal */}
      <MonthlyCogsModal
        visible={cogsModalVisible}
        onClose={() => setCogsModalVisible(false)}
      />

      {/* Admin PIN Modal for COGS */}
      <AdminPinModal
        visible={adminPinVisible}
        title="Otorisasi PIN Pemilik"
        description="Masukkan PIN Admin untuk mengubah atau menginput HPP Global Bulanan"
        onClose={() => setAdminPinVisible(false)}
        onSuccess={handleAdminPinSuccess}
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    borderColor: '#ffffff',
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
  metricsRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 12,
  },
  profitCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  lossCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  paymentBreakdownBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentBreakdownScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  payChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  payChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  payChipVal: {
    fontSize: 12,
    fontWeight: '800',
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
    paddingHorizontal: 18,
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
  content: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  statementCard: {
    padding: 16,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statementSubItem: {
    paddingLeft: 12,
  },
  statementLabel: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  statementValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  statementValueBold: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  paymentBreakdownDetails: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
    gap: 2,
  },
  paymentBreakdownItem: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subtotalRow: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 4,
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  catBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingVertical: 4,
  },
  catName: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  catVal: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  netProfitRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  netProfitLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  netProfitSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  netProfitValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  nonPnlCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  nonPnlDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  nonPnlStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nonPnlStatBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nonPnlStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  nonPnlStatVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  ledgerContainer: {
    flex: 1,
  },
  ledgerCard: {
    padding: 14,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ledgerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  ledgerMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ledgerNotes: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 4,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: '800',
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
