import { useState, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State'i initialize et
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Value setter fonksiyonu - functional updater ve useCallback ile güncel değer garantisi
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((current) => {
        const valueToStore = value instanceof Function ? value(current) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (e) {
          console.error(`Error setting localStorage key "${key}":`, e);
        }
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
