import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AppIcon } from './ui/app-icon';
import { ModalHeader } from './ui/modal-header';
import { calculateAttendanceStatus, formatRealtimeClock } from '../utils/sessionHelper';

interface AttendanceCameraModalProps {
  visible: boolean;
  employeeId: number;
  employeeName: string;
  onClose: () => void;
  onCaptured: (photoUri: string) => Promise<void>;
}

export function AttendanceCameraModal({
  visible,
  employeeId,
  employeeName,
  onClose,
  onCaptured,
}: AttendanceCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [currentTimeStr, setCurrentTimeStr] = useState(formatRealtimeClock());
  const { isLate, lateMinutes } = calculateAttendanceStatus();

  useEffect(() => {
    if (visible) {
      setCapturedPhoto(null);
      setIsProcessing(false);
      const timer = setInterval(() => {
        setCurrentTimeStr(formatRealtimeClock());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [visible]);

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Card style={styles.permissionCard}>
            <AppIcon name="camera" size={44} color={Colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.permTitle}>Izin Kamera Diperlukan</Text>
            <Text style={styles.permDesc}>
              Aplikasi memerlukan izin akses kamera perangkat untuk mengambil foto bukti kehadiran absensi karyawan.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Batal" variant="ghost" size="md" onPress={onClose} />
              <Button title="Berikan Izin" variant="primary" size="md" onPress={requestPermission} />
            </View>
          </Card>
        </View>
      </Modal>
    );
  }

  const handleTakePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7, // Kompresi 70% agar hemat memori tablet Android
        skipProcessing: true,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
      }
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Gagal', err?.message || 'Gagal mengambil foto dari kamera.');
    }
  };

  const handleConfirmPhoto = async () => {
    if (!capturedPhoto) return;
    setIsProcessing(true);
    try {
      await onCaptured(capturedPhoto);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Gagal Absen', err?.message || 'Terjadi kesalahan saat memproses absensi.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.cameraCard}>
          {/* Header Modal Modern */}
          <ModalHeader
            title={`Absensi Masuk: ${employeeName}`}
            subtitle={`${currentTimeStr} • ${isLate ? `Terlambat ${lateMinutes} Menit` : 'Tepat Waktu'}`}
            icon="camera"
            onClose={onClose}
          />

          {/* Viewfinder Kamera atau Foto Terambil */}
          <View style={styles.viewfinderWrapper}>
            {!capturedPhoto ? (
              <CameraView ref={cameraRef} style={styles.cameraView} facing={facing}>
                <View style={styles.cameraOverlay}>
                  <View style={styles.faceGuide} />
                  <Text style={styles.guideText}>Posisikan wajah di dalam bingkai</Text>
                </View>
              </CameraView>
            ) : (
              <Image source={{ uri: capturedPhoto }} style={styles.photoPreview} />
            )}
          </View>

          {/* Controls Footer */}
          <View style={styles.footerControls}>
            {!capturedPhoto ? (
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={styles.switchFacingBtn}
                  onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}
                >
                  <AppIcon name="camera-reverse" size={16} color={Colors.textSecondary} />
                  <Text style={styles.switchFacingText}>Balik Kamera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={handleTakePicture}
                  disabled={isProcessing}
                >
                  <View style={styles.captureInnerCircle} />
                </TouchableOpacity>

                <View style={{ width: 90 }} />
              </View>
            ) : (
              <View style={styles.previewActionsRow}>
                <Button
                  title="Foto Ulang"
                  variant="outline"
                  size="md"
                  disabled={isProcessing}
                  onPress={() => setCapturedPhoto(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={isProcessing ? 'Menyimpan...' : 'Konfirmasi & Simpan Absen'}
                  variant="primary"
                  size="md"
                  loading={isProcessing}
                  onPress={handleConfirmPhoto}
                  style={{ flex: 2 }}
                />
              </View>
            )}
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  permTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  permDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  cameraCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  clockSub: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  viewfinderWrapper: {
    width: '100%',
    height: 380,
    backgroundColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  faceGuide: {
    width: 220,
    height: 270,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
    borderRadius: 110,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  footerControls: {
    marginTop: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  switchFacingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  switchFacingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  captureBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    borderWidth: 3,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInnerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});

