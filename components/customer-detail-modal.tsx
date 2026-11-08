import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AppIcon } from './ui/app-icon';
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
  const { getCustomerFavorites, getCustomerHistory, claimReward } = useCustomerStore();

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

  const handleClaim = () => {
    if (!customer || !customer.current_tier) return;
    Alert.alert(
      'Klaim Reward Pelanggan',
      `Klaim reward "${customer.current_tier.reward_description}" untuk pelanggan ${customer.name}?\n\nTindakan ini akan mencatat di sistem bahwa reward telah diserahkan ke pelanggan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Klaim Reward',
          onPress: async () => {
            try {
              await claimReward(db, customer.id, customer.current_tier!);
              Alert.alert('Sukses', `Reward berhasil diklaim untuk ${customer.name}.`);
            } catch (err: any) {
              Alert.alert('Gagal', err?.message || 'Gagal memproses klaim reward');
            }
          },
        },
      ]
    );
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
                <View style={styles.rewardHeaderRow}>
                  <Text style={styles.sectionTitle}>Status Program Reward</Text>
                  {customer.current_tier && (
                    <Badge
                      label={customer.is_reward_claimed ? '✓ SUDAH DIKLAIM' : 'BELUM DIKLAIM'}
                      variant={customer.is_reward_claimed ? 'success' : 'warning'}
                      size="sm"
                    />
                  )}
                </View>

                {customer.current_tier ? (
                  <View style={[styles.currentTierBox, customer.is_reward_claimed && styles.currentTierBoxClaimed]}>
                    <View style={styles.tierStatusRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.currentTierLabel}>
                          {customer.is_reward_claimed ? 'Reward Telah Diklaim:' : 'Reward yang Berhak Diklaim:'}
                        </Text>
                        <Text style={styles.currentTierDesc}>
                          {customer.current_tier.reward_description}
                        </Text>
                      </View>
                      {!customer.is_reward_claimed && (
                        <TouchableOpacity style={styles.modalClaimBtn} onPress={handleClaim}>
                          <AppIcon name="gift" size={14} color="#ffffff" />
                          <Text style={styles.modalClaimBtnText}>Klaim Reward</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {customer.is_reward_claimed && customer.last_claimed_at && (
                      <View style={styles.claimedMetaBox}>
                        <AppIcon name="check-circle" size={14} color={Colors.success} />
                        <Text style={styles.claimedMetaText}>
                          Tercatat diserahkan pada: {customer.last_claimed_at}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noRewardText}>
                    Belum mencapai batas ambang reward pertama.
                  </Text>
                )}

                {customer.claim_history && customer.claim_history.length > 0 && (
                  <View style={styles.claimHistoryContainer}>
                    <Text style={styles.claimHistoryTitle}>Riwayat Klaim Reward:</Text>
                    {customer.claim_history.map((ch) => (
                      <View key={ch.id} style={styles.claimHistoryRow}>
                        <AppIcon name="receipt" size={12} color={Colors.textMuted} />
                        <Text style={styles.claimHistoryDesc} numberOfLines={1}>
                          {ch.tier_name} ({ch.reward_description})
                        </Text>
                        <Text style={styles.claimHistoryTime}>{ch.claimed_at}</Text>
                      </View>
                    ))}
                  </View>
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
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Menu Paling Sering Dibeli</Text>
                  <Badge label="Top 5 Favorit" variant="neutral" size="sm" />
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : favorites.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada riwayat pesanan.</Text>
                ) : (
                  favorites.map((fav, idx) => (
                    <View key={idx} style={styles.favRow}>
                      <Text style={[styles.favRank, idx === 0 && styles.favRankTop]}>#{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.favName}>{fav.menu_name}</Text>
                        <Text style={styles.favSub}>
                          Total Dipesan: <Text style={{ fontWeight: '700' }}>{fav.total_qty} porsi</Text> ({formatRupiahDisplay(fav.total_amount)})
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
  rewardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  currentTierBoxClaimed: {
    borderLeftColor: Colors.success,
    backgroundColor: '#f0fdf4',
  },
  currentTierLabel: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '700',
  },
  currentTierDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  tierStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalClaimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  modalClaimBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  claimedMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  claimedMetaText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
  },
  claimHistoryContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  claimHistoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  claimHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 6,
  },
  claimHistoryDesc: {
    flex: 1,
    fontSize: 11,
    color: Colors.text,
  },
  claimHistoryTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  favRankTop: {
    color: '#d97706',
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

