export type Language = 'English' | 'Danish' | 'German' | 'Spanish' | 'French' | 'Swedish' | 'Norwegian' | 'Dutch' | 'Belgian' | 'Hebrew';

/**
 * Normalize language setting - remove "global" or invalid values
 */
export const normalizeLanguage = (lang: any): Language => {
    if (!lang || lang === 'global' || lang === 'GLOBAL') return 'English';

    const validLanguages: Language[] = ['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew'];
    if (validLanguages.includes(lang as Language)) return lang as Language;

    // Extract language name from flag+name format (e.g., "🇩🇰 Danish (Dansk)" -> "Danish")
    if (typeof lang === 'string') {
        const match = lang.match(/([A-Z][a-z]+)/);
        if (match) {
            const extracted = match[1];
            if (validLanguages.includes(extracted as Language)) return extracted as Language;
        }
    }

    return 'English';
};

/**
 * Detect language from text content using keyword analysis
 * Returns the detected language or 'English' as default
 */
export const detectLanguageFromText = (text: string): Language => {
    if (!text || text.length === 0) return 'English';

    const lowerText = text.toLowerCase();

    // Check for special characters FIRST (most reliable)
    const hasHebrewChars = /[\u0590-\u05FF]/.test(text);
    if (hasHebrewChars) return 'Hebrew';

    const hasDanishChars = /[øåæ]/i.test(text);
    if (hasDanishChars) return 'Danish';

    const hasGermanChars = /[üöäß]/i.test(text);
    if (hasGermanChars) return 'German';

    const hasSpanishChars = /[áéíóúñ¿¡]/i.test(text);
    if (hasSpanishChars) return 'Spanish';

    const hasFrenchChars = /[éèêëàâôùûüçœæ]/i.test(text);
    if (hasFrenchChars) return 'French';

    const hasSwedishChars = /[åäö]/i.test(text);
    if (hasSwedishChars) return 'Swedish';

    const hasNorwegianChars = /[åæø]/i.test(text);
    if (hasNorwegianChars) return 'Norwegian';

    // Dutch check (mostly overlaps with special chars, but keyword based)

    // Language-specific keyword patterns for fallback
    const languagePatterns: Record<Language, RegExp[]> = {
        Danish: [
            /\b(og|der|det|en|til|i|fra|du|hvad|hvor|hvordan|hvornår|når|jeg|dig|han|hun|vi|i|mig|ham|hende|os|jer|dem|hvis|mens|fordi|så|også|dog|eller|men)\b/g,
            /ø|å|æ/g, // Special Danish characters
        ],
        German: [
            /\b(und|der|die|das|ein|eine|einen|dem|des|den|in|von|zu|mit|für|ist|haben|sein|nicht|das|werden|kann|könnte|mein|dein|sein|ihr|unser|euer)\b/g,
            /ü|ö|ä|ß/g, // Special German characters
        ],
        Spanish: [
            /\b(y|el|la|los|las|un|una|unos|unas|de|que|en|a|por|con|es|está|están|ser|estar|haber|tener|hacer|querer|decir|ir|venir|poder|deber|saber)\b/g,
            /á|é|í|ó|ú|ñ|¿|¡/g, // Spanish diacritics
        ],
        French: [
            /\b(et|le|la|les|un|une|des|de|d|qu|que|qui|où|comment|quand|quoi|quel|je|tu|il|elle|nous|vous|ils|elles|est|sont|avoir|être|pouvoir|vouloir|devoir|faire|aller|venir|savoir)\b/g,
            /é|è|ê|ë|à|ù|â|ô|ç|œ|æ/g, // French diacritics
        ],
        Swedish: [
            /\b(och|det|en|att|i|jag|hon|som|han|på|de|med|han|inte|då|sin|för|är|ha|från|du|nu|över|än|dig|kan|sina|här|ha|varit|hans|honom|skulle|hennes|där|min|man|ej|vid|kunde|något|från|utan|varit|hur|ingen|mitt|ni|bli|blev|oss|din|dessa|några|deras|varit|varit|varit)\b/g,
            /å|ä|ö/g, // Swedish diacritics
        ],
        Norwegian: [
            /\b(og|i|jeg|det|at|en|til|er|som|på|de|med|han|av|ikk|han|hvor|da|seg|då|seg|seg|får|har|han|honom|hans|hennes|henne|hennes|hans|sitt|hennes|vår|deres|min|min|hans|sin|sitt|sin|sine|hans|våre|mine|dine|deres)\b/g,
            /å|ä|ö|æ/g, // Norwegian diacritics
        ],
        Dutch: [
            /\b(en|de|het|een|van|is|dat|die|in|een|op|te|voor|met|als|zijn|worden|kan|hij|zij|daar|waar|wat|wie|hoe|wanneer|waarom|alle|geen|veel|alleen|ook|nog|noch)\b/g,
            /ij|ei|ou/g, // Dutch diphthongs
        ],
        Belgian: [
            /\b(en|de|het|een|van|is|dat|die|in|op|te|voor|met|als|zijn|worden|kan|hij|zij|daar|waar|wat|wie|hoe|wanneer|waarom|alle|geen|veel|alleen|ook|nog|noch)\b/g,
            /ij|ei|ou|ë|ü|ï/g,
        ],
        Hebrew: [
            /[\u0590-\u05FF]/g, // Hebrew Unicode range
        ],
        English: [
            /\b(the|and|a|an|or|is|are|was|were|be|been|am|have|has|had|do|does|did|will|would|could|should|may|might|must|can|cannot|not|no|yes|it|he|she|they|them|their|this|that|these|those|what|which|who|when|where|why|how|why|how|so|if|because|as|for|with|from|to|in|on|at|by|of|by)\b/g,
        ]
    };

    // Score each language based on keyword matches
    const scores: Record<Language, number> = {
        English: 0,
        Danish: 0,
        German: 0,
        Spanish: 0,
        French: 0,
        Swedish: 0,
        Norwegian: 0,
        Dutch: 0,
        Belgian: 0,
        Hebrew: 0,
    };

    for (const [language, patterns] of Object.entries(languagePatterns)) {
        for (const pattern of patterns) {
            const matches = (lowerText.match(pattern) || []).length;
            scores[language as Language] += matches;
        }
    }

    // Find language with highest score
    let detectedLanguage: Language = 'English';
    let maxScore = scores.English;

    for (const [language, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedLanguage = language as Language;
        }
    }

    // If score is too low, return English (likely English with unknown chars)
    if (maxScore < 3) return 'English';

    return detectedLanguage;
};

