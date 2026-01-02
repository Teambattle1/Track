import { Game, GamePoint, Language, TaskTranslation } from '../types';

/**
 * Check if a specific field in a translation is approved
 */
const isFieldApproved = (translation: TaskTranslation, field: keyof TaskTranslation): boolean => {
  // If the field doesn't exist, consider it approved (not applicable)
  if (translation[field] === undefined || translation[field] === null) {
    return true;
  }

  // Check the corresponding approval field
  const approvalField = `${field}Approved` as keyof TaskTranslation;
  
  // If approval field doesn't exist or is undefined, consider NOT approved (default for AI translations)
  if (translation[approvalField] === undefined) {
    return false;
  }

  return translation[approvalField] as boolean;
};

/**
 * Check if all fields in a translation are approved
 */
export const isTranslationFullyApproved = (translation: TaskTranslation): boolean => {
  // Question is always required and must be explicitly approved
  if (translation.questionApproved !== true) {
    return false;
  }

  const checks = [
    translation.options ? (translation.optionsApproved === true) : true,
    translation.answer ? (translation.answerApproved === true) : true,
    translation.correctAnswers ? (translation.correctAnswersApproved === true) : true,
    translation.placeholder ? (translation.placeholderApproved === true) : true,
  ];

  // Check feedback fields if feedback exists
  if (translation.feedback) {
    // Check correct message
    if (translation.feedback.correctMessage) {
      checks.push(translation.feedback.correctMessageApproved === true);
    }
    // Check incorrect message
    if (translation.feedback.incorrectMessage) {
      checks.push(translation.feedback.incorrectMessageApproved === true);
    }
    // Check hint
    if (translation.feedback.hint) {
      checks.push(translation.feedback.hintApproved === true);
    }
  }

  // All checks must pass
  return checks.every(check => check === true);
};

/**
 * Check if all tasks in a game have approved translations for a specific language
 */
export const isLanguageFullyApprovedForGame = (game: Game, language: Language): boolean => {
  const points = game.points || [];

  // If no points, language is technically "approved" (nothing to translate)
  if (points.length === 0) {
    return true;
  }

  // Check each point
  for (const point of points) {
    const translation = point.task.translations?.[language];

    // If translation doesn't exist for this language, it's not approved
    if (!translation) {
      return false;
    }

    // If translation exists but is not fully approved, language is not ready
    if (!isTranslationFullyApproved(translation)) {
      return false;
    }
  }

  // All tasks have approved translations for this language
  return true;
};

/**
 * Get all languages that are configured/used in a game
 * This includes the game's primary language and any languages that have translations
 */
export const getConfiguredLanguagesForGame = (game: Game): Language[] => {
  const languages = new Set<Language>();

  // Add game's primary language if set
  if (game.language) {
    languages.add(game.language as Language);
  }

  // Add any languages that have translations in the game's tasks
  game.points?.forEach(point => {
    if (point.task.translations) {
      Object.keys(point.task.translations).forEach(lang => {
        languages.add(lang as Language);
      });
    }
  });

  return Array.from(languages);
};

/**
 * Get all available languages that are fully approved for a game
 */
export const getApprovedLanguagesForGame = (game: Game): Language[] => {
  const allLanguages: Language[] = [
    'English',
    'Danish',
    'German',
    'Spanish',
    'French',
    'Swedish',
    'Norwegian',
    'Dutch',
    'Belgian',
    'Hebrew',
  ];

  return allLanguages.filter(language => {
    // Check if this language is used in at least one task
    const hasTranslations = game.points?.some(
      point => point.task.translations?.[language]
    );

    // If no translations exist, don't include this language
    if (!hasTranslations && language !== 'English') {
      return false;
    }

    // For English (default language), always include
    if (language === 'English') {
      return true;
    }

    // Check if all translations are approved
    return isLanguageFullyApprovedForGame(game, language);
  });
};

/**
 * Get missing translations for a game (for admin/system tools)
 */
export interface MissingTranslation {
  gameId: string;
  gameName: string;
  pointId: string;
  pointTitle: string;
  language: Language;
  missingFields: string[];
}

export const getMissingTranslationsForGame = (game: Game): MissingTranslation[] => {
  const missing: MissingTranslation[] = [];
  const points = game.points || [];

  // Get all languages that have at least one translation in the game
  const usedLanguages = new Set<Language>();
  points.forEach(point => {
    if (point.task.translations) {
      Object.keys(point.task.translations).forEach(lang => {
        usedLanguages.add(lang as Language);
      });
    }
  });

  // Check each point for each used language
  points.forEach(point => {
    usedLanguages.forEach(language => {
      const translation = point.task.translations?.[language];

      // If translation doesn't exist, add to missing
      if (!translation) {
        missing.push({
          gameId: game.id,
          gameName: game.name,
          pointId: point.id,
          pointTitle: point.title,
          language,
          missingFields: ['ALL'],
        });
        return;
      }

      // Check which fields are not approved
      const missingFields: string[] = [];
      
      if (!isFieldApproved(translation, 'question')) {
        missingFields.push('question');
      }
      if (translation.options && !isFieldApproved(translation, 'options')) {
        missingFields.push('options');
      }
      if (translation.answer && !isFieldApproved(translation, 'answer')) {
        missingFields.push('answer');
      }
      if (translation.correctAnswers && !isFieldApproved(translation, 'correctAnswers')) {
        missingFields.push('correctAnswers');
      }
      if (translation.feedback) {
        if (translation.feedback.correctMessage && !isFieldApproved(translation as any, 'correctMessage')) {
          missingFields.push('correctMessage');
        }
        if (translation.feedback.incorrectMessage && !isFieldApproved(translation as any, 'incorrectMessage')) {
          missingFields.push('incorrectMessage');
        }
        if (translation.feedback.hint && !isFieldApproved(translation as any, 'hint')) {
          missingFields.push('hint');
        }
      }

      if (missingFields.length > 0) {
        missing.push({
          gameId: game.id,
          gameName: game.name,
          pointId: point.id,
          pointTitle: point.title,
          language,
          missingFields,
        });
      }
    });
  });

  return missing;
};

/**
 * Get all missing translations across all games (for system-wide validation)
 */
export const getAllMissingTranslations = (games: Game[]): MissingTranslation[] => {
  const allMissing: MissingTranslation[] = [];

  games.forEach(game => {
    const gameMissing = getMissingTranslationsForGame(game);
    allMissing.push(...gameMissing);
  });

  return allMissing;
};

/**
 * Check if a task has complete and approved translations for required languages
 * Returns { valid: boolean, missingLanguages: Language[] }
 */
export const validateTaskTranslations = (
  task: { translations?: Record<Language, any> },
  requiredLanguages: Language[]
): { valid: boolean; missingLanguages: Language[] } => {
  const missingLanguages: Language[] = [];

  requiredLanguages.forEach(language => {
    // Skip English as it's the default language (always in the base task)
    if (language === 'English') {
      return;
    }

    const translation = task.translations?.[language];

    // If translation doesn't exist for this language
    if (!translation) {
      missingLanguages.push(language);
      return;
    }

    // Check if translation is fully approved
    if (!isTranslationFullyApproved(translation)) {
      missingLanguages.push(language);
    }
  });

  return {
    valid: missingLanguages.length === 0,
    missingLanguages,
  };
};
