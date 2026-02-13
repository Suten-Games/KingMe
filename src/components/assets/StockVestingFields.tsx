// src/components/assets/StockVestingFields.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface StockVestingFieldsProps {
  hasUnvestedShares: boolean;
  setHasUnvestedShares: (value: boolean) => void;
  vestedShares: string;
  setVestedShares: (value: string) => void;
  unvestedShares: string;
  setUnvestedShares: (value: string) => void;
  sharesPerVest: string;
  setSharesPerVest: (value: string) => void;
  vestingFrequency: 'yearly' | 'quarterly' | 'monthly';
  setVestingFrequency: (value: 'yearly' | 'quarterly' | 'monthly') => void;
  nextVestDate: string;
  setNextVestDate: (value: string) => void;
}

export default function StockVestingFields({
  hasUnvestedShares,
  setHasUnvestedShares,
  vestedShares,
  setVestedShares,
  unvestedShares,
  setUnvestedShares,
  sharesPerVest,
  setSharesPerVest,
  vestingFrequency,
  setVestingFrequency,
  nextVestDate,
  setNextVestDate,
}: StockVestingFieldsProps) {
  return (
    <>
      {/* Vesting Toggle */}
      <Text style={styles.label}>Vesting Status</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            !hasUnvestedShares && styles.toggleButtonActive
          ]}
          onPress={() => setHasUnvestedShares(false)}
        >
          <Text style={[
            styles.toggleButtonText,
            !hasUnvestedShares && styles.toggleButtonTextActive
          ]}>
            All Vested
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.toggleButton,
            hasUnvestedShares && styles.toggleButtonActive
          ]}
          onPress={() => setHasUnvestedShares(true)}
        >
          <Text style={[
            styles.toggleButtonText,
            hasUnvestedShares && styles.toggleButtonTextActive
          ]}>
            Has Unvested Shares 🔒
          </Text>
        </TouchableOpacity>
      </View>

      {/* Vesting Details (only show if has unvested) */}
      {hasUnvestedShares && (
        <>
          <Text style={styles.label}>Vested Shares</Text>
          <Text style={styles.helperText}>
            How many shares can you sell today?
          </Text>
          <TextInput
            style={styles.input}
            placeholder="40"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={vestedShares}
            onChangeText={setVestedShares}
          />

          <Text style={styles.label}>Unvested Shares</Text>
          <Text style={styles.helperText}>
            How many shares are locked?
          </Text>
          <TextInput
            style={styles.input}
            placeholder="60"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={unvestedShares}
            onChangeText={setUnvestedShares}
          />

          <Text style={styles.label}>Vesting Schedule</Text>
          
          <Text style={styles.helperText}>How many shares unlock each time?</Text>
          <TextInput
            style={styles.input}
            placeholder="10"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={sharesPerVest}
            onChangeText={setSharesPerVest}
          />

          <Text style={styles.helperText}>How often do shares vest?</Text>
          <View style={styles.typeButtons}>
            {(['yearly', 'quarterly', 'monthly'] as const).map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.typeButton,
                  vestingFrequency === freq && styles.typeButtonActive
                ]}
                onPress={() => setVestingFrequency(freq)}
              >
                <Text style={[
                  styles.typeButtonText,
                  vestingFrequency === freq && styles.typeButtonTextActive
                ]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.helperText}>When do the next shares unlock?</Text>
          <TextInput
            style={styles.input}
            placeholder="2027-03-15"
            placeholderTextColor="#666"
            value={nextVestDate}
            onChangeText={setNextVestDate}
          />
          
          <View style={styles.helperBox}>
            <Text style={styles.helperTextBlue}>
              💡 Unvested shares won't count toward dividend income scenarios until they vest.
            </Text>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  helperTextBlue: {
    fontSize: 13,
    color: '#60a5fa',
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 2,
    borderColor: '#2a2f3e',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
  },
  toggleButtonActive: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2f1e',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a2f3e',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#4ade80',
    backgroundColor: '#1a2f1e',
  },
  helperBox: {
    backgroundColor: '#1a2a3a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
});
