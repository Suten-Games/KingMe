// app/onboarding/income.tsx
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../../src/store/useStore';
import { S, T } from '../../src/styles/onboarding';

export default function IncomeScreen() {
  const router = useRouter();
  const income = useStore((state) => state.income);
  const setIncome = useStore((state) => state.setIncome);

  const [salary, setSalary] = useState(income.salary > 0 ? income.salary.toString() : '');
  const [otherIncome, setOtherIncome] = useState(income.otherIncome > 0 ? income.otherIncome.toString() : '');

  const handleContinue = () => {
    setIncome({ salary: parseFloat(salary) || 0, otherIncome: parseFloat(otherIncome) || 0 });
    router.push('/onboarding/assets');
  };
  const handleSkip = () => router.push('/onboarding/assets');

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={S.page}>
        <Text style={S.progress}>Step 1 of 3</Text>
        <Text style={S.title}>What's your income?</Text>
        <Text style={S.subtitle}>Your active income (salary, wages, etc.)</Text>

        <View style={{ flex: 1 }}>
          <Text style={S.label}>Annual Salary</Text>
          <View style={S.inputContainer}>
            <Text style={S.currencySymbol}>$</Text>
            <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
              keyboardType="numeric" value={salary} onChangeText={setSalary} />
          </View>

          <Text style={S.label}>Other Annual Income (optional)</Text>
          <Text style={S.helperText}>Side gigs, consulting, etc.</Text>
          <View style={S.inputContainer}>
            <Text style={S.currencySymbol}>$</Text>
            <TextInput style={S.input} placeholder="0" placeholderTextColor={T.textDim}
              keyboardType="numeric" value={otherIncome} onChangeText={setOtherIncome} />
          </View>

          <View style={[S.infoBox, { marginTop: 30 }]}>
            <Text style={S.infoText}>
              💡 Your asset income (crypto yields, dividends) will be calculated automatically from your connected wallets.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={S.skipButton} onPress={handleSkip}>
            <Text style={S.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.button} onPress={handleContinue}>
            <Text style={S.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
