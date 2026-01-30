/**
 * Default tasks for Around The World game mode
 * Tasks for each European city on the route from London to Istanbul
 */

import { TaskTemplate, GameTask } from '../../types';

export interface CityTaskSet {
  cityId: string;
  cityName: string;
  tasks: TaskTemplate[];
}

// Helper to create task template
const createTask = (
  id: string,
  title: string,
  question: string,
  type: 'multiple_choice' | 'text' | 'photo' | 'boolean',
  options?: string[],
  correctIndex?: number,
  answer?: string,
  points: number = 100,
  taskType: 'by' | 'land' | 'creative' = 'by'
): TaskTemplate => ({
  id,
  title,
  task: {
    question,
    type,
    options,
    correctIndex,
    answer
  } as GameTask,
  points,
  tags: ['arw', taskType, id.split('-')[0]],
  iconId: taskType === 'creative' ? 'camera' : taskType === 'land' ? 'world' : 'question',
  createdAt: Date.now()
});

export const ARW_DEFAULT_TASKS: CityTaskSet[] = [
  {
    cityId: 'london',
    cityName: 'London',
    tasks: [
      createTask(
        'london-by-1',
        'Big Ben\'s Secret',
        'What is the official name of the tower housing Big Ben?',
        'multiple_choice',
        ['Big Ben Tower', 'Elizabeth Tower', 'Westminster Tower', 'Clock Tower'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'london-land-1',
        'British Geography',
        'Which river flows through London?',
        'multiple_choice',
        ['River Severn', 'River Thames', 'River Mersey', 'River Tyne'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'london-creative-1',
        'Pack Your Bags',
        'Take a photo of 5 items you would pack for an 80-day journey around the world. Be creative!',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'paris',
    cityName: 'Paris',
    tasks: [
      createTask(
        'paris-by-1',
        'La Tour Eiffel',
        'In which year was the Eiffel Tower completed?',
        'multiple_choice',
        ['1872', '1889', '1900', '1850'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'paris-land-1',
        'French Regions',
        'Which famous palace is located just outside Paris?',
        'multiple_choice',
        ['Buckingham Palace', 'Versailles', 'Neuschwanstein', 'Schönbrunn'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'paris-creative-1',
        'French Cuisine',
        'Draw or photograph a traditional French dish. Explain why a Victorian traveler might enjoy it.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'bruxelles',
    cityName: 'Brussels',
    tasks: [
      createTask(
        'bruxelles-by-1',
        'Belgian Landmark',
        'What is the famous statue of a urinating boy in Brussels called?',
        'multiple_choice',
        ['Manneken Pis', 'Little Hans', 'Brussels Boy', 'Petit Jean'],
        0,
        undefined,
        100,
        'by'
      ),
      createTask(
        'bruxelles-land-1',
        'Belgian Knowledge',
        'What is Belgium famous for producing?',
        'multiple_choice',
        ['Wine', 'Chocolate', 'Pasta', 'Sushi'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'bruxelles-creative-1',
        'Waffle Art',
        'Create a drawing of a Belgian waffle with your favorite toppings!',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'amsterdam',
    cityName: 'Amsterdam',
    tasks: [
      createTask(
        'amsterdam-by-1',
        'Dutch Canals',
        'How many canals run through Amsterdam\'s city center?',
        'multiple_choice',
        ['Over 100', 'About 50', 'About 25', 'Over 165'],
        3,
        undefined,
        100,
        'by'
      ),
      createTask(
        'amsterdam-land-1',
        'Dutch Icons',
        'What flower is the Netherlands famous for?',
        'multiple_choice',
        ['Rose', 'Tulip', 'Daisy', 'Sunflower'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'amsterdam-creative-1',
        'Windmill Design',
        'Design your own Dutch windmill! Draw or build it and take a photo.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'koln',
    cityName: 'Cologne',
    tasks: [
      createTask(
        'koln-by-1',
        'Kölner Dom',
        'How long did it take to complete the Cologne Cathedral?',
        'multiple_choice',
        ['100 years', '300 years', 'Over 600 years', '50 years'],
        2,
        undefined,
        100,
        'by'
      ),
      createTask(
        'koln-land-1',
        'German Rivers',
        'Which major river flows through Cologne?',
        'multiple_choice',
        ['Danube', 'Elbe', 'Rhine', 'Main'],
        2,
        undefined,
        100,
        'land'
      ),
      createTask(
        'koln-creative-1',
        'Eau de Cologne',
        'The famous perfume "Eau de Cologne" originated here! Describe or draw what your ideal Victorian perfume would smell like.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'berlin',
    cityName: 'Berlin',
    tasks: [
      createTask(
        'berlin-by-1',
        'Brandenburg Gate',
        'The Brandenburg Gate was built in which architectural style?',
        'multiple_choice',
        ['Gothic', 'Baroque', 'Neoclassical', 'Renaissance'],
        2,
        undefined,
        100,
        'by'
      ),
      createTask(
        'berlin-land-1',
        'German History',
        'What was Berlin\'s role in the German Empire in 1872?',
        'multiple_choice',
        ['A small town', 'Capital of Prussia and German Empire', 'An Austrian city', 'A French territory'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'berlin-creative-1',
        'Prussian Portrait',
        'Strike a pose like a Prussian noble from 1872! Take a formal portrait photo.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'prag',
    cityName: 'Prague',
    tasks: [
      createTask(
        'prag-by-1',
        'Prague Astronomy',
        'What is special about the Prague Astronomical Clock?',
        'multiple_choice',
        ['It\'s the newest in Europe', 'It\'s the oldest working astronomical clock', 'It runs backwards', 'It only shows the date'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'prag-land-1',
        'Bohemian Kingdom',
        'In 1872, Prague was part of which empire?',
        'multiple_choice',
        ['Russian Empire', 'Ottoman Empire', 'Austro-Hungarian Empire', 'German Empire'],
        2,
        undefined,
        100,
        'land'
      ),
      createTask(
        'prag-creative-1',
        'Golem Legend',
        'Prague is famous for the legend of the Golem. Draw your own protective golem!',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'wien',
    cityName: 'Vienna',
    tasks: [
      createTask(
        'wien-by-1',
        'Viennese Music',
        'Which famous composer was NOT from Vienna?',
        'multiple_choice',
        ['Mozart', 'Beethoven', 'Strauss', 'Chopin'],
        3,
        undefined,
        100,
        'by'
      ),
      createTask(
        'wien-land-1',
        'Austrian Empire',
        'What was the ruling family of the Austro-Hungarian Empire?',
        'multiple_choice',
        ['Romanov', 'Bourbon', 'Habsburg', 'Tudor'],
        2,
        undefined,
        100,
        'land'
      ),
      createTask(
        'wien-creative-1',
        'Waltz Time',
        'Record a short video of your best Viennese waltz moves! (Or draw yourself dancing)',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'lyon',
    cityName: 'Lyon',
    tasks: [
      createTask(
        'lyon-by-1',
        'Silk City',
        'Lyon was historically famous for producing what luxury item?',
        'multiple_choice',
        ['Perfume', 'Silk', 'Wine', 'Cheese'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'lyon-land-1',
        'French Geography',
        'Which two rivers meet in Lyon?',
        'multiple_choice',
        ['Seine and Loire', 'Rhône and Saône', 'Garonne and Dordogne', 'Rhine and Moselle'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'lyon-creative-1',
        'Lumière Brothers',
        'The Lumière Brothers (inventors of cinema) were from Lyon! Create a "silent film" style photo.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'milano',
    cityName: 'Milan',
    tasks: [
      createTask(
        'milano-by-1',
        'Italian Art',
        'Which famous painting by Leonardo da Vinci can be found in Milan?',
        'multiple_choice',
        ['Mona Lisa', 'The Last Supper', 'Starry Night', 'The Birth of Venus'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'milano-land-1',
        'Italian Unification',
        'In 1872, Italy had been unified for how many years?',
        'multiple_choice',
        ['About 10 years', 'About 50 years', 'About 100 years', 'It wasn\'t unified yet'],
        0,
        undefined,
        100,
        'land'
      ),
      createTask(
        'milano-creative-1',
        'Fashion Capital',
        'Milan is the fashion capital! Design a Victorian outfit with a modern twist.',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'budapest',
    cityName: 'Budapest',
    tasks: [
      createTask(
        'budapest-by-1',
        'Twin Cities',
        'Budapest was formed in 1873 by uniting which two cities?',
        'multiple_choice',
        ['Vienna and Buda', 'Buda and Pest', 'Pest and Prague', 'Buda and Berlin'],
        1,
        undefined,
        100,
        'by'
      ),
      createTask(
        'budapest-land-1',
        'Hungarian Culture',
        'What is the Hungarian word for "Hungary"?',
        'multiple_choice',
        ['Magyar', 'Ungarn', 'Hongrie', 'Węgry'],
        0,
        undefined,
        100,
        'land'
      ),
      createTask(
        'budapest-creative-1',
        'Thermal Baths',
        'Budapest is famous for thermal baths. Design your dream Victorian spa!',
        'photo',
        undefined,
        undefined,
        undefined,
        150,
        'creative'
      )
    ]
  },
  {
    cityId: 'istanbul',
    cityName: 'Istanbul',
    tasks: [
      createTask(
        'istanbul-by-1',
        'Two Continents',
        'Istanbul is unique because it spans which two continents?',
        'multiple_choice',
        ['Africa and Asia', 'Europe and Africa', 'Europe and Asia', 'Asia and North America'],
        2,
        undefined,
        100,
        'by'
      ),
      createTask(
        'istanbul-land-1',
        'Ottoman Empire',
        'What was Istanbul called before 1930?',
        'multiple_choice',
        ['Ankara', 'Constantinople', 'Byzantium', 'Troy'],
        1,
        undefined,
        100,
        'land'
      ),
      createTask(
        'istanbul-creative-1',
        'Journey\'s End',
        'You made it! Create a victory pose photo or draw your team celebrating at the finish line!',
        'photo',
        undefined,
        undefined,
        undefined,
        200,
        'creative'
      )
    ]
  }
];

// Get all tasks as a flat array
export const getAllARWTasks = (): TaskTemplate[] => {
  return ARW_DEFAULT_TASKS.flatMap(city => city.tasks);
};

// Get tasks for a specific city
export const getTasksForCity = (cityId: string): TaskTemplate[] => {
  const citySet = ARW_DEFAULT_TASKS.find(c => c.cityId === cityId);
  return citySet?.tasks || [];
};

// Get task by ID
export const getTaskById = (taskId: string): TaskTemplate | undefined => {
  return getAllARWTasks().find(t => t.id === taskId);
};
