// app/onboarding/income.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';

export default function IncomeScreen() {
  const router = useRouter();
  const income = useStore((state) => state.income);
  const setIncome = useStore((state) => state.setIncome);
  
  const [salary, setSalary] = useState(income.salary > 0 ? income.salary.toString() : '');
  const [otherIncome, setOtherIncome] = useState(income.otherIncome > 0 ? income.otherIncome.toString() : '');

  const handleContinue = () => {
    setIncome({
      salary: parseFloat(salary) || 0,
      otherIncome: parseFloat(otherIncome) || 0,
    });
    router.push('/onboarding/assets');
  };

  const handleSkip = () => {
    router.push('/onboarding/assets');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.container}>
      <Text style={styles.progress}>Step 1 of 3</Text>
      
      <Text style={styles.title}>What's your income?</Text>
      <Text style={styles.subtitle}>Your active income (salary, wages, etc.)</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Annual Salary</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={salary}
            onChangeText={setSalary}
          />
        </View>

        <Text style={styles.label}>Other Annual Income (optional)</Text>
        <Text style={styles.helperText}>Side gigs, consulting, etc.</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#666"
            keyboardType="numeric"
            value={otherIncome}
            onChangeText={setOtherIncome}
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your asset income (crypto yields, dividends) will be calculated automatically from your connected wallets.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
      </View>
      </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    padding: 20,
  },
  progress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    // marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4c430',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 40,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    marginTop: 20,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  currencySymbol: {
    fontSize: 20,
    color: '#f4c430',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#ffffff',
    paddingVertical: 16,
  },
  infoBox: {
    backgroundColor: '#1a1f2e',
    padding: 16,
    borderRadius: 12,
    marginTop: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#f4c430',
  },
  infoText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2f3e',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#a0a0a0',
  },
  button: {
    flex: 1,
    backgroundColor: '#f4c430',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a0e1a',
  },
});
