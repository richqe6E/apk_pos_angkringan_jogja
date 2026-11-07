import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { formatFullIndonesianDate, formatRealtimeClock } from '../utils/sessionHelper';

interface RealtimeClockBadgeProps {
  showDate?: boolean;
}

export function RealtimeClockBadge({ showDate = true }: RealtimeClockBadgeProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      {showDate && (
        <Text style={styles.dateText}>
          {formatFullIndonesianDate(currentDate)}
        </Text>
      )}
      {showDate && <View style={styles.divider} />}
      <Text style={styles.clockText}>
        {formatRealtimeClock(currentDate)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dateText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 10,
  },
  clockText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

