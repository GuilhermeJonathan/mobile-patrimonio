import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function EmBreveScreen({ titulo, descricao }: { titulo: string; descricao: string }) {
  const { colors } = useTheme();
  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <Text style={st.icone}>🚧</Text>
      <Text style={[st.titulo, { color: colors.text }]}>{titulo}</Text>
      <Text style={[st.desc, { color: colors.textSecondary }]}>{descricao}</Text>
      <View style={[st.badge, { backgroundColor: colors.greenDim }]}>
        <Text style={[st.badgeText, { color: colors.green }]}>Em desenvolvimento</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icone: { fontSize: 48, marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 420 },
  badge: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16, marginTop: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
