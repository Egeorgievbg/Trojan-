export const DAYS = [
  { id: '2026-12-31', label: '31 декември' },
  { id: '2027-01-01', label: '1 януари' },
  { id: '2027-01-02', label: '2 януари' },
  { id: '2027-01-03', label: '3 януари' }
];

// Нощувките са датите без деня на отпътуване.
export const NIGHTS = DAYS.slice(0, -1);

export const MEALS = [
  { id: '31-snack', day: DAYS[0].id, title: 'Следобедно хапване', kind: 'snack' },
  { id: '31-dinner', day: DAYS[0].id, title: 'Новогодишна вечеря', kind: 'dinner' },
  { id: '01-breakfast', day: DAYS[1].id, title: 'Закуска', kind: 'breakfast' },
  { id: '01-lunch', day: DAYS[1].id, title: 'Обяд', kind: 'lunch' },
  { id: '01-dinner', day: DAYS[1].id, title: 'Вечеря', kind: 'dinner' },
  { id: '02-breakfast', day: DAYS[2].id, title: 'Закуска', kind: 'breakfast' },
  { id: '02-lunch', day: DAYS[2].id, title: 'Обяд', kind: 'lunch', optional: true },
  { id: '02-dinner', day: DAYS[2].id, title: 'Вечеря', kind: 'dinner' },
  { id: '03-breakfast', day: DAYS[3].id, title: 'Закуска преди отпътуване', kind: 'breakfast' }
];

export const ALLERGENS = {
  gluten: 'Зърнени храни с глутен', crustaceans: 'Ракообразни', eggs: 'Яйца',
  fish: 'Риба', peanuts: 'Фъстъци', soy: 'Соя', milk: 'Мляко', nuts: 'Ядки',
  celery: 'Целина', mustard: 'Синап', sesame: 'Сусам', sulphites: 'Сулфити',
  lupin: 'Лупина', molluscs: 'Мекотели', other: 'Друг продукт'
};

export const DIETS = {
  vegetarian: 'Вегетарианско', vegan: 'Веган', 'no-pork': 'Без свинско',
  'familiar-food': 'Позната храна от вкъщи', other: 'Друг режим'
};
export const RESTRICTION_TYPES = {
  allergy: 'Алергия', intolerance: 'Непоносимост', strict: 'Друго строго ограничение'
};
export const STATUS_LABELS = { yes: 'Идва', maybe: 'Може би', no: 'Не идва' };

export const ACTIVITIES = {
  board: 'Настолни игри', workshop: 'Сурвачки и оцветяване', movie: 'Филм и тих кът',
  dance: 'Музика и танци', puzzles: 'Пъзели и конструктор'
};
export const TASKS = {
  shopping: 'Покупки', cooking: 'Готвене', grill: 'Скара и грил', children: 'Детски занимания',
  music: 'Музика', serving: 'Подредба и сервиране', fortunes: 'Късмети и наздравица',
  cleanup: 'Подреждане след празника'
};

export const CONTRIBUTION_UNITS = { portion: 'порции', tray: 'тави', kg: 'кг', l: 'л', item: 'бр.' };
export const FOOD_GROUPS = [
  { id: 'main', title: 'Основно и скара', prompt: 'Какво би хапнал на обяд или вечеря?', limit: 3 },
  { id: 'side', title: 'Салати, гарнитури и мезета', prompt: 'Какво да сложим към основното?', limit: 3 },
  { id: 'breakfast', title: 'Закуски и хапвания', prompt: 'Кои варианти са ти любими?', limit: 3 },
  { id: 'sweet', title: 'Десерти', prompt: 'Какво сладко да приготвим?', limit: 3 },
  { id: 'drink', title: 'Напитки', prompt: 'Какво да предвидим за пиене?', limit: 5 },
  { id: 'tradition', title: 'За полунощ', prompt: 'Кои празнични ястия искате на трапезата?', limit: 4 }
];
const ingredients = {
  pork: ['Свинско месо', 'g', 'Месо'], beef: ['Телешка кайма', 'g', 'Месо'],
  chicken: ['Пилешко месо', 'g', 'Месо'], minced: ['Кайма', 'g', 'Месо'],
  onion: ['Лук', 'g', 'Зеленчуци'], tomato: ['Домати', 'g', 'Зеленчуци'],
  cucumber: ['Краставици', 'g', 'Зеленчуци'], pickle: ['Кисели краставички', 'g', 'Зеленчуци'],
  pepper: ['Чушки', 'g', 'Зеленчуци'], zucchini: ['Тиквички', 'g', 'Зеленчуци'],
  mushroom: ['Гъби', 'g', 'Зеленчуци'], carrot: ['Моркови', 'g', 'Зеленчуци'],
  potato: ['Картофи', 'g', 'Зеленчуци'], peas: ['Грах', 'g', 'Зеленчуци'],
  cabbage: ['Кисело зеле', 'g', 'Зеленчуци'], cheese: ['Сирене', 'g', 'Млечни'],
  yogurt: ['Кисело мляко', 'g', 'Млечни'], milk: ['Мляко', 'ml', 'Млечни'],
  egg: ['Яйца', 'бр', 'Млечни'], butter: ['Масло', 'g', 'Млечни'],
  sausage: ['Луканка', 'g', 'Месо'], oil: ['Олио', 'ml', 'Основни'],
  lemon: ['Лимон', 'g', 'Плодове'], fruit: ['Сезонни плодове', 'g', 'Плодове'],
  rice: ['Ориз', 'g', 'Основни'], beans: ['Боб', 'g', 'Основни'],
  pasta: ['Паста', 'g', 'Тестени'], dough: ['Тесто за пица', 'g', 'Тестени'],
  pastry: ['Кори за баница', 'g', 'Тестени'], bread: ['Хляб', 'g', 'Тестени'],
  flour: ['Брашно', 'g', 'Тестени'], sugar: ['Захар', 'g', 'Основни'],
  walnuts: ['Орехи', 'g', 'Основни'], lokum: ['Локум', 'g', 'Десерти'],
  sauce: ['Доматен сос', 'g', 'Основни'], mayo: ['Майонеза', 'g', 'Основни'],
  cake: ['Торта', 'g', 'Десерти'], yeast: ['Мая', 'g', 'Тестени'],
  lyutenitsa: ['Лютеница', 'g', 'Основни'], pickles: ['Туршия', 'g', 'Зеленчуци']
};

