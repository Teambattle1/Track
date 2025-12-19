import { TaskTemplate, TaskList, IconId } from '../types';
import * as db from '../services/db';

const createDemoTask = (
  idSuffix: string, 
  title: string, 
  type: any, 
  question: string, 
  icon: IconId, 
  extras: any = {}
): TaskTemplate => ({
  id: `demo-task-${idSuffix}`,
  title,
  iconId: icon,
  tags: ['demo'],
  createdAt: Date.now(),
  points: 100,
  task: {
    type,
    question,
    ...extras
  },
  feedback: {
    correctMessage: 'Great job!',
    showCorrectMessage: true,
    incorrectMessage: 'Not quite right, try again.',
    showIncorrectMessage: true,
    hint: 'Think outside the box!',
    hintCost: 10
  },
  settings: {
    scoreDependsOnSpeed: false,
    language: 'English',
    showAnswerStatus: true,
    showCorrectAnswerOnMiss: false
  }
});

export const DEMO_TASKS: TaskTemplate[] = [
  // 1. Text
  createDemoTask('1', 'Welcome Check-in', 'text', 'What is the name of this app?', 'flag', {
    answer: 'GeoHunt',
    placeholder: 'Enter the app name...'
  }),

  // 2. Multiple Choice
  createDemoTask('2', 'History Trivia', 'multiple_choice', 'Which year did the first human land on the moon?', 'question', {
    options: ['1965', '1969', '1972', '1980'],
    answer: '1969'
  }),

  // 3. Checkbox
  createDemoTask('3', 'Park Features', 'checkbox', 'Select all items you can typically find in a park:', 'treasure', {
    options: ['Benches', 'Traffic Lights', 'Trees', 'Submarines'],
    correctAnswers: ['Benches', 'Trees']
  }),

  // 4. Boolean
  createDemoTask('4', 'True or False', 'boolean', 'The sun rises in the West.', 'star', {
    answer: 'False'
  }),

  // 5. Slider
  createDemoTask('5', 'Distance Guess', 'slider', 'Estimate the height of a standard basketball hoop in feet.', 'trophy', {
    range: { min: 0, max: 20, step: 1, correctValue: 10, tolerance: 1 }
  }),

  // 6. Dropdown
  createDemoTask('6', 'Coffee Preference', 'dropdown', 'Which of these is made with espresso and steamed milk foam?', 'default', {
    options: ['Americano', 'Cappuccino', 'Cold Brew', 'Tea'],
    answer: 'Cappuccino'
  }),

  // 7. Multi-select Dropdown
  createDemoTask('7', 'Pizza Toppings', 'multi_select_dropdown', 'Select typical vegetarian toppings:', 'skull', {
    options: ['Pepperoni', 'Mushrooms', 'Peppers', 'Sausage', 'Onions'],
    correctAnswers: ['Mushrooms', 'Peppers', 'Onions']
  }),

  // 8. Image Task (Placeholder)
  createDemoTask('8', 'Visual Puzzle', 'text', 'Look at the image. How many legs does this creature have?', 'camera', {
    imageUrl: 'https://images.unsplash.com/photo-1559438036-749c95d436a5?auto=format&fit=crop&w=400&q=80', // Spider placeholder
    answer: '8'
  }),

  // 9. Video Task (Link)
  createDemoTask('9', 'Video Challenge', 'multiple_choice', 'Watch the video. What represents the "idea"?', 'camera', {
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll purely for demo purposes :)
    question: 'Watch the video linked above. Is he going to give you up?',
    options: ['Yes', 'No', 'Never'],
    answer: 'Never'
  }),

  // 10. Math/Numeric (Text)
  createDemoTask('10', 'Math Wizard', 'text', 'What is 15 + 27?', 'question', {
    answer: '42'
  })
];

export const DEMO_LISTS: TaskList[] = [
  {
    id: 'demo-list-1',
    name: 'Demo: Mixed Trivia',
    description: 'A mix of history, logic, and observation tasks.',
    color: '#3b82f6',
    createdAt: Date.now(),
    tasks: [DEMO_TASKS[0], DEMO_TASKS[1], DEMO_TASKS[3], DEMO_TASKS[5], DEMO_TASKS[9]]
  },
  {
    id: 'demo-list-2',
    name: 'Demo: Scavenger Hunt',
    description: 'Tasks involving observation and multiple inputs.',
    color: '#10b981',
    createdAt: Date.now(),
    tasks: [DEMO_TASKS[2], DEMO_TASKS[4], DEMO_TASKS[6], DEMO_TASKS[7], DEMO_TASKS[8]]
  }
];

export const seedDatabase = async () => {
  let count = 0;
  try {
    // Save Tasks
    for (const task of DEMO_TASKS) {
      await db.saveTemplate(task);
      count++;
    }
    // Save Lists
    for (const list of DEMO_LISTS) {
      await db.saveTaskList(list);
    }
    return { success: true, message: `Successfully seeded ${count} tasks and ${DEMO_LISTS.length} lists to Supabase.` };
  } catch (e: any) {
    console.error(e);
    return { success: false, message: `Error seeding data: ${e.message}` };
  }
};
