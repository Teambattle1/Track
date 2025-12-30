export interface Feature {
    name: string;
    description: string;
    icon?: string;
}

export interface FeatureCategory {
    title: string;
    description: string;
    features: Feature[];
}

export const FEATURE_CATALOG: FeatureCategory[] = [
    {
        title: "TASKS & QUESTIONS",
        description: "Create, manage, and distribute tasks to players",
        features: [
            { name: "Task Creation", description: "Create custom tasks with multiple question types: text, multiple choice, checkbox, boolean, slider, dropdown, and more" },
            { name: "Task Library", description: "Access a global library of pre-made tasks organized by language and tags" },
            { name: "AI Task Generator", description: "Generate tasks automatically using AI based on keywords and topics" },
            { name: "Bulk Task Management", description: "Select and manage multiple tasks at once with bulk actions" },
            { name: "Task Templates", description: "Save task configurations as reusable templates for future games" },
            { name: "Language Support", description: "Create tasks in multiple languages (English, Danish, German, Spanish, French, Swedish, Norwegian, Dutch, Belgian, Hebrew)" },
            { name: "Task Scoring", description: "Assign points and scoring rules to individual tasks" },
            { name: "Task Order", description: "Set the sequence and priority of tasks in a game" },
            { name: "Rich Text Editing", description: "Format task questions and answers with rich text formatting" },
        ]
    },
    {
        title: "TASK LISTS & ORGANIZATION",
        description: "Organize tasks into reusable lists",
        features: [
            { name: "Create Task Lists", description: "Group related tasks into collections for easy management" },
            { name: "Task List Templates", description: "Save task lists as templates for reuse across multiple games" },
            { name: "Add from Library", description: "Quickly add tasks from the library to any task list" },
            { name: "Duplicate Prevention", description: "Automatic detection and prevention of duplicate tasks in lists" },
            { name: "List Metadata", description: "Add names, descriptions, cover images, and tags to task lists" },
            { name: "Import/Export Lists", description: "Share and backup task lists with team members" },
            { name: "List Statistics", description: "View task count and usage statistics for each list" },
        ]
    },
    {
        title: "PLAYGROUNDS & ZONES",
        description: "Define game play areas and zones on maps",
        features: [
            { name: "Create Playgrounds", description: "Define custom play areas with names and configurations" },
            { name: "Zone Management", description: "Create multiple zones within a playground" },
            { name: "Zone Icons", description: "Choose from 11 built-in icons (location, star, flag, trophy, camera, question, skull, treasure, music, nature, world)" },
            { name: "Custom Zone Icons", description: "Upload custom images or generate icons with AI" },
            { name: "Zone Background Images", description: "Add background images to zones" },
            { name: "AI Background Generator", description: "Generate background images automatically using AI" },
            { name: "Background Styling", description: "Control background fit (contain, cover, stretch)" },
            { name: "Zone Sizing", description: "Adjust zone button sizes (40-120px)" },
            { name: "Background Toggle", description: "Show/hide background images in the editor" },
            { name: "Snap to Road", description: "Automatically align tasks to actual road networks using Mapbox" },
        ]
    },
    {
        title: "MAPS & LOCATIONS",
        description: "Interactive mapping and location management",
        features: [
            { name: "Multiple Map Styles", description: "Choose from 11 map styles including OSM, satellite, dark, clean, winter, and custom styles" },
            { name: "Location Placement", description: "Place tasks at specific GPS coordinates" },
            { name: "Radius-Based Activation", description: "Define activation radius for each task (in meters)" },
            { name: "Geofencing", description: "Create geofenced areas for game zones" },
            { name: "Map Zoom & Pan", description: "Zoom in/out and navigate the map freely" },
            { name: "Distance Measurement", description: "Measure distances between tasks and zones" },
            { name: "Route Planning", description: "Plan optimal routes for players" },
            { name: "Danger Zones", description: "Mark areas where players should not go" },
            { name: "Meeting Points", description: "Set meeting/gathering locations for teams" },
            { name: "Snap to Road", description: "Snap task locations to actual road networks" },
        ]
    },
    {
        title: "GAME MANAGEMENT",
        description: "Create, configure, and manage games",
        features: [
            { name: "Create Games", description: "Set up new games with custom configurations" },
            { name: "Game Settings", description: "Configure game rules, timings, and parameters" },
            { name: "Multi-Playground Games", description: "Add multiple playgrounds to a single game" },
            { name: "Point Management", description: "Add, edit, and remove task points from games" },
            { name: "Game Cloning", description: "Duplicate existing games to reuse configurations" },
            { name: "Game History", description: "Track changes and edit history for audit trails" },
            { name: "Version Control", description: "Compare different versions of game configurations" },
            { name: "Export Games", description: "Export game data for backup or sharing" },
            { name: "Delete Games", description: "Safely delete games with confirmation" },
        ]
    },
    {
        title: "TEAM MANAGEMENT",
        description: "Organize and manage player teams",
        features: [
            { name: "Create Teams", description: "Set up teams of players for games" },
            { name: "Team Roles", description: "Assign captain and member roles" },
            { name: "Player Photos", description: "Upload profile photos for team members" },
            { name: "Team Scoring", description: "Track and display team scores in real-time" },
            { name: "Score Updates", description: "Update team scores based on task completion" },
            { name: "Team Statistics", description: "View detailed team performance analytics" },
            { name: "Retire Players", description: "Mark players as retired/inactive" },
            { name: "Voting Mode", description: "Enable consensus voting for team decisions" },
            { name: "Team Lobby", description: "Pre-game team setup and preparation area" },
        ]
    },
    {
        title: "GAMEPLAY & INTERACTION",
        description: "Features for active game play",
        features: [
            { name: "Play Mode", description: "Run games with full interactive features" },
            { name: "Simulation Mode", description: "Test games before playing with real players" },
            { name: "Task Modal Interface", description: "Interactive task display with scoring" },
            { name: "Answer Validation", description: "Automatic or manual task answer checking" },
            { name: "Status Markers", description: "Visual indicators for correct/wrong answers" },
            { name: "Real-time Feedback", description: "Immediate player feedback on task completion" },
            { name: "GPS Tracking", description: "Track player location during games" },
            { name: "HUD Display", description: "Game heads-up display with current status" },
            { name: "Timer Integration", description: "Built-in game timing controls" },
            { name: "Music Controls", description: "Add background music to games" },
        ]
    },
    {
        title: "TASK LOGIC & ACTIONS",
        description: "Advanced task triggering and logic",
        features: [
            { name: "Task Actions", description: "Define actions triggered by task completion" },
            { name: "onCorrect Triggers", description: "Actions when task is answered correctly" },
            { name: "onIncorrect Triggers", description: "Actions when task is answered incorrectly" },
            { name: "onOpen Triggers", description: "Actions when task is opened/accessed" },
            { name: "Lock/Unlock Tasks", description: "Control task availability based on logic" },
            { name: "Show/Hide Tasks", description: "Dynamically show or hide tasks" },
            { name: "Conditional Logic", description: "Complex conditional task triggering" },
            { name: "Action Visualization", description: "Visual representation of task connections and triggers" },
            { name: "Dotted Line Connectors", description: "Color-coded connections showing task relationships" },
        ]
    },
    {
        title: "EDITOR & VISUALIZATION",
        description: "Game design and editing tools",
        features: [
            { name: "Playground Editor", description: "Visual editor for designing game playgrounds" },
            { name: "Drag & Drop Tasks", description: "Reposition tasks by dragging on the map" },
            { name: "Grid Display", description: "Optional grid overlay for precise positioning" },
            { name: "Multiple View Modes", description: "Switch between interactive, design, and code modes" },
            { name: "Zoom Controls", description: "Zoom in/out for detailed editing" },
            { name: "Task Visibility Toggles", description: "Show/hide task names, scores, order numbers, and actions" },
            { name: "Bulk Icon Editing", description: "Change icons for multiple tasks at once" },
            { name: "Task Preview", description: "Hover over tasks to preview content" },
            { name: "Orientation Lock", description: "Lock gameplay to portrait or landscape mode" },
        ]
    },
    {
        title: "SETTINGS & ADMINISTRATION",
        description: "Configuration and system management",
        features: [
            { name: "User Settings", description: "Personalize app preferences and configurations" },
            { name: "Language Settings", description: "Change app language interface" },
            { name: "Language Migration", description: "Automatic language normalization and migration tools" },
            { name: "Admin Dashboard", description: "Administrator controls and monitoring" },
            { name: "Account Management", description: "User account and authentication settings" },
            { name: "Team Management", description: "Manage team rosters and memberships" },
            { name: "Database Tools", description: "Advanced database management features" },
            { name: "System Settings", description: "Configure application-wide settings" },
            { name: "Export Features", description: "Feature documentation and specifications" },
        ]
    },
    {
        title: "COLLABORATION & SHARING",
        description: "Team collaboration features",
        features: [
            { name: "Chat System", description: "In-app messaging between team members" },
            { name: "Task Sharing", description: "Share tasks with other users" },
            { name: "List Sharing", description: "Share task lists with team members" },
            { name: "Game Sharing", description: "Collaborate on game creation" },
            { name: "Comments", description: "Add notes and comments to games and tasks" },
            { name: "Activity Feed", description: "View activity history and changes" },
            { name: "Notifications", description: "Receive alerts for important updates" },
        ]
    },
];

export const getFullFeatureDescription = (): string => {
    let description = "TeamBattle Feature Catalog\n\n";
    
    FEATURE_CATALOG.forEach((category, catIndex) => {
        description += `${catIndex + 1}. ${category.title}\n`;
        description += `${category.description}\n\n`;
        
        category.features.forEach((feature, featureIndex) => {
            description += `${catIndex + 1}.${featureIndex + 1} ${feature.name}\n${feature.description}\n\n`;
        });
        
        description += "\n";
    });
    
    return description;
};
