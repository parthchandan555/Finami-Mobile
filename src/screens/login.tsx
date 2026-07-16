import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { useAuth } from '@/context/auth';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const dark = useColorScheme() === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
  };

  const bg = dark ? '#080808' : '#FFFFFF';
  const fg = dark ? '#FFFFFF' : '#0A0A0A';
  const field = dark ? '#121212' : '#F2F2F7';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.box}>
        <Text style={[styles.title, { color: fg }]}>Finamize</Text>
        <Text style={[styles.sub, { color: fg }]}>Sign in to continue</Text>
        <TextInput
          style={[styles.input, { backgroundColor: field, color: fg }]}
          placeholder="Email"
          placeholderTextColor={dark ? '#FFFFFF' : '#0A0A0A'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { backgroundColor: field, color: fg }]}
          placeholder="Password"
          placeholderTextColor={dark ? '#FFFFFF' : '#0A0A0A'}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  box: { paddingHorizontal: 28, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { color: '#FF453A', fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
