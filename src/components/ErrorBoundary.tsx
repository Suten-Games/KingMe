// src/components/ErrorBoundary.tsx
// Catches React render errors and shows the error message on screen
// instead of silently crashing to the splash screen.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.title}>{this.props.fallbackTitle || 'Something went wrong'}</Text>
          <ScrollView style={s.scroll}>
            <Text style={s.error}>{this.state.error?.message || 'Unknown error'}</Text>
            <Text style={s.stack}>{this.state.error?.stack?.slice(0, 800)}</Text>
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f87171',
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  error: {
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '600',
    marginBottom: 8,
  },
  stack: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#f4c430',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#0a0e1a',
    fontSize: 16,
    fontWeight: '700',
  },
});
