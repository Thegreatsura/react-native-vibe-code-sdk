import { useState, useEffect } from 'react';

/**
 * Custom hook to persist state in localStorage
 * @param key - The localStorage key
 * @param initialValue - The initial value if no stored value exists
 * @returns [storedValue, setValue] - Similar to useState
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Get initial value from localStorage or use initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Sync state with localStorage on mount (handles SSR hydration mismatch)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        setStoredValue(parsed);
      }
    } catch (error) {
      // ignore
    }
  }, [key]);

  // Update localStorage when state changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function for same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
