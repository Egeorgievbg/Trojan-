import { CONTRIBUTION_UNITS, NIGHTS } from './event-catalog.js';
import { escapeHtml as e, stamp } from './party-ui.js';

// Organizer-only UI. Source data must come from authenticated /api/v2/admin/overview.
export function renderAnswers(data, { householdAnswers, statusLabel, dateLabel, recipeName }) {
  const active = data.families.filter(({ family }) => !family.archived_at);
  const confirmed = active.filter(({ survey }) => survey?.submitted_revision === survey?.revision && survey?.submitted);
  const members = active.flatMap(({ family }) => family.members.filter(person => !person.archived_at));
  const nights = Object.fromEntries(NIGHTS.map(day => [day.id, 0]));
  for (const { survey } of active) {
    for (const entry of Object.values(survey?.submitted?.attendance ?? {})) {
      if (entry.status === 'no') continue;
      for (const day of entry.nights ?? []) if (Object.hasOwn(nights, day)) nights[day]++;
    }
  }
  const entries = active.map(({ family, survey }) => {
    const status = statusLabel(survey);
    const current = survey?.submitted;
    const drafts = survey?.draft && survey.revision !== survey.submitted_revision;
    const contributions = current?.shared?.contributions ?? [];
    return `<details class="t27-fold"><summary>${e(family.title)} · ${e(status)} · ${family.members.filter(person => !person.archived_at).length} участници</summary>
      <div class="t27-stack"><p class="t27-help">Променено: ${e(stamp(survey?.updated_at) || 'Няма')} · Потвърдено: ${e(stamp(survey?.submitted_at) || 'Няма')}</p>
      ${current ? householdAnswers(family, current) : '<p>Няма потвърдени отговори.</p>'}
      ${drafts ? `<details><summary>Последна непотвърдена чернова</summary>${householdAnswers(family, survey.draft)}</details>` : ''}
      ${contributions.length ? `<section class="t27-card"><h3>Предложения за принос</h3>
        ${contributions.map(item => `<p>${e(item.label || recipeName(item.recipeId))} · ${e(item.quantity)} ${e(CONTRIBUTION_UNITS[item.unit] || item.unit)}</p>`).join('')}</section>` : ''}
      </div></details>`;
  }).join('');
  return `<section class="t27-stack" aria-label="Всички отговори на участниците">
    <h2>Всички отговори</h2>
    <div class="t27-stats">
      <div><strong>${active.length}</strong><span>Домакинства</span></div>
      <div><strong>${members.length}</strong><span>Участници</span></div>
      <div><strong>${confirmed.length}</strong><span>Потвърдили</span></div>
      <div><strong>${active.length - confirmed.length}</strong><span>Без окончателно потвърждение</span></div>
    </div>
    <section class="t27-card"><h3>Нощувки по дати</h3><div class="t27-chips">
      ${Object.entries(nights).map(([day, count]) => `<span class="t27-pill">${e(dateLabel(day))}: ${count} души</span>`).join('')}
    </div><p class="t27-help">Само изрично избраните нощувки в потвърдени анкети.</p></section>
    ${entries}</section>`;
}
