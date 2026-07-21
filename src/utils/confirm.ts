import { Alert, Platform } from 'react-native';

/**
 * Confirmação cross-platform. No React Native Web o Alert.alert NÃO dispara os
 * botões/callbacks — por isso usamos window.confirm na web e Alert.alert no native.
 */
export function confirmar(titulo: string, mensagem: string, textoConfirmar = 'Remover'): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm(`${titulo}\n\n${mensagem}`);
    return Promise.resolve(!!ok);
  }
  return new Promise(resolve => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoConfirmar, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
