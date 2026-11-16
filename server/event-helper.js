// Deterministic, read-only event assistant. It never invents personal or event facts.
// Used only when an external AI model is unavailable, and disclosed as a non-AI fallback.
const normalize = value => String(value || '').toLocaleLowerCase('bg-BG').normalize('NFKC');
const dayLabel = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Number(match[3]) + '.' + match[2] + '.' + match[1] : String(value || '');
};
const mealLabel = item => item.dish ? item.dish : 'Все още няма избрани ястия';
const notSet = subject => subject + ' все още не е потвърдено в приложението. Попитай организаторите в личния чат.';

export function answerFromEventData(context, question) {
  const q = normalize(question);
  const event = context.event || {};
  const dates = Array.isArray(event.dates) ? event.dates : [];
  const meals = Array.isArray(context.plannedMeals) ? context.plannedMeals : [];
  const shared = Array.isArray(context.sharedContributions) ? context.sharedContributions : [];
  const household = context.myHousehold || {};
  let answer;
  if (/(къде|адрес|локаци|навигаци|вила|where|location)/u.test(q) && !/(какво|ядем|меню|храна)/u.test(q)) {
    answer = event.address ? 'Адресът, въведен от организаторите, е: ' + event.address + '. Проверете подробностите преди пътуване.' : notSet('Адресът на вилата');
  } else if (/(кога|дати|дата|ден|колко нощ|нощувк|оставаме|заминав|тръгв|пристиг|отпътув|when|night)/u.test(q)) {
    if (/(пристиг|час.*настан|check.?in)/u.test(q)) answer = event.arrival ? 'Информация за настаняването: ' + event.arrival : notSet('Часът за настаняване');
    else if (/(тръг|отпътув|освобож|check.?out)/u.test(q)) answer = event.departure ? 'Информация за освобождаването: ' + event.departure : notSet('Часът за освобождаване');
    else answer = dates.length ? 'Събирането е планирано от ' + dayLabel(dates[0]) + ' до ' + dayLabel(dates.at(-1)) + ', общо ' + (Number(event.nights) || Math.max(0, dates.length - 1)) + ' нощувки. Индивидуалните нощувки се избират в семейната анкета.' : notSet('Датите');
  } else if (/(меню|храна|хапв|ядем|вечеря|обяд|закуска|пи[ет]|напитк|food|dinner)/u.test(q)) {
    const lookedFor = q.match(/(?:31|01|02|03)(?:[.\/-](?:12|01))?/u);
    let chosen = meals;
    if (lookedFor) {
      const n = lookedFor[0].slice(0, 2);
      const day = dates.find(d => d.endsWith('-' + n));
      if (day) chosen = meals.filter(m => m.date === day);
    }
    if (!chosen.length) answer = notSet('Менюто за избрания ден');
    else {
      const groups = new Map();
      for (const meal of chosen) {
        const key = dayLabel(meal.date) + ' · ' + meal.meal;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(mealLabel(meal));
      }
      answer = 'В момента в плана са записани:\n' + [...groups].slice(0, 14).map(([name, dishes]) => '• ' + name + ': ' + [...new Set(dishes)].join(', ')).join('\n') + '\nТова е текущият план, не окончателно потвърдено меню.';
    }
  } else if (/(нося|донес|взим|носите|кой какво|продукт|принос|подготв|shopping|bring)/u.test(q)) {
    const rows = shared.filter(item => item.what && item.household);
    answer = rows.length ? 'Потвърдените предложения за общата организация са:\n' + rows.slice(0, 15).map(item => '• ' + item.household + ': ' + item.what).join('\n') : notSet('Списъкът с предложения кой какво ще донесе');
  } else if (/(моята анкета|отговори|потвърд|участниц|семейство|колко сме|присъств|attendance)/u.test(q)) {
    const people = Array.isArray(household.participants) ? household.participants : [];
    const present = people.filter(person => person.status === 'yes').length;
    answer = 'Вашата анкета е ' + (household.hasConfirmedSurvey ? 'потвърдена' : 'все още непотвърдена') + '. В домакинството са ' + people.length + ' участници; ' + present + ' са отбелязали, че ще присъстват. За подробности отворете „Моите отговори“.';
  } else if (/(дете|деца|игри|занимани|програма|активност|activities)/u.test(q)) {
    answer = 'За заниманията и програмата проверете раздел „Програма“. Ако няма потвърден час или отговорник, попитайте организаторите в личния чат.';
  } else {
    answer = 'Мога да проверя записаните дати, нощувки, меню, адрес, предложения кой какво носи и статуса на семейната анкета. За други въпроси използвай „Организатори“. Този режим не използва външен AI модел.';
  }
  return {answer, source:'event-data', mode:'local', generatedAt:new Date().toISOString()};
}
