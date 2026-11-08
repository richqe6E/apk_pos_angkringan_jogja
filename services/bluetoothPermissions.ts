import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Memeriksa dan meminta izin Bluetooth & Lokasi yang diperlukan oleh Android
 * untuk memindai dan menghubungkan printer thermal ESC/POS 58mm.
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const scanGranted =
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED;
      const connectGranted =
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;

      return scanGranted && connectGranted;
    }

    const fineLocation = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Bluetooth permission check error:', err);
    return false;
  }
}
