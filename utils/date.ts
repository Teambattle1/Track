import { Language } from '../types';

/**
 * Map game Language to BCP-47 locale codes for date/time formatting
 * Reference: https://www.techonthenet.com/js/language_tags.php
 */
export const getLocaleFromLanguage = (language: Language): string => {
    const localeMap: Record<Language, string> = {
        'English': 'en-GB',
        'Danish': 'da-DK',
        'German': 'de-DE',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'Swedish': 'sv-SE',
        'Norwegian': 'nb-NO',
        'Dutch': 'nl-NL',
        'Belgian': 'nl-BE',
        'Hebrew': 'he-IL'
    };

    return localeMap[language] || 'en-GB';
};

/**
 * Format a date according to the game's language
 * Danish example: 31.12.2024
 * English example: 31 Dec 2024
 */
export const formatDate = (
    date: Date | number | string,
    language: Language = 'English',
    options?: Intl.DateTimeFormatOptions
): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const locale = getLocaleFromLanguage(language);

    // Default options if not provided
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };

    return dateObj.toLocaleDateString(locale, options || defaultOptions);
};

/**
 * Format a time according to the game's language
 * Danish example: 14:30:00 (HH:mm:ss)
 * English example: 14:30:00 (HH:mm:ss)
 */
export const formatTime = (
    date: Date | number | string,
    language: Language = 'English',
    options?: Intl.DateTimeFormatOptions
): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const locale = getLocaleFromLanguage(language);

    // Default options if not provided - use 24-hour format
    const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    return dateObj.toLocaleTimeString(locale, options || defaultOptions);
};

/**
 * Format both date and time according to the game's language
 * Danish example: 31.12.2024, 14:30:00
 * English example: 31/12/2024, 14:30:00
 */
export const formatDateTime = (
    date: Date | number | string,
    language: Language = 'English',
    options?: Intl.DateTimeFormatOptions
): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const locale = getLocaleFromLanguage(language);

    // Default options for full date/time
    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    return dateObj.toLocaleString(locale, options || defaultOptions);
};

/**
 * Format date for display in UI (shorter format)
 * Danish example: 31. dec. 2024
 * English example: 31 Dec 2024
 */
export const formatDateShort = (
    date: Date | number | string,
    language: Language = 'English'
): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const locale = getLocaleFromLanguage(language);

    return dateObj.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

/**
 * Format time without seconds for UI display
 * Example: 14:30
 */
export const formatTimeShort = (
    date: Date | number | string,
    language: Language = 'English'
): string => {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const locale = getLocaleFromLanguage(language);

    return dateObj.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Get date/time format pattern for the language (for documentation/help text)
 */
export const getDateTimeFormat = (language: Language): { date: string; time: string; dateTime: string } => {
    const formats: Record<Language, { date: string; time: string; dateTime: string }> = {
        'English': { date: 'DD/MM/YYYY', time: 'HH:mm:ss', dateTime: 'DD/MM/YYYY HH:mm:ss' },
        'Danish': { date: 'DD.MM.YYYY', time: 'HH:mm:ss', dateTime: 'DD.MM.YYYY HH:mm:ss' },
        'German': { date: 'DD.MM.YYYY', time: 'HH:mm:ss', dateTime: 'DD.MM.YYYY HH:mm:ss' },
        'Spanish': { date: 'DD/MM/YYYY', time: 'HH:mm:ss', dateTime: 'DD/MM/YYYY HH:mm:ss' },
        'French': { date: 'DD/MM/YYYY', time: 'HH:mm:ss', dateTime: 'DD/MM/YYYY HH:mm:ss' },
        'Swedish': { date: 'YYYY-MM-DD', time: 'HH:mm:ss', dateTime: 'YYYY-MM-DD HH:mm:ss' },
        'Norwegian': { date: 'DD.MM.YYYY', time: 'HH:mm:ss', dateTime: 'DD.MM.YYYY HH:mm:ss' },
        'Dutch': { date: 'DD-MM-YYYY', time: 'HH:mm:ss', dateTime: 'DD-MM-YYYY HH:mm:ss' },
        'Belgian': { date: 'DD/MM/YYYY', time: 'HH:mm:ss', dateTime: 'DD/MM/YYYY HH:mm:ss' },
        'Hebrew': { date: 'DD.MM.YYYY', time: 'HH:mm:ss', dateTime: 'DD.MM.YYYY HH:mm:ss' }
    };

    return formats[language] || formats['English'];
};
