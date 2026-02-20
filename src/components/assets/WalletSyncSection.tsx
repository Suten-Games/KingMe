// src/components/assets/WalletSyncSection.tsx
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

interface WalletSyncSectionProps {
  onSync: () => void;
  isLoading: boolean;
  lastSyncTime?: string;
}

export default function WalletSyncSection({ 
  onSync, 
  isLoading, 
  lastSyncTime 
}: WalletSyncSectionProps) {
  const formatLastSync = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonLoading]}
        onPress={onSync}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <ActivityIndicator color="#0a0e1a" size="small" />
            <Text style={styles.buttonText}>Scanning...</Text>
          </>
        ) : (
          <>
            <Text style={styles.icon}>🔍</Text>
            <Text style={styles.buttonText}>Scan for New Tokens</Text>
          </>
        )}
      </TouchableOpacity>
      
      <Text style={styles.hintText}>
        Prices update automatically · Scan finds new tokens only
      </Text>
      
      {lastSyncTime && (
        <Text style={styles.lastSyncText}>
          Last synced: {formatLastSync(lastSyncTime)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ade80',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonLoading: {
    opacity: 0.6,
  },
  icon: {
    fontSize: 20,
  },
  buttonText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  hintText: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    marginTop: 6,
  },
});
