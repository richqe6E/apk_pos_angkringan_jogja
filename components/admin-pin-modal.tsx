import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { AppIcon } from './ui/app-icon';

interface AdminPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function AdminPinModal({
  visible,
  onClose,
  onSuccess,
  title = 'Otorisasi PIN Pemilik / Admin',
  description = 'Masukkan 6-digit PIN Keamanan untuk melanjutkan tindakan ini',
}: AdminPinModalProps) {
  const db = useSQLiteContext();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!pin.trim()) {
      setErrorMsg('Harap masukkan PIN Admin.');
      return;
    }

    setIsVerifying(true);
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'admin_pin'"
      );
      const savedPin = row?.value || '123456';

      if (pin === savedPin) {
        setPin('');
        setErrorMsg('');
        setIsVerifying(false);
        onClose();
        onSuccess();
      } else {
        setIsVerifying(false);
        setErrorMsg('PIN salah! Silakan coba lagi (Default: 123456).');
      }
    } catch {
      setIsVerifying(false);
      setErrorMsg('Gagal memverifikasi PIN.');
    }
  };

  const handleClose = () => {
    setPin('');
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <AppIcon name="lock" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={pin}
              onChangeText={(txt) => {
                setPin(txt.replace(/\D/g, ''));
                if (errorMsg) setErrorMsg('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
              placeholder="••••••"
              placeholderTextColor={Colors.placeholder}
              style={styles.pinInput}
            />
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.buttonRow}>
            <Button
              title="Batal"
              variant="ghost"
              size="md"
              style={{ flex: 1 }}
              onPress={handleClose}
            />
            <Button
              title="Verifikasi"
              variant="primary"
              size="md"
              loading={isVerifying}
              style={{ flex: 1.5 }}
              onPress={handleVerify}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  inputContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  pinInput: {
    width: '75%',
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 6,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySoft,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});

