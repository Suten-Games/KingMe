// src/components/assets/AddAssetButton.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface AddAssetButtonProps {
  onPress: () => void;
}

export default function AddAssetButton({ onPress }: AddAssetButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>+ Add Asset</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4ade80',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  text: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
