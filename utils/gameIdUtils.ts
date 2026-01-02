/**
 * Generate a consistent 3-digit game ID from a game UUID
 * This creates a deterministic ID so the same game always has the same display ID
 * 
 * @param gameId - The game's UUID
 * @returns A string representing a 3-digit ID (001-999)
 */
export const getGameDisplayId = (gameId: string): string => {
  // Use first 8 characters of UUID to create a consistent number
  const hexString = gameId.replace(/[^0-9a-f]/gi, '').substring(0, 8);
  
  // Convert to number and modulo 1000 to get 0-999 range
  const hash = parseInt(hexString || '0', 16) % 1000;
  
  // Pad with leading zeros to always get 3 digits
  return String(hash).padStart(3, '0');
};

/**
 * Format game name with display ID
 * @param gameName - The game name
 * @param gameId - The game UUID
 * @returns Formatted string like "[001] Game Name"
 */
export const formatGameNameWithId = (gameName: string, gameId: string): string => {
  const displayId = getGameDisplayId(gameId);
  return `[${displayId}] ${gameName}`;
};

/**
 * Check if a game matches a search query (by ID or name)
 * @param gameName - The game name
 * @param gameId - The game UUID
 * @param query - The search query
 * @returns True if the game matches the query
 */
export const matchesGameSearch = (gameName: string, gameId: string, query: string): boolean => {
  if (!query.trim()) return true;
  
  const lowerQuery = query.toLowerCase().trim();
  const displayId = getGameDisplayId(gameId);
  
  // Match by display ID (with or without brackets)
  if (displayId.includes(lowerQuery) || `[${displayId}]`.includes(lowerQuery)) {
    return true;
  }
  
  // Match by game name
  if (gameName.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  return false;
};
