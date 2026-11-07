import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { formatRupiahDisplay } from '../utils/formatRupiah';
import {
  Customer,
  CustomerFavoriteItem,
  CustomerTransactionHistory,
  useCustomerStore,
} from '../stores/customerStore';

interface CustomerDetailModalProps {
  visible: boolean;
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

export function CustomerDetailModal({
  visible,
  customer,
  onClose,
  onEdit,
}: CustomerDetailModalProps) {
  const db = useSQLiteContext();
  const { getCustomerFavorites, getCustomerHistory } = useCustomerStore();

  const [favorites, setFavorites] = useState<CustomerFavoriteItem[]>([]);
  const [history, setHistory] = useState<CustomerTransactionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && customer && customer.id > 1) {
      loadData(customer.id);
    } else {
      setFavorites([]);
      setHistory([]);
    }
  }, [visible, customer]);

  const loadData = async (cid: number) => {
    setIsLoading(true);
    try {
      const [favs, hist] = await Promise.all([
        getCustomerFavorites(db, cid),
        getCustomerHistory(db, cid),
      ]);
      setFavorites(favs);
      setHistory(hist);
    } catch (err) {
      console.error('Error loading customer detail details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  const isGeneralCustomer = customer.id === 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{customer.name}</Text>
                {isGeneralCustomer ? (
                  <Badge label="Bawaan Sistem" variant="neutral" />
                ) : customer.current_tier ? (
                  <Badge
                    label={`★ ${customer.current_tier.tier_name}`}
                    variant="success"
                  />
                ) : (
                  <Badge label="Member Reguler" variant="primary" />
                )}
              </View>
              <Text style={styles.subtitle}>
                {customer.phone ? `No. Telp: ${customer.phone}` : 'Tanpa No. Telepon'}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Stat Cards */}
            <View style={styles.statsRow}>
              <Card style={styles.statBox}>
                <Text style={styles.statLabel}>Akumulasi Belanja</Text>
                <Text style={[styles.statValue, { color: Colors.primary }]}>
                  {formatRupiahDisplay(customer.total_spent)}
                </Text>
                <Text style={styles.statSub}>Total belanja seumur hidup</Text>
              </Card>

              <Card style={styles.statBox}>
                <Text style={styles.statLabel}>Frekuensi Kunjungan</Text>
                <Text style={styles.statValue}>{customer.total_visits}x</Text>
                <Text style={styles.statSub}>Total transaksi selesai</Text>
              </Card>
            </View>

            {/* Reward Information Box */}
            {!isGeneralCustomer && (
              <Card style={styles.rewardCard}>
                <Text style={styles.sectionTitle}>Status Program Reward</Text>
                {customer.current_tier ? (
                  <View style={styles.currentTierBox}>
                    <Text style={styles.currentTierLabel}>Reward yang Berhak Diklaim:</Text>
                    <Text style={styles.currentTierDesc}>
                      {customer.current_tier.reward_description}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noRewardText}>
                    Belum mencapai batas ambang reward pertama.
                  </Text>
                )}

                {customer.next_tier && (
                  <View style={styles.nextTierBox}>
                    <Text style={styles.nextTierText}>
                      Target Berikutnya:{' '}
                      <Text style={{ fontWeight: '700', color: Colors.primary }}>
                        {customer.next_tier.tier_name}
                      </Text>{' '}
                      ({formatRupiahDisplay(customer.next_tier.min_spend)})
                    </Text>
                    <Text style={styles.nextTierRemaining}>
                      Belanja lagi senilai{' '}
                      <Text style={{ fontWeight: '800' }}>
                        {formatRupiahDisplay(customer.spend_to_next || 0)}
                      </Text>{' '}
                      untuk mendapatkan {customer.next_tier.reward_description}.
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Favorite Items */}
            {!isGeneralCustomer && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Menu Angkringan Favorit</Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : favorites.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada riwayat pesanan.</Text>
                ) : (
                  favorites.map((fav, idx) => (
                    <View key={idx} style={styles.favRow}>
                      <Text style={styles.favRank}>#{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.favName}>{fav.menu_name}</Text>
                        <Text style={styles.favSub}>
                          Total Dipesan: {fav.total_qty} porsi ({formatRupiahDisplay(fav.total_amount)})
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            )}

            {/* Recent Transaction History */}
            {!isGeneralCustomer && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Riwayat Transaksi Terakhir</Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : history.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
                ) : (
                  history.map((tx) => (
                    <View key={tx.id} style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyInv}>{tx.invoice_number}</Text>
                        <Text style={styles.historyMeta}>
                          {tx.business_date} | Meja {tx.table_number} | {tx.payment_method.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.historyAmount}>{formatRupiahDisplay(tx.total)}</Text>
                    </View>
                  ))
                )}
              </Card>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            {!isGeneralCustomer && (
              <Button
                title="Edit Profil Pelanggan"
                variant="outline"
                onPress={() => {
                  onClose();
                  onEdit(customer);
                }}
              />
            )}
            <Button title="Tutup" variant="primary" onPress={onClose} style={{ minWidth: 100 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 14,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rewardCard: {
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sectionCard: {
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  currentTierBox: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  currentTierLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  currentTierDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  noRewardText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  nextTierBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  nextTierText: {
    fontSize: 12,
    color: Colors.text,
  },
  nextTierRemaining: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  favRank: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    width: 30,
  },
  favName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  favSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyInv: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  historyMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#ffffff',
  },
});

