// app/components/CollapsibleSection.tsx - Simple collapsible wrapper
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect, ReactNode } from 'react';
import { useStore } from '../../src/store/useStore';

interface CollapsibleSectionProps {
  title: string;
  total: string; // e.g., "$8,654/mo"
  totalColor?: string; // Color for the total
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  total,
  totalColor = '#4ade80',
  children,
}: CollapsibleSectionProps) {
  const defaultExpanded = useStore((s) => s.settings?.defaultExpandAssetSections ?? false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>
          <Text style={[styles.total, { color: totalColor }]}>{total}</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  total: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    backgroundColor: '#141825',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    paddingTop: 12,
  },
});
