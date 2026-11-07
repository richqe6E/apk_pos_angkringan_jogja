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
import { exportTableToPdf, exportTableToCsv } from '../../services/export';

type HistoryTab = 'sales' | 'cash_in' | 'cash_out';

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
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [cashEntries, setCashEntries] = useState<CashRow[]>([]);
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);
  const [selectedReceiptData, setSelectedReceiptData] = useState<PrintReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterTodayOnly, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'sales') {
        const query = filterTodayOnly
          ? `SELECT t.*, (
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
            WHERE t.business_date = ? AND t.status = 'completed'
            ORDER BY t.id DESC`
          : `SELECT t.*, (
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
            WHERE t.status = 'completed'
            ORDER BY t.id DESC`;

        const params = filterTodayOnly ? [todayBizDate] : [];
        const rows = await withSqliteRetry(() =>
          db.getAllAsync<TransactionRow>(query, params)
        );
        setTransactions(rows || []);
      } else {
        const type = activeTab === 'cash_in' ? 'income' : 'expense';
        const query = filterTodayOnly
          ? 'SELECT * FROM cash_ledger WHERE type = ? AND business_date = ? ORDER BY id DESC'
          : 'SELECT * FROM cash_ledger WHERE type = ? ORDER BY id DESC';

        const params = filterTodayOnly ? [type, todayBizDate] : [type];
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

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'sales') {
        const headers = ['No. Invoice', 'Tanggal', 'Meja', 'Customer', 'Pembayaran', 'Total (Rp)'];
        const rows = filteredTransactions.map((t) => [
          t.invoice_number,
          t.business_date,
          `Meja ${t.table_number}`,
          t.customer_name,
          t.payment_method.toUpperCase(),
          formatRupiahDisplay(t.total),
        ]);
        const totalSales = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
        await exportTableToPdf(
          'Riwayat Transaksi Penjualan',
          filterTodayOnly ? `Hari Ini (${todayBizDate})` : 'Seluruh Riwayat',
          headers,
          rows,
          [`Total Penjualan: ${formatRupiahDisplay(totalSales)} (${filteredTransactions.length} transaksi)`]
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
        const totalAmount = filteredCash.reduce((sum, c) => sum + c.amount, 0);
        await exportTableToPdf(
          title,
          filterTodayOnly ? `Hari Ini (${todayBizDate})` : 'Seluruh Riwayat',
          headers,
          rows,
          [`Total Mutasi: ${formatRupiahDisplay(totalAmount)} (${filteredCash.length} catatan)`]
        );
      }
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'sales') {
        const headers = ['Invoice', 'Tanggal', 'Meja', 'Customer', 'Metode Bayar', 'Total', 'Waktu'];
        const rows = filteredTransactions.map((t) => [
          t.invoice_number,
          t.business_date,
          t.table_number,
          t.customer_name,
          t.payment_method,
          t.total,
          t.created_at,
        ]);
        await exportTableToCsv(`riwayat_penjualan_${todayBizDate}`, headers, rows);
      } else {
        const prefix = activeTab === 'cash_in' ? 'kas_masuk' : 'kas_keluar';
        const headers = ['ID', 'Tanggal', 'Kategori', 'Catatan', 'PnL', 'Nominal', 'Waktu'];
        const rows = filteredCash.map((c) => [
          c.id,
          c.business_date,
          c.category,
          c.notes,
          c.affects_pnl === 1 ? 'PnL' : 'Non-PnL',
          c.amount,
          c.created_at,
        ]);
        await exportTableToCsv(`${prefix}_${todayBizDate}`, headers, rows);
      }
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message);
    } finally {
      setIsExporting(false);
    }
  };

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

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Riwayat & Audit Transaksi</Text>
          <Text style={styles.headerSubtitle}>
            Penjualan Meja, Mutasi Kas Masuk & Kas Keluar
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
        </View>
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'sales' && styles.tabBtnActive]}
          onPress={() => setActiveTab('sales')}
        >
          <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>
            Penjualan Selesai
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

        <TouchableOpacity
          style={[styles.todayToggleBtn, filterTodayOnly && styles.todayToggleBtnActive]}
          onPress={() => setFilterTodayOnly(!filterTodayOnly)}
        >
          <Text style={[styles.todayToggleText, filterTodayOnly && styles.todayToggleTextActive]}>
            {filterTodayOnly ? '✓ Sesi Hari Ini Saja' : 'Semua Tanggal'}
          </Text>
        </TouchableOpacity>
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
                        <Badge label={`Meja ${item.table_number}`} variant="primary" size="sm" />
                        <Badge
                          label={item.payment_method.toUpperCase()}
                          variant="neutral"
                          size="sm"
                        />
                      </View>
                      <Text style={styles.txMeta}>
                        Customer: <Text style={{ fontWeight: '700' }}>{item.customer_name}</Text> • {item.created_at}
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
              const isExpense = item.type === 'expense';
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
  filterBar: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  todayToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  todayToggleBtnActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  todayToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  todayToggleTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  listPadding: {
    padding: 16,
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
    gap: 8,
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
