import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AppIcon } from '../components/ui/app-icon';
import { formatRupiahDisplay } from '../utils/formatRupiah';
import { Customer, useCustomerStore } from '../stores/customerStore';
import { CustomerDetailModal } from '../components/customer-detail-modal';
import { CustomerFormModal } from '../components/customer-form-modal';
import { RewardTierModal } from '../components/reward-tier-modal';

export default function CustomersScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { customers, isLoading, loadCustomers, deleteCustomer, claimReward } = useCustomerStore();

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [tierModalVisible, setTierModalVisible] = useState(false);

  useEffect(() => {
    loadCustomers(db);
  }, [db]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const handleOpenDetail = (c: Customer) => {
    setSelectedCustomer(c);
    setDetailModalVisible(true);
  };

  const handleOpenEdit = (c: Customer) => {
    if (c.id === 1) {
      Alert.alert('Info', 'Customer UMUM adalah profil bawaan sistem dan tidak dapat diedit.');
      return;
    }
    setEditingCustomer(c);
    setFormModalVisible(true);
  };

  const handleDelete = (c: Customer) => {
    if (c.id === 1) {
      Alert.alert('Perhatian', 'Customer UMUM tidak dapat dihapus.');
      return;
    }

    Alert.alert(
      'Hapus Data Pelanggan?',
      `Yakin ingin menghapus ${c.name}? Seluruh riwayat akumulasi reward untuk pelanggan ini akan terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(db, c.id);
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message);
            }
          },
        },
      ]
    );
  };

  const handleClaimReward = (c: Customer) => {
    if (!c.current_tier) return;
    Alert.alert(
      'Klaim Reward Pelanggan',
      `Klaim reward "${c.current_tier.reward_description}" untuk pelanggan ${c.name}?\n\nTindakan ini akan mencatat di sistem bahwa reward telah diserahkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Klaim Reward',
          onPress: async () => {
            try {
              await claimReward(db, c.id, c.current_tier!);
              Alert.alert('Sukses', `Reward berhasil diklaim untuk ${c.name}.`);
            } catch (err: any) {
              Alert.alert('Gagal', err?.message || 'Gagal memproses klaim reward');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <AppIcon name="arrow-back" size={18} color="#ffffff" />
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Manajemen Customer & Reward</Text>
            <Text style={styles.headerSubtitle}>
              Akumulasi Belanja Seumur Hidup & Program Multi-Tier Reward
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Button
            title="Atur Tingkatan Reward"
            variant="outline"
            size="sm"
            onPress={() => setTierModalVisible(true)}
            style={[styles.headerActionBtn, styles.headerOutlineBtn]}
            textStyle={styles.headerOutlineBtnText}
          />
          <Button
            title="+ Tambah Pelanggan"
            size="sm"
            onPress={() => {
              setEditingCustomer(null);
              setFormModalVisible(true);
            }}
            style={styles.headerActionBtn}
          />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari pelanggan berdasarkan nama atau no. telepon..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Customer List */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat data pelanggan...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Tidak ada data pelanggan yang cocok.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isGeneral = item.id === 1;

              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenDetail(item)}
                >
                  <Card style={[styles.customerCard, isGeneral && styles.generalCustomerCard]}>
                    <View style={styles.cardMain}>
                      <View style={styles.cardHeader}>
                        <View style={styles.nameRow}>
                          <Text style={styles.customerName}>{item.name}</Text>
                          {isGeneral ? (
                            <Badge label="Customer Bawaan" variant="neutral" size="sm" />
                          ) : item.current_tier ? (
                            <Badge
                              label={`★ ${item.current_tier.tier_name}`}
                              variant="success"
                              size="sm"
                            />
                          ) : (
                            <Badge label="Member" variant="primary" size="sm" />
                          )}
                        </View>
                        <Text style={styles.customerPhone}>
                          {item.phone ? item.phone : 'Tanpa No. Telepon'}
                        </Text>
                      </View>

                      {!isGeneral && (
                        <View style={styles.statsRow}>
                          <View>
                            <Text style={styles.statLabel}>Akumulasi Belanja</Text>
                            <Text style={styles.statSpent}>
                              {formatRupiahDisplay(item.total_spent)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.statLabel}>Total Kunjungan</Text>
                            <Text style={styles.statVisits}>{item.total_visits}x Order</Text>
                          </View>
                        </View>
                      )}

                      {!isGeneral && (
                        <View style={styles.favoriteRow}>
                          <AppIcon name="menu" size={13} color={Colors.primary} />
                          <Text style={styles.favoriteLabel}>Paling Sering Dipesan: </Text>
                          <Text style={styles.favoriteValue} numberOfLines={1}>
                            {item.top_favorite_item
                              ? `${item.top_favorite_item.menu_name} (${item.top_favorite_item.total_qty}x)`
                              : 'Belum ada riwayat pesanan'}
                          </Text>
                        </View>
                      )}

                      {!isGeneral && item.current_tier && (
                        <View style={[styles.rewardNotice, item.is_reward_claimed && styles.rewardNoticeClaimed]}>
                          <View style={styles.rewardNoticeHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <AppIcon
                                name={item.is_reward_claimed ? 'check-circle' : 'gift'}
                                size={14}
                                color={item.is_reward_claimed ? Colors.success : '#d97706'}
                              />
                              <Text style={[styles.rewardNoticeLabel, item.is_reward_claimed && { color: Colors.success }]}>
                                {item.is_reward_claimed ? 'Reward Sudah Diklaim' : 'Hak Reward Tersedia'}
                              </Text>
                            </View>
                            {item.is_reward_claimed ? (
                              <Badge label="SUDAH KLAIM" variant="success" size="sm" />
                            ) : (
                              <TouchableOpacity
                                style={styles.claimBtn}
                                onPress={() => handleClaimReward(item)}
                              >
                                <AppIcon name="gift" size={12} color="#ffffff" />
                                <Text style={styles.claimBtnText}>Klaim Reward</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.rewardNoticeText}>
                            {item.current_tier.reward_description}
                          </Text>
                          {item.is_reward_claimed && item.last_claimed_at && (
                            <Text style={styles.claimedAtText}>
                              Tercatat diklaim pada: {item.last_claimed_at}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {!isGeneral && (
                      <View style={styles.cardActions}>
                        <Button
                          title="Edit"
                          variant="outline"
                          size="sm"
                          onPress={() => handleOpenEdit(item)}
                        />
                        <Button
                          title="Hapus"
                          variant="danger"
                          size="sm"
                          onPress={() => handleDelete(item)}
                        />
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        visible={detailModalVisible}
        customer={selectedCustomer}
        onClose={() => setDetailModalVisible(false)}
        onEdit={(c) => handleOpenEdit(c)}
      />

      {/* Customer Form Modal */}
      <CustomerFormModal
        visible={formModalVisible}
        customer={editingCustomer}
        onClose={() => setFormModalVisible(false)}
      />

      {/* Reward Tier Modal */}
      <RewardTierModal
        visible={tierModalVisible}
        onClose={() => {
          setTierModalVisible(false);
          loadCustomers(db);
        }}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
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
    gap: 8,
  },
  headerActionBtn: {
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
  searchBarContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    height: 44,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  customerCard: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  generalCustomerCard: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 4,
    borderLeftColor: Colors.border,
  },
  cardMain: {
    flex: 1,
    marginRight: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  customerPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statSpent: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  statVisits: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  favoriteLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginLeft: 6,
  },
  favoriteValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  rewardNotice: {
    marginTop: 8,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
  },
  rewardNoticeClaimed: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: Colors.success,
  },
  rewardNoticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  claimedAtText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  rewardNoticeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  rewardNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
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

