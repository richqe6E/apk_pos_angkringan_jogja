import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { useTransactionStore } from '../stores/transactionStore';
import { Employee, useEmployeeStore } from '../stores/employeeStore';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AppIcon } from './ui/app-icon';

interface CashierSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CashierSelectorModal({ visible, onClose }: CashierSelectorModalProps) {
  const db = useSQLiteContext();
  const { employees, loadEmployees, isLoading } = useEmployeeStore();
  const { activeCashierId, activeCashierName, setActiveCashier } = useTransactionStore();

  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (visible && db) {
      loadEmployees(db);
      setSearch('');
      setCustomName('');
    }
  }, [visible, db]);

  const activeEmployees = employees.filter(
    (e) => e.is_active === 1 && e.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelectEmployee = (emp: Employee) => {
    setActiveCashier(emp.id, emp.name);
    onClose();
  };

  const handleSelectCustomName = () => {
    const finalName = customName.trim() || 'Kasir';
    setActiveCashier(null, finalName);
    onClose();
  };

  const handleSelectDefaultCashier = () => {
    setActiveCashier(null, 'Kasir');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <AppIcon name="people" size={22} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.title}>Identitas Kasir Bertugas</Text>
                <Text style={styles.subtitle}>
                  Pilih staf yang melayani transaksi untuk pencatatan nota & audit
                </Text>
              </View>
            </View>

            {activeCashierName ? (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <AppIcon name="close" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Active Cashier Banner */}
          <View style={styles.currentCashierBanner}>
            <Text style={styles.currentCashierLabel}>Kasir Aktif Saat Ini:</Text>
            <View style={styles.currentCashierValueRow}>
              <Text style={styles.currentCashierName}>
                {activeCashierName || 'Belum Dipilih (Standar: Kasir)'}
              </Text>
              {activeCashierName ? (
                <Badge label="Sedang Aktif" variant="success" size="sm" />
              ) : (
                <Badge label="Pilih Staf" variant="warning" size="sm" />
              )}
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBox}>
            <AppIcon name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari nama karyawan staf kasir..."
              placeholderTextColor={Colors.placeholder}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="close" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Employee List */}
          <View style={styles.listContainer}>
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.centerText}>Memuat daftar karyawan...</Text>
              </View>
            ) : activeEmployees.length > 0 ? (
              <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
                {activeEmployees.map((emp) => {
                  const isSelected =
                    activeCashierId === emp.id ||
                    (!activeCashierId && activeCashierName === emp.name);

                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.empItem, isSelected && styles.empItemSelected]}
                      onPress={() => handleSelectEmployee(emp)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.empAvatar}>
                        <Text style={styles.empAvatarText}>
                          {emp.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.empInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.empName, isSelected && styles.empNameSelected]}>
                            {emp.name}
                          </Text>
                          {isSelected && <Badge label="Terpilih" variant="success" size="sm" />}
                        </View>
                        <Text style={styles.empPhone}>
                          {emp.phone ? `📱 ${emp.phone}` : 'Staf Angkringan Jogja'}
                        </Text>
                      </View>
                      <Text style={styles.selectArrow}>➔</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  {search ? 'Nama tidak ditemukan' : 'Belum ada staf terdaftar'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {search
                    ? 'Gunakan form input manual di bawah jika staf belum ada di daftar.'
                    : 'Anda dapat memasukkan nama kasir secara manual atau menggunakan nama kasir standar.'}
                </Text>
              </View>
            )}
          </View>

          {/* Fallback Input Form */}
          <View style={styles.manualFallbackSection}>
            <Text style={styles.manualSectionTitle}>Atau Masukkan Nama Kasir Manual / Tamu:</Text>
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="Contoh: Budi (Kasir Magang)..."
                placeholderTextColor={Colors.placeholder}
                value={customName}
                onChangeText={setCustomName}
              />
              <TouchableOpacity
                style={[
                  styles.manualConfirmBtn,
                  !customName.trim() && styles.manualConfirmBtnDisabled,
                ]}
                disabled={!customName.trim()}
                onPress={handleSelectCustomName}
              >
                <Text style={styles.manualConfirmBtnText}>Pilih</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.defaultCashierBtn}
              onPress={handleSelectDefaultCashier}
            >
              <Text style={styles.defaultCashierBtnText}>
                Gunakan Identitas Default: "Kasir"
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  currentCashierBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  currentCashierLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentCashierValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  currentCashierName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  clearSearchText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  listContainer: {
    height: 220,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 8,
  },
  empItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    marginBottom: 6,
  },
  empItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  empAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
  },
  empInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  empNameSelected: {
    color: Colors.primary,
  },
  empPhone: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  manualFallbackSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  manualSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  manualInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.text,
  },
  manualConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualConfirmBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  manualConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  defaultCashierBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  defaultCashierBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
