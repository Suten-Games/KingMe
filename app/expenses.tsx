// app/expenses.tsx
import { View, StyleSheet } from 'react-native';
import { useStore } from '../src/store/useStore';
import { DailyExpenseTracker } from '../src/components/DailyExpenseTracker';

export default function ExpensesScreen() {
  const obligations = useStore((state) => state.obligations);

  return (
    <View style={styles.container}>
      <DailyExpenseTracker obligations={obligations} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0e1a',
  },
});
