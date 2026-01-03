/**
 * Replaces placeholder variables in task text
 * Supports:
 * - ${TEAM_NAME}: The name of the playing team
 */

export function replacePlaceholders(text: string, teamName?: string): string {
  if (!text) return text;
  
  let result = text;
  
  if (teamName) {
    result = result.replace(/\$\{TEAM_NAME\}/g, teamName);
  }
  
  return result;
}

export function hasTeamNamePlaceholder(text: string): boolean {
  return /\$\{TEAM_NAME\}/.test(text);
}

/**
 * Extracts all placeholders used in text
 */
export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\$\{[A-Z_]+\}/g);
  return matches ? [...new Set(matches)] : [];
}
