import { useState, useEffect, useRef, useCallback } from 'react';

interface UseNumberInputReturn {
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const useNumberInput = (
  initialValue: number | undefined | null,
  onSave: (value: number) => void,
  debounceDelay: number = 800
): UseNumberInputReturn => {
  const [localValue, setLocalValue] = useState<number>(initialValue || 0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<number>(initialValue || 0);

  useEffect(() => {
    const newValue = initialValue || 0;
    if (newValue !== lastSavedValueRef.current) {
      setLocalValue(newValue);
      lastSavedValueRef.current = newValue;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === '' || value === '-') {
      setLocalValue(0);
    } else {
      const numValue = Number(value);
      setLocalValue(isNaN(numValue) ? 0 : numValue);
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const sanitizedValue = value === '' || value === '-' ? 0 : Number(value);
      const finalValue = isNaN(sanitizedValue) ? 0 : sanitizedValue;

      if (finalValue !== lastSavedValueRef.current) {
        lastSavedValueRef.current = finalValue;
        onSave(finalValue);
      }
    }, debounceDelay);
  }, [debounceDelay, onSave]);

  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (localValue !== lastSavedValueRef.current) {
      lastSavedValueRef.current = localValue;
      onSave(localValue);
    }
  }, [localValue, onSave]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  return {
    value: localValue || '',
    onChange: handleChange,
    onBlur: handleBlur,
    onFocus: handleFocus,
  };
};
