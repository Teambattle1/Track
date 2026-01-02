/**
 * Calculate Levenshtein distance between two strings
 * Returns the number of single-character edits required to change one string into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create a 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;
    
    // Fill the dp table
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,     // deletion
                    dp[i][j - 1] + 1,     // insertion
                    dp[i - 1][j - 1] + 1  // substitution
                );
            }
        }
    }
    
    return dp[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * Returns a value from 0 to 100, where 100 is exact match
 */
export function stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (str1.length === 0 && str2.length === 0) return 100;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    return Math.max(0, Math.min(100, similarity));
}

/**
 * Check if an answer matches the correct answer with configurable tolerance
 * @param userAnswer - The user's submitted answer
 * @param correctAnswer - The correct answer
 * @param tolerance - Similarity threshold (0-100), default 80
 * @param caseSensitive - Whether to consider case, default false
 * @returns true if the answer is acceptable
 */
export function isAnswerAcceptable(
    userAnswer: string,
    correctAnswer: string,
    tolerance: number = 80,
    caseSensitive: boolean = false
): boolean {
    // Normalize answers
    let userNorm = userAnswer.trim();
    let correctNorm = correctAnswer.trim();
    
    if (!caseSensitive) {
        userNorm = userNorm.toLowerCase();
        correctNorm = correctNorm.toLowerCase();
    }
    
    // Exact match
    if (userNorm === correctNorm) return true;
    
    // If tolerance is 100, require exact match
    if (tolerance >= 100) return userNorm === correctNorm;
    
    // Calculate similarity
    const similarity = stringSimilarity(userNorm, correctNorm);
    
    return similarity >= tolerance;
}

/**
 * Get translation for attempt messages based on language
 */
export function getAttemptMessage(language: string, attemptsRemaining: number): string {
    const messages: Record<string, (n: number) => string> = {
        'Danish': (n: number) => n > 0 ? `PRØV IGEN - ${n} FORSØG tilbage` : 'INGEN FORSØG tilbage',
        'English': (n: number) => n > 0 ? `TRY AGAIN - ${n} attempt${n !== 1 ? 's' : ''} remaining` : 'No attempts remaining',
        'German': (n: number) => n > 0 ? `ERNEUT VERSUCHEN - ${n} Versuch${n !== 1 ? 'e' : ''} übrig` : 'Keine Versuche mehr',
        'Spanish': (n: number) => n > 0 ? `INTENTAR DE NUEVO - ${n} intento${n !== 1 ? 's' : ''} restante${n !== 1 ? 's' : ''}` : 'No quedan intentos',
        'French': (n: number) => n > 0 ? `RÉESSAYER - ${n} tentative${n !== 1 ? 's' : ''} restante${n !== 1 ? 's' : ''}` : 'Aucune tentative restante',
        'Swedish': (n: number) => n > 0 ? `FÖRSÖK IGEN - ${n} försök kvar` : 'Inga försök kvar',
        'Norwegian': (n: number) => n > 0 ? `PRØV IGJEN - ${n} forsøk igjen` : 'Ingen forsøk igjen',
        'Dutch': (n: number) => n > 0 ? `PROBEER OPNIEUW - ${n} poging${n !== 1 ? 'en' : ''} over` : 'Geen pogingen meer',
        'Belgian': (n: number) => n > 0 ? `PROBEER OPNIEUW - ${n} poging${n !== 1 ? 'en' : ''} over` : 'Geen pogingen meer',
        'Hebrew': (n: number) => n > 0 ? `נסה שוב - ${n} ניסיונות נותרו` : 'אין ניסיונות נותרים',
    };
    
    const messageFn = messages[language] || messages['English'];
    return messageFn(attemptsRemaining);
}
