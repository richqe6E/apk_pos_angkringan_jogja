import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { AppIcon } from '../../components/ui/app-icon';
import { formatRupiahDisplay } from '../../utils/formatRupiah';
import { getBusinessDate } from '../../utils/sessionHelper';
import { withSqliteRetry } from '../../services/database';

interface TopItem {
  menu_name: string;
  total_qty: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const todayBizDate = getBusinessDate();

  const [salesTotal, setSalesTotal] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [sessionClosedAt, setSessionClosedAt] = useState<string | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);

  const loadDashboardKPIs = async () => {
    try {
      // 1. Penjualan Sesi Ini
      const salesRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ total_sales: number; count: number }>(
          `SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(id) as count
           FROM transactions
           WHERE business_date = ? AND status = 'completed'`,
          [todayBizDate]
        )
      );
      setSalesTotal(salesRow?.total_sales || 0);
      setTxCount(salesRow?.count || 0);

      // 2. Beban Kas Sesi Ini
      const expenseRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ total_expense: number }>(
          `SELECT COALESCE(SUM(amount), 0) as total_expense
           FROM cash_ledger
           WHERE business_date = ? AND type = 'expense' AND affects_pnl = 1`,
          [todayBizDate]
        )
      );
      setExpenseTotal(expenseRow?.total_expense || 0);

      // 3. Status Sesi Operasional
      const sessionRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ closed_at: string | null; status: string }>(
          'SELECT closed_at, status FROM operating_sessions WHERE business_date = ?',
          [todayBizDate]
        )
      );
      setSessionClosedAt(sessionRow?.status === 'closed' ? sessionRow.closed_at : null);

      // 4. Menu Terlaris Hari Ini
      const topRows = await withSqliteRetry(() =>
        db.getAllAsync<TopItem>(
          `SELECT ti.menu_name, SUM(ti.qty) as total_qty
           FROM transaction_items ti
           JOIN transactions t ON ti.transaction_id = t.id
           WHERE t.business_date = ? AND t.status = 'completed'
           GROUP BY ti.menu_name
           ORDER BY total_qty DESC
           LIMIT 3`,
          [todayBizDate]
        )
      );
      setTopItems(topRows || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardKPIs();
    }, [db, todayBizDate])
  );

  return (
    <View style={styles.container}>
      {/* Top Header Bar Hijau Emerald */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>ANGKRINGAN JOGJA</Text>
          <Text style={styles.headerSubtitle}>Sistem Kasir & Operasional Mandiri 100% Offline</Text>
        </View>
        <View style={styles.headerRight}>
          <RealtimeClockBadge />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Banner Tombol Aksi Utama Kasir */}
        <Card style={styles.kasirBannerCard}>
          <View style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Badge
                  label={sessionClosedAt ? 'Sesi Telah Ditutup' : 'Terminal Kasir Siap'}
                  variant={sessionClosedAt ? 'neutral' : 'success'}
                  size="sm"
                />
                <Text style={{ marginLeft: 8, fontSize: 13, color: Colors.textMuted }}>
                  Shift Sore - Malam (Patokan: 17.30 WIB)
                </Text>
              </View>
              <Text style={styles.bannerTitle}>Transaksi Penjualan Meja</Text>
              <Text style={styles.bannerDesc}>
                Input pesanan meja pending, pesanan sambungan dapur, gabung meja, dan pembayaran tunai/QRIS.
              </Text>
            </View>
            <Button
              title="Buka Kasir Transaksi"
              variant="primary"
              size="lg"
              style={{ minWidth: 200 }}
              onPress={() => router.push('/transaksi')}
              icon={<AppIcon name="cart" size={20} color="#ffffff" />}
            />
          </View>
        </Card>

        {/* 3 Kotak Kartu Metrik Sejajar */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Penjualan Sesi Ini</Text>
            <Text style={[styles.metricValue, { color: Colors.primaryDark }]}>
              {formatRupiahDisplay(salesTotal)}
            </Text>
            <Text style={styles.metricSub}>{txCount} transaksi selesai</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pengeluaran Beban Kas</Text>
            <Text style={[styles.metricValue, { color: Colors.danger }]}>
              {formatRupiahDisplay(expenseTotal)}
            </Text>
            <Text style={styles.metricSub}>Arang, listrik, bumbu dsb.</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Status Sesi Toko</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              {sessionClosedAt ? (
                <Badge label={`DITUTUP (${sessionClosedAt} WIB)`} variant="neutral" />
              ) : (
                <Badge label="SESI BUKA AKTIF" variant="success" />
              )}
            </View>
            <Text style={[styles.metricSub, { marginTop: 6 }]}>
              {sessionClosedAt ? 'Operasional malam telah berakhir' : 'Siap melayani pesanan'}
            </Text>
          </Card>
        </View>

        {/* Menu Terlaris Hari Ini */}
        {topItems.length > 0 && (
          <Card style={styles.topItemsCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AppIcon name="star" size={16} color="#d97706" />
              <Text style={styles.topItemsTitle}>Menu Terlaris Sesi Ini:</Text>
            </View>
            <View style={styles.topItemsRow}>
              {topItems.map((item, idx) => (
                <View key={idx} style={styles.topItemBadge}>
                  <Text style={styles.topItemRank}>#{idx + 1}</Text>
                  <Text style={styles.topItemName}>{item.menu_name}</Text>
                  <Text style={styles.topItemQty}>({item.total_qty} porsi)</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Pintasan Modul Cepat */}
        <Text style={styles.sectionTitle}>Pintasan Modul Cepat</Text>
        <View style={styles.shortcutGrid}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/attendance')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.primarySoft }]}>
              <AppIcon name="camera" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.shortcutTitle}>Absensi Karyawan</Text>
            <Text style={styles.shortcutDesc}>Foto kamera masuk 17.30 & tutup sesi pulang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/explore')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
              <AppIcon name="menu" size={24} color="#d97706" />
            </View>
            <Text style={styles.shortcutTitle}>Katalog Menu</Text>
            <Text style={styles.shortcutDesc}>Kelola nasi kucing, sate, bakaran & minuman</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <AppIcon name="history" size={24} color="#0284c7" />
            </View>
            <Text style={styles.shortcutTitle}>Riwayat Transaksi</Text>
            <Text style={styles.shortcutDesc}>Audit pesanan meja, kas masuk & kas keluar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/financial')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
              <AppIcon name="financial" size={24} color="#16a34a" />
            </View>
            <Text style={styles.shortcutTitle}>Laporan Keuangan</Text>
            <Text style={styles.shortcutDesc}>Laba rugi & input HPP global akhir bulan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/customers')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fdf2f8' }]}>
              <AppIcon name="star" size={24} color="#db2777" />
            </View>
            <Text style={styles.shortcutTitle}>Pelanggan & Reward</Text>
            <Text style={styles.shortcutDesc}>Akumulasi belanja seumur hidup & multi-tier reward</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/purchases')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#ffedd5' }]}>
              <AppIcon name="supplier" size={24} color="#ea580c" />
            </View>
            <Text style={styles.shortcutTitle}>Supplier & Pembelian</Text>
            <Text style={styles.shortcutDesc}>Belanja bahan tunai/tempo & foto nota supplier</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryDark,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 16,
  },
  content: {
    padding: 20,
  },
  kasirBannerCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    maxWidth: 580,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 16,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  metricSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  topItemsCard: {
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 20,
  },
  topItemsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 8,
  },
  topItemsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  topItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  topItemRank: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  topItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  topItemQty: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  shortcutCard: {
    width: '31.8%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  shortcutDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
