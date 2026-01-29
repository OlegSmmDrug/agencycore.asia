export const saveToStorage = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

export const loadFromStorage = <T>(key: string, fallback: T): T => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return fallback;
        return JSON.parse(saved) as T;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return fallback;
    }
};

export const removeFromStorage = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error removing from localStorage:', error);
    }
};
