import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
    }
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch {}
      return;
    }
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch {}
      return;
    }
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};