function dish(id, name, group, kinds, quantities, allergens = [], legacy = []) {
  return {
    id, name, group, kinds, allergens, legacy, adultOnly: false, archived: false,
    ingredients: Object.entries(quantities).map(([key, amount]) => {
      const [ingredient, unit, category] = ingredients[key];
      return { name: ingredient, unit, category, amount };
    })
  };
}

function drink(id, name, amount, adultOnly = false, allergens = [], legacy = []) {
  return {
    id, name, group: 'drink', kinds: ['snack', 'breakfast', 'lunch', 'dinner', 'light'],
    allergens, legacy, adultOnly, archived: false,
    ingredients: amount ? [{ name, unit: 'ml', category: 'Напитки', amount }] : []
  };
}

const mealKinds = ['lunch', 'dinner'];
const lightKinds = ['snack', 'lunch', 'light'];
const breakfastKinds = ['snack', 'breakfast'];

export const RECIPES = [
  dish('kyufte', 'Кюфтета на скара', 'main', mealKinds, { minced: 160, onion: 20 }),
  dish('kebapche', 'Кебапчета на скара', 'main', mealKinds, { minced: 160 }),
  dish('chicken-skewers', 'Пилешки шишчета', 'main', mealKinds, { chicken: 180, pepper: 40, onion: 30 }),
  dish('pork-neck', 'Свински врат на скара', 'main', mealKinds, { pork: 220, oil: 8 }),
  dish('chicken', 'Печено пилешко с картофи', 'main', mealKinds, { chicken: 180, potato: 160, lemon: 15, oil: 10 }),
  dish('pasta', 'Паста с доматен сос', 'main', mealKinds, { pasta: 100, sauce: 150 }, ['gluten']),
  dish('sarmi', 'Постни сарми', 'main', mealKinds, { rice: 65, cabbage: 110, onion: 20, oil: 10 }),
  dish('chicken-soup', 'Пилешка супа', 'main', lightKinds, { chicken: 100, carrot: 45, potato: 90, onion: 25 }),
  dish('bean-stew', 'Боб яхния', 'main', mealKinds, { beans: 85, carrot: 45, onion: 30, pepper: 30, oil: 8 }),
  dish('chicken-rice', 'Пиле с ориз', 'main', mealKinds, { chicken: 170, rice: 75, carrot: 25 }),
  dish('moussaka', 'Мусака', 'main', mealKinds, { potato: 220, minced: 120, onion: 35, yogurt: 70, egg: 0.5 }, ['milk', 'eggs']),
  dish('pizza', 'Пица със сирене', 'main', ['snack', 'lunch', 'dinner'], { dough: 160, cheese: 80, sauce: 60 }, ['gluten', 'milk']),
  dish('shopska', 'Шопска салата', 'side', mealKinds, { tomato: 120, cucumber: 90, cheese: 40, pepper: 40, oil: 8 }, ['milk'], ['Шопска салата']),
  dish('snezhanka', 'Салата Снежанка', 'side', ['snack', 'dinner'], { yogurt: 100, pickle: 45, walnuts: 12 }, ['milk', 'nuts']),
  dish('ruska', 'Руска салата', 'side', ['snack', 'dinner'], { potato: 80, peas: 30, carrot: 30, pickle: 25, mayo: 35 }, ['eggs', 'mustard'], ['Руска салата']),
  dish('potatoes', 'Печени картофи', 'side', mealKinds, { potato: 180, oil: 12 }),
  dish('grilled-veg', 'Грил зеленчуци', 'side', mealKinds, { zucchini: 70, pepper: 65, mushroom: 50, oil: 10 }),
  dish('meze', 'Луканка и сирена', 'side', ['snack', 'dinner'], { sausage: 55, cheese: 55 }, ['milk']),
  dish('pickles', 'Туршия', 'side', ['snack', 'lunch', 'dinner'], { pickles: 100 }, [], ['Туршия']),
  dish('lyutenitsa', 'Лютеница с хляб', 'side', breakfastKinds, { lyutenitsa: 70, bread: 65 }, ['gluten']),
  dish('sandwich', 'Сандвичи със сирене', 'breakfast', ['snack', 'breakfast', 'light'], { bread: 90, cheese: 40, cucumber: 35 }, ['gluten', 'milk']),
  dish('cheese-banitsa', 'Баница със сирене', 'breakfast', breakfastKinds, { pastry: 80, cheese: 60, egg: 0.5, yogurt: 50, oil: 12 }, ['gluten', 'eggs', 'milk']),
  dish('eggs', 'Яйца за закуска', 'breakfast', ['breakfast'], { egg: 2, bread: 60, butter: 8 }, ['eggs', 'gluten', 'milk'], ['Яйца']),
  dish('pancakes', 'Палачинки', 'breakfast', breakfastKinds, { flour: 65, milk: 130, egg: 0.6, oil: 5 }, ['gluten', 'eggs', 'milk'], ['Палачинки']),
  dish('yogurt-fruit', 'Кисело мляко с плодове', 'breakfast', ['breakfast'], { yogurt: 150, fruit: 90 }, ['milk']),
  dish('fruit', 'Плато със сезонни плодове', 'sweet', ['snack', 'breakfast', 'lunch', 'dinner', 'light'], { fruit: 150 }, [], ['Плодове']),
  dish('cake', 'Домашна торта', 'sweet', ['dinner', 'snack'], { cake: 110 }, ['gluten', 'eggs', 'milk'], ['Торта']),
  dish('cookies', 'Домашни сладки', 'sweet', ['dinner', 'snack'], { flour: 40, sugar: 16, butter: 25, egg: 0.2 }, ['gluten', 'milk', 'eggs']),
  dish('lokum-banitsa', 'Баница с локум', 'sweet', ['dinner', 'snack'], { pastry: 60, lokum: 45, sugar: 13, oil: 12 }, ['gluten']),
  dish('baklava', 'Баклава с орехи', 'sweet', ['dinner', 'snack'], { pastry: 40, walnuts: 30, sugar: 35, butter: 16 }, ['gluten', 'nuts', 'milk'], ['Баклава']),
  dish('fortune-banitsa', 'Солена баница с късмети', 'tradition', ['midnight'], { pastry: 70, cheese: 55, egg: 0.5, yogurt: 45, oil: 10 }, ['gluten', 'eggs', 'milk']),
  dish('fortune-bread', 'Пита с късмети', 'tradition', ['midnight'], { flour: 75, egg: 0.2, milk: 35, butter: 10, yeast: 3 }, ['gluten', 'eggs', 'milk']),
  drink('water', 'Вода', 350, false, [], ['Вода']),
  drink('juice', 'Плодов сок', 200, false, [], ['Сок']),
  drink('soft-drink', 'Безалкохолно', 220, false, [], ['Безалкохолно']),
  drink('sparkling-juice', 'Пенлив сок за наздравица', 130),
  drink('tea', 'Чай', 200, false, [], ['Чай']),
  drink('cocoa', 'Какао с мляко', 180, false, ['milk'], ['Какао']),
  drink('coffee', 'Кафе', 0, true, [], ['Кафе']),
  drink('rakia-grape', 'Гроздова ракия', 50, true),
  drink('rakia-plum', 'Сливова ракия', 50, true),
  drink('beer', 'Бира', 330, true, ['gluten'], ['Бира']),
  drink('wine-red', 'Червено вино', 150, true, ['sulphites']),
  drink('wine-white', 'Бяло вино', 150, true, ['sulphites']),
  drink('wine-rose', 'Розе', 150, true, ['sulphites']),
  drink('sparkling-wine', 'Пенливо вино', 130, true, ['sulphites'])
];

export const DEFAULT_DEFINITION = {
  groups: FOOD_GROUPS.map(group => ({ ...group, required: false, enabled: true })),
  recipes: RECIPES
};

export function appliesToMeal(recipe, meal) {
  return recipe.kinds.includes(meal.kind)
    || (recipe.kinds.includes('midnight') && meal.id === '31-dinner');
}
