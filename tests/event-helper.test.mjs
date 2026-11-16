import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFromEventData } from '../server/event-helper.js';

const context = {
  event: {dates:['2026-12-31','2027-01-01','2027-01-02','2027-01-03'], nights:3, address:'Потвърден тестов адрес', arrival:'След 15:00'},
  plannedMeals: [{date:'2026-12-31', meal:'Вечеря', dish:'Баница'},{date:'2027-01-02',meal:'Вечеря',dish:'Скара'}],
  sharedContributions:[{household:'Семейство А',what:'Баклава'}],
  myHousehold:{hasConfirmedSurvey:true,participants:[{status:'yes'},{status:'maybe'}]}
};

test('assistant responds with four days and three nights without a model', () => {
  const answer=answerFromEventData(context,'Кога е събирането и колко нощувки?');
  assert.equal(answer.mode,'local');
  assert.match(answer.answer,/31\.12\.2026/);
  assert.match(answer.answer,/03\.01\.2027/);
  assert.match(answer.answer,/3 нощувки/);
});

test('question about confirmed survey never falls into the dates intent', () => {
  const response=answerFromEventData(context,'Моята анкета потвърдена ли е?');
  assert.match(response.answer,/Вашата анкета е потвърдена/);
  assert.doesNotMatch(response.answer,/Индивидуалните нощувки/);
});

test('assistant scopes a menu question to the requested day', () => {
  const answer=answerFromEventData(context,'Какво ще ядем на 31 декември?').answer;
  assert.match(answer,/Баница/);
  assert.doesNotMatch(answer,/Скара/);
});

test('unconfirmed menu and address remain explicitly unconfirmed', () => {
  const noData={...context,event:{dates:context.event.dates,nights:3},plannedMeals:[]};
  assert.match(answerFromEventData(noData,'Къде е вилата?').answer,/не е потвърден/);
  assert.match(answerFromEventData(noData,'Какво ще ядем?').answer,/не е потвърден/);
});

test('contributions include only supplied public contributions', () => {
  const answer=answerFromEventData(context,'Кой какво носи?').answer;
  assert.match(answer,/Баклава/);
  assert.doesNotMatch(answer,/алергия|медицински/);
});

test('unknown questions do not lead to invented information', () => {
  const answer=answerFromEventData(context,'Има ли плувен басейн?');
  assert.match(answer.answer,/не използва външен AI модел/);
});
