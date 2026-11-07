import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Employee, useEmployeeStore } from '../../stores/employeeStore';
import { AttendanceRecord, useAttendanceStore } from '../../stores/attendanceStore';
import { AttendanceCameraModal } from '../../components/attendance-camera-modal';
import { EmployeeModal } from '../../components/employee-modal';
import { AdminPinModal } from '../../components/admin-pin-modal';
import { getBusinessDate, formatFullIndonesianDate } from '../../utils/sessionHelper';
import { exportAttendanceToPdf, exportAttendanceToCsv } from '../../services/export';

type ActiveTab = 'today' | 'history' | 'employees';

export default function AttendanceScreen() {
  const db = useSQLiteContext();
  const { employees, loadEmployees, toggleEmployeeActive, deleteEmployee } = useEmployeeStore();
  const {
    todayAttendanceMap,
    attendanceHistory,
    isLoading,
    loadTodayAttendance,
    recordCheckIn,
    closeOperatingSession,
    loadAttendanceHistory,
    deleteAttendancePhotosForMonth,
  } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedEmployeeForCheckIn, setSelectedEmployeeForCheckIn] = useState<Employee | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [adminPinVisible, setAdminPinVisible] = useState(false);
  const [adminAction, setAdminAction] = useState<'clean_photos' | 'close_session' | null>(null);
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const businessDate = getBusinessDate();

  useEffect(() => {
    loadEmployees(db);
    loadTodayAttendance(db);
  }, [db]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttendanceHistory(db);
    }
  }, [activeTab, db]);

  const activeEmployees = employees.filter((e) => e.is_active === 1);
  const totalActive = activeEmployees.length;
  const presentCount = Object.keys(todayAttendanceMap).length;
  const absentCount = Math.max(0, totalActive - presentCount);
  const lateCount = Object.values(todayAttendanceMap).filter((a) => a.is_late === 1).length;

  const handleStartCheckIn = (emp: Employee) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedEmployeeForCheckIn(emp);
    setCameraModalVisible(true);
  };

  const handleCaptureComplete = async (photoUri: string) => {
    if (!selectedEmployeeForCheckIn) return;
    try {
      await recordCheckIn(
        db,
        selectedEmployeeForCheckIn.id,
        selectedEmployeeForCheckIn.name,
        photoUri
      );
      setCameraModalVisible(false);
      setSelectedEmployeeForCheckIn(null);
      Alert.alert('Sukses', `Absensi masuk ${selectedEmployeeForCheckIn.name} berhasil dicatat.`);
    } catch (err: any) {
      Alert.alert('Gagal Absensi', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleCloseSessionPress = () => {
    Alert.alert(
      'Tutup Sesi Operasional Toko?',
      `Seluruh karyawan aktif yang hadir hari ini (${presentCount} orang) akan otomatis dicatat jam pulangnya serentak berdasarkan waktu sekarang.\n\nTindakan ini menandai berakhirnya operasional malam ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tutup Sesi Sekarang',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await closeOperatingSession(db, 'Kasir / Admin');
              Alert.alert(
                'Sesi Operasional Ditutup',
                `Sesi berhasil ditutup pada ${res.sessionClosedAt} WIB.\nTotal ${res.totalStaffClosed} karyawan ditandai pulang.`
              );
            } catch (err: any) {
              Alert.alert('Gagal Menutup Sesi', err.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const records = attendanceHistory.length > 0 ? attendanceHistory : Object.values(todayAttendanceMap);
      await exportAttendanceToPdf(records, `Periode: ${businessDate}`);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message || 'Terjadi kesalahan saat membuat PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const records = attendanceHistory.length > 0 ? attendanceHistory : Object.values(todayAttendanceMap);
      await exportAttendanceToCsv(records, `rekap_absensi_${businessDate}`);
    } catch (err: any) {
      Alert.alert('Export Gagal', err.message || 'Terjadi kesalahan saat membuat CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCleanPhotosRequest = () => {
    setAdminAction('clean_photos');
    setAdminPinVisible(true);
  };

  const handleAdminPinSuccess = async () => {
    setAdminPinVisible(false);
    if (adminAction === 'clean_photos') {
      try {
        const currentMonth = businessDate.substring(0, 7); // 'YYYY-MM'
        const count = await deleteAttendancePhotosForMonth(db, currentMonth);
        Alert.alert(
          'Pembersihan Selesai',
          `Berhasil menghapus ${count} file foto absensi bulan ini untuk menghemat ruang memori lokal tablet.`
        );
      } catch (err: any) {
        Alert.alert('Gagal Membersihkan Foto', err.message);
      }
    }
    setAdminAction(null);
  };

  const renderTodayTab = () => (
    <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
      {/* Operating Status & Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>TANGGAL OPERASIONAL ANGKRIKAN</Text>
            <Text style={styles.summaryDate}>{formatFullIndonesianDate(businessDate)}</Text>
            <Text style={styles.summaryNote}>Patokan Jam Masuk: 17.30 WIB (Melebihi = Terlambat otomatis)</Text>
          </View>
          <Button
            title="Tutup Sesi Operasional"
            variant="danger"
            onPress={handleCloseSessionPress}
            style={styles.closeSessionBtn}
          />
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalActive}</Text>
            <Text style={styles.statTitle}>Total Karyawan</Text>
          </View>
          <View style={[styles.statBox, { borderColor: Colors.primary }]}>
            <Text style={[styles.statNumber, { color: Colors.primary }]}>{presentCount}</Text>
            <Text style={styles.statTitle}>Hadir Hari Ini</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#d97706' }]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>{absentCount}</Text>
            <Text style={styles.statTitle}>Belum Hadir</Text>
          </View>
          <View style={[styles.statBox, { borderColor: Colors.danger }]}>
            <Text style={[styles.statNumber, { color: Colors.danger }]}>{lateCount}</Text>
            <Text style={styles.statTitle}>Terlambat</Text>
          </View>
        </View>
      </Card>

      {/* Staff Check-in Cards */}
      <Text style={styles.sectionHeaderTitle}>Daftar Karyawan Hari Ini</Text>
      <View style={styles.employeeGrid}>
        {activeEmployees.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada data karyawan aktif.</Text>
            <Button
              title="+ Tambah Karyawan Baru"
              variant="outline"
              onPress={() => {
                setEditingEmployee(null);
                setEmployeeModalVisible(true);
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : (
          activeEmployees.map((emp) => {
            const att = todayAttendanceMap[emp.id];
            const isCheckedIn = !!att;

            return (
              <Card
                key={emp.id}
                style={[
                  styles.staffCard,
                  isCheckedIn ? styles.staffCardCheckedIn : styles.staffCardPending,
                ]}
              >
                <View style={styles.staffCardHeader}>
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{emp.name}</Text>
                    <Text style={styles.staffPhone}>{emp.phone || 'Tanpa No. HP'}</Text>
                  </View>
                  {isCheckedIn ? (
                    <Badge
                      label={
                        att.is_late === 1
                          ? `Terlambat (${att.late_minutes} mnt)`
                          : 'Tepat Waktu'
                      }
                      variant={att.is_late === 1 ? 'danger' : 'success'}
                    />
                  ) : (
                    <Badge label="Belum Absen" variant="warning" />
                  )}
                </View>

                {isCheckedIn ? (
                  <View style={styles.attDetailsRow}>
                    {att.check_in_photo ? (
                      <TouchableOpacity
                        onPress={() => setViewPhotoUri(att.check_in_photo)}
                        style={styles.photoThumbContainer}
                      >
                        <Image source={{ uri: att.check_in_photo }} style={styles.photoThumb} />
                        <Text style={styles.photoThumbText}>Lihat Foto</Text>
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.attTimeInfo}>
                      <Text style={styles.timeLabel}>
                        Masuk:{' '}
                        <Text style={styles.timeValueBold}>{att.check_in_time} WIB</Text>
                      </Text>
                      <Text style={styles.timeLabel}>
                        Pulang:{' '}
                        {att.check_out_time ? (
                          <Text style={styles.timeValueBold}>{att.check_out_time} WIB</Text>
                        ) : (
                          <Text style={{ color: '#059669', fontWeight: '700' }}>
                            Sedang Bertugas
                          </Text>
                        )}
                      </Text>
                    </View>

                    <View style={styles.lockedNotice}>
                      <Text style={styles.lockedNoticeText}>Terkunci (1x Absen/Hari)</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Button
                      title="Ambil Foto & Absen Masuk"
                      variant="primary"
                      onPress={() => handleStartCheckIn(emp)}
                      style={styles.checkInBtn}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <View style={styles.historyContainer}>
      <View style={styles.historyActionBar}>
        <View>
          <Text style={styles.historyTitle}>Riwayat & Rekap Absensi Karyawan</Text>
          <Text style={styles.historySubtitle}>
            Menampilkan seluruh rekap jam masuk, jam pulang, dan durasi keterlambatan
          </Text>
        </View>

        <View style={styles.historyButtons}>
          <Button
            title="Unduh PDF"
            variant="outline"
            onPress={handleExportPdf}
            loading={isExporting}
            style={styles.exportBtn}
          />
          <Button
            title="Unduh CSV/Excel"
            variant="outline"
            onPress={handleExportCsv}
            loading={isExporting}
            style={styles.exportBtn}
          />
          <Button
            title="Bersihkan Foto Bulanan"
            variant="danger"
            onPress={handleCleanPhotosRequest}
            style={styles.exportBtn}
          />
        </View>
      </View>

      <FlatList
        data={attendanceHistory}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada riwayat absensi tersimpan.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.historyItemCard}>
            <View style={styles.historyItemLeft}>
              <Text style={styles.historyIndex}>#{index + 1}</Text>
              {item.check_in_photo ? (
                <TouchableOpacity onPress={() => setViewPhotoUri(item.check_in_photo)}>
                  <Image source={{ uri: item.check_in_photo }} style={styles.historyThumb} />
                </TouchableOpacity>
              ) : null}
              <View>
                <Text style={styles.historyEmpName}>{item.employee_name}</Text>
                <Text style={styles.historyDate}>Tanggal Operasional: {item.business_date}</Text>
                <Text style={styles.historyTimes}>
                  Masuk: {item.check_in_time} WIB | Pulang: {item.check_out_time ? `${item.check_out_time} WIB` : 'Aktif'}
                </Text>
              </View>
            </View>

            <Badge
              label={
                item.is_late === 1
                  ? `Terlambat ${item.late_minutes} Menit`
                  : 'Tepat Waktu'
              }
              variant={item.is_late === 1 ? 'danger' : 'success'}
            />
          </Card>
        )}
      />
    </View>
  );

  const renderEmployeesTab = () => (
    <View style={styles.historyContainer}>
      <View style={styles.historyActionBar}>
        <View>
          <Text style={styles.historyTitle}>Daftar Master Karyawan</Text>
          <Text style={styles.historySubtitle}>Kelola nama, nomor telepon, dan status aktif staf</Text>
        </View>

        <Button
          title="+ Tambah Karyawan Baru"
          variant="primary"
          onPress={() => {
            setEditingEmployee(null);
            setEmployeeModalVisible(true);
          }}
        />
      </View>

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada daftar karyawan.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.employeeRowCard}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.historyEmpName}>{item.name}</Text>
                <Badge
                  label={item.is_active === 1 ? 'Aktif' : 'Nonaktif'}
                  variant={item.is_active === 1 ? 'success' : 'neutral'}
                />
              </View>
              <Text style={styles.staffPhone}>{item.phone || 'Tanpa No. HP'}</Text>
            </View>

            <View style={styles.empRowActions}>
              <Button
                title={item.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                variant="outline"
                size="sm"
                onPress={() => toggleEmployeeActive(db, item.id, item.is_active)}
              />
              <Button
                title="Edit"
                variant="outline"
                size="sm"
                onPress={() => {
                  setEditingEmployee(item);
                  setEmployeeModalVisible(true);
                }}
              />
              <Button
                title="Hapus"
                variant="danger"
                size="sm"
                onPress={() => {
                  Alert.alert(
                    'Hapus Karyawan',
                    `Apakah Anda yakin ingin menghapus data ${item.name}?`,
                    [
                      { text: 'Batal', style: 'cancel' },
                      {
                        text: 'Hapus',
                        style: 'destructive',
                        onPress: () => deleteEmployee(db, item.id),
                      },
                    ]
                  );
                }}
              />
            </View>
          </Card>
        )}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Absensi & Manajemen Karyawan</Text>
          <Text style={styles.headerSubtitle}>
            Kamera Masuk (17.30 WIB) & Tutup Sesi Pulang Otomatis
          </Text>
        </View>

        <View style={styles.headerRight}>
          <RealtimeClockBadge showDate={false} />
          <Button
            title="+ Karyawan"
            size="sm"
            variant="outline"
            onPress={() => {
              setEditingEmployee(null);
              setEmployeeModalVisible(true);
            }}
            style={styles.addEmpBtnHeader}
          />
        </View>
      </View>

      {/* Tabs Header */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'today' && styles.tabButtonTextActive]}>
            Absensi Hari Ini
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
            Rekap & Riwayat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'employees' && styles.tabButtonActive]}
          onPress={() => setActiveTab('employees')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'employees' && styles.tabButtonTextActive]}>
            Master Karyawan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'today' && renderTodayTab()}
            {activeTab === 'history' && renderHistoryTab()}
            {activeTab === 'employees' && renderEmployeesTab()}
          </>
        )}
      </View>

      {/* Attendance Camera Modal */}
      {selectedEmployeeForCheckIn && (
        <AttendanceCameraModal
          visible={cameraModalVisible}
          employeeId={selectedEmployeeForCheckIn.id}
          employeeName={selectedEmployeeForCheckIn.name}
          onClose={() => {
            setCameraModalVisible(false);
            setSelectedEmployeeForCheckIn(null);
          }}
          onCaptured={handleCaptureComplete}
        />
      )}

      {/* Employee Modal */}
      <EmployeeModal
        visible={employeeModalVisible}
        employee={editingEmployee}
        onClose={() => setEmployeeModalVisible(false)}
      />

      {/* Admin PIN Modal */}
      <AdminPinModal
        visible={adminPinVisible}
        title="Otorisasi PIN Pemilik"
        description="Masukkan PIN Admin untuk menghapus cache foto absensi bulanan"
        onClose={() => {
          setAdminPinVisible(false);
          setAdminAction(null);
        }}
        onSuccess={handleAdminPinSuccess}
      />

      {/* Full Photo Modal */}
      <Modal visible={!!viewPhotoUri} transparent animationType="fade">
        <View style={styles.photoViewModal}>
          <TouchableOpacity
            style={styles.photoCloseBtn}
            onPress={() => setViewPhotoUri(null)}
          >
            <Text style={styles.photoCloseText}>✕ Tutup</Text>
          </TouchableOpacity>
          {viewPhotoUri ? (
            <Image
              source={{ uri: viewPhotoUri }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
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
    paddingVertical: 12,
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
    gap: 12,
  },
  addEmpBtnHeader: {
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabButtonTextActive: {
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
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryDate: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  summaryNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeSessionBtn: {
    minWidth: 180,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  employeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  staffCard: {
    width: '48.8%',
    padding: 14,
  },
  staffCardCheckedIn: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  staffCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
  },
  staffCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  staffInfo: {
    flex: 1,
    marginRight: 8,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  staffPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  attDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  photoThumbContainer: {
    alignItems: 'center',
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  photoThumbText: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  attTimeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timeValueBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  lockedNotice: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  lockedNoticeText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkInBtn: {
    width: '100%',
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  historyContainer: {
    flex: 1,
  },
  historyActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  historySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    paddingHorizontal: 12,
  },
  historyItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    width: 24,
  },
  historyThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  historyEmpName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyTimes: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  employeeRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
  },
  empRowActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
  photoViewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullPhoto: {
    width: '90%',
    height: '75%',
    borderRadius: 8,
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  photoCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