export const getFlag = (lang?: string): string => {
    if (!lang) return "🇬🇧";
    if (lang === 'Danish') return "🇩🇰";
    if (lang === 'German') return "🇩🇪";
    if (lang === 'Spanish') return "🇪🇸";
    if (lang === 'French') return "🇫🇷";
    if (lang === 'Swedish') return "🇸🇪";
    if (lang === 'Norwegian') return "🇳🇴";
    if (lang === 'Dutch') return "🇳🇱";
    if (lang === 'Belgian') return "🇧🇪";
    if (lang === 'Hebrew') return "🇮🇱";
    return "🇬🇧";
};

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  English: {
    welcomeTitle: "TeamAction",
    welcomeSubtitle: "by TeamBattle",
    systemReadiness: "SYSTEM READINESS",
    locationServices: "Location Services",
    cameraAccess: "Camera Access",
    microphoneAccess: "Microphone Access",
    storageAccess: "Local Storage",
    ready: "Ready",
    waiting: "Waiting...",
    accessDenied: "Access Denied",
    check: "Check",
    enable: "Enable",
    fix: "Fix",
    selectGame: "SELECT TODAY'S GAME",
    teamName: "TEAM NAME",
    enterTeamName: "Enter your team name...",
    startAdventure: "START ADVENTURE",
    scanJoin: "Scan to Join",
    noGames: "No games available nearby",
    waitingGps: "Waiting for GPS location...",
    // HUD
    score: "Score",
    progress: "Progress",
    nextTarget: "Next Target",
    complete: "Complete!",
    distance: "Distance",
    layer: "Layer",
    measure: "Measure",
    danger: "Danger",
    moveMap: "Move Map",
    locateMe: "Locate Me",
    edit: "Edit",
    instructor: "Instructor",
    team: "Team",
    lobby: "Lobby",
    chat: "Chat",
    gameSettings: "Game Settings",
    // Dashboard & Menus
    dashboard: "Dashboard",
    games: "Games",
    teams: "Teams",
    tasks: "Tasks",
    admin: "Admin",
    createGame: "Create New Game",
    editGame: "Edit Game",
    myTasklists: "My Tasklists",
    clientPortal: "Client Portal",
    qrCodes: "QR Codes",
    templates: "Templates",
    // Game Chooser
    gameSessions: "Game Sessions",
    selectMission: "Select or Create a Mission",
    searchGames: "Search Games...",
    searchTemplates: "Search Templates...",
    today: "Today",
    planned: "Planned",
    completed: "Completed",
    createNewSession: "Create New Game Session",
    // Results
    missionReport: "Mission Report",
    totalScore: "Total Score",
    successRate: "Success Rate",
    tasksDone: "Tasks Done",
    totalTasks: "Total Tasks",
    taskBreakdown: "Task Breakdown",
    // Permission Help
    permHelpTitle: "Permission Required",
    permHelpDesc: "To play TeamAction, we need access to your device sensors. Web browsers block this by default for your privacy.",
    permHelpInstruction: "Tap the lock icon 🔒 in your browser address bar (top of screen) and switch permissions to 'Allow' or 'Ask'.",
    permHelpButton: "I've enabled it",
  },
  Danish: {
    welcomeTitle: "TeamAction",
    welcomeSubtitle: "af TeamBattle",
    systemReadiness: "SYSTEM STATUS",
    locationServices: "Lokationstjenester",
    cameraAccess: "Kameraadgang",
    microphoneAccess: "Mikrofonadgang",
    storageAccess: "Lokal Lagring",
    ready: "Klar",
    waiting: "Venter...",
    accessDenied: "Adgang nægtet",
    check: "Tjek",
    enable: "Aktiver",
    fix: "Løs problemet",
    selectGame: "VÆLG DAGENS SPIL",
    teamName: "HOLDNAVN",
    enterTeamName: "Indtast holdnavn...",
    startAdventure: "START EVENTYR",
    scanJoin: "Scan for at deltage",
    noGames: "Ingen spil i nærheden",
    waitingGps: "Venter på GPS...",
    // HUD
    score: "Point",
    progress: "Fremskridt",
    nextTarget: "Næste Mål",
    complete: "Færdig!",
    distance: "Afstand",
    layer: "Kort",
    measure: "Mål",
    danger: "Fare",
    moveMap: "Flyt Kort",
    locateMe: "Find Mig",
    edit: "Rediger",
    instructor: "Instruktør",
    team: "Hold",
    lobby: "Lobby",
    chat: "Chat",
    gameSettings: "Spilindstillinger",
    // Dashboard & Menus
    dashboard: "Betjeningspanel",
    games: "Spil",
    teams: "Hold",
    tasks: "Opgaver",
    admin: "Admin",
    createGame: "Opret Nyt Spil",
    editGame: "Rediger Spil",
    myTasklists: "Mine Opgavelister",
    clientPortal: "Kunde Portal",
    qrCodes: "QR Koder",
    templates: "Skabeloner",
    // Game Chooser
    gameSessions: "Spil Sessioner",
    selectMission: "Vælg eller Opret Mission",
    searchGames: "Søg Spil...",
    searchTemplates: "Søg Skabeloner...",
    today: "I Dag",
    planned: "Planlagt",
    completed: "Færdige",
    createNewSession: "Opret Ny Spil Session",
    // Results
    missionReport: "Mission Rapport",
    totalScore: "Samlet Score",
    successRate: "Succesrate",
    tasksDone: "Opgaver Udført",
    totalTasks: "Totale Opgaver",
    taskBreakdown: "Opgave Oversigt",
    // Permission Help
    permHelpTitle: "Tilladelse Påkrævet",
    permHelpDesc: "For at spille TeamAction skal vi bruge adgang til dine enhedssensorer. Browsere blokerer dette som standard.",
    permHelpInstruction: "Tryk på låseikonet 🔒 i din browsers adresselinje (toppen af skærmen) og skift tilladelser til 'Tillad'.",
    permHelpButton: "Jeg har aktiveret det",
  },
  German: {
    welcomeTitle: "TeamAction",
    welcomeSubtitle: "von TeamBattle",
    systemReadiness: "SYSTEMBEREITSCHAFT",
    locationServices: "Ortungsdienste",
    cameraAccess: "Kamerazugriff",
    microphoneAccess: "Mikrofonzugriff",
    storageAccess: "Lokaler Speicher",
    ready: "Bereit",
    waiting: "Warten...",
    accessDenied: "Zugriff verweigert",
    check: "Prüfen",
    enable: "Aktivieren",
    fix: "Beheben",
    selectGame: "WÄHLE DAS HEUTIGE SPIEL",
    teamName: "TEAMNAME",
    enterTeamName: "Teamnamen eingeben...",
    startAdventure: "ABENTEUER STARTEN",
    scanJoin: "Scannen zum Beitreten",
    noGames: "Keine Spiele in der Nähe",
    waitingGps: "Warte auf GPS...",
    score: "Punktzahl",
    progress: "Fortschritt",
    nextTarget: "Nächstes Ziel",
    complete: "Fertig!",
    distance: "Entfernung",
    layer: "Ebene",
    measure: "Messen",
    danger: "Gefahr",
    moveMap: "Karte Bewegen",
    locateMe: "Orten",
    edit: "Bearbeiten",
    instructor: "Instruktor",
    team: "Team",
    lobby: "Lobby",
    chat: "Chat",
    gameSettings: "Spieleinstellungen",
    // Dashboard
    dashboard: "Armaturenbrett",
    games: "Spiele",
    teams: "Teams",
    tasks: "Aufgaben",
    admin: "Admin",
    createGame: "Neues Spiel",
    editGame: "Spiel Bearbeiten",
    myTasklists: "Meine Aufgabenlisten",
    clientPortal: "Kundenportal",
    qrCodes: "QR-Codes",
    templates: "Vorlagen",
    // Game Chooser
    gameSessions: "Spielsitzungen",
    selectMission: "Mission Wählen",
    searchGames: "Spiele suchen...",
    searchTemplates: "Vorlagen suchen...",
    today: "Heute",
    planned: "Geplant",
    completed: "Abgeschlossen",
    createNewSession: "Neue Sitzung Erstellen",
    // Results
    missionReport: "Missionsbericht",
    totalScore: "Gesamtpunktzahl",
    successRate: "Erfolgsrate",
    tasksDone: "Erledigte Aufgaben",
    totalTasks: "Gesamtaufgaben",
    taskBreakdown: "Aufgabenübersicht",
    permHelpTitle: "Erlaubnis Erforderlich",
    permHelpDesc: "Um TeamAction zu spielen, benötigen wir Zugriff auf Ihre Gerätesensoren.",
    permHelpInstruction: "Tippen Sie auf das Schloss-Symbol 🔒 in der Adressleiste Ihres Browsers und ändern Sie die Berechtigungen auf 'Zulassen'.",
    permHelpButton: "Ich habe es aktiviert",
  },
  Spanish: {
    welcomeTitle: "TeamAction",
    welcomeSubtitle: "por TeamBattle",
    systemReadiness: "ESTADO DEL SISTEMA",
    locationServices: "Servicios de Ubicación",
    cameraAccess: "Acceso a Cámara",
    microphoneAccess: "Acceso a Micrófono",
    storageAccess: "Almacenamiento Local",
    ready: "Listo",
    waiting: "Esperando...",
    accessDenied: "Acceso Denegado",
    check: "Comprobar",
    enable: "Habilitar",
    fix: "Arreglar",
    selectGame: "SELECCIONAR JUEGO DE HOY",
    teamName: "NOMBRE DEL EQUIPO",
    enterTeamName: "Introduce nombre del equipo...",
    startAdventure: "EMPEZAR AVENTURA",
    scanJoin: "Escanear para unirse",
    noGames: "No hay juegos cerca",
    waitingGps: "Esperando GPS...",
    score: "Puntuación",
    progress: "Progreso",
    nextTarget: "Siguiente Objetivo",
    complete: "¡Completado!",
    distance: "Distancia",
    layer: "Capa",
    measure: "Medir",
    danger: "Peligro",
    moveMap: "Mover Mapa",
    locateMe: "Localizarme",
    edit: "Editar",
    instructor: "Instructor",
    team: "Equipo",
    lobby: "Vestíbulo",
    chat: "Chat",
    gameSettings: "Ajustes del Juego",
    // Dashboard
    dashboard: "Tablero",
    games: "Juegos",
    teams: "Equipos",
    tasks: "Tareas",
    admin: "Admin",
    createGame: "Crear Juego",
    editGame: "Editar Juego",
    myTasklists: "Mis Listas",
    clientPortal: "Portal Cliente",
    qrCodes: "Códigos QR",
    templates: "Plantillas",
    // Game Chooser
    gameSessions: "Sesiones de Juego",
    selectMission: "Seleccionar Misión",
    searchGames: "Buscar Juegos...",
    searchTemplates: "Buscar Plantillas...",
    today: "Hoy",
    planned: "Planeado",
    completed: "Completado",
    createNewSession: "Crear Nueva Sesión",
    // Results
    missionReport: "Informe de Misión",
    totalScore: "Puntuación Total",
    successRate: "Tasa de Éxito",
    tasksDone: "Tareas Realizadas",
    totalTasks: "Tareas Totales",
    taskBreakdown: "Desglose de Tareas",
    permHelpTitle: "Permiso Necesario",
    permHelpDesc: "Para jugar TeamAction, necesitamos acceso a los sensores de tu dispositivo.",
    permHelpInstruction: "Toca el icono de candado 🔒 en la barra de direcciones de tu navegador y cambia los permisos a 'Permitir'.",
    permHelpButton: "Lo he activado",
  },
  French: {},
  Swedish: {},
  Norwegian: {},
  Dutch: {},
  Belgian: {},
  Hebrew: {}
};

export const t = (key: string, lang: Language): string => {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['English'][key] || key;
};
