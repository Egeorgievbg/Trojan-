import { CONTRIBUTION_UNITS } from './event-catalog.js';
import { escapeHtml as e, stamp } from './party-ui.js';

// Резюме на действително потвърдена анкета. Не показва чужди лични предпочитания.
export function thankYouSection(model, reviewMarkup) {
  if (!model?.status?.submittedRevision || model.status.revision !== model.status.submittedRevision) return '';
  const labels = new Map(model.definition.recipes.map(recipe => [recipe.id, recipe.name]));
  const items = Array.isArray(model.sharedContributions) ? model.sharedContributions : [];
  const list = items.length ? `<ul class="t27-contribution-list">${items.map(item => `<li>
    <strong>${e(item.household)}</strong><span>${e(item.label || labels.get(item.recipeId) || 'Предложение')}
    · ${e(item.quantity)} ${e(CONTRIBUTION_UNITS[item.unit] || item.unit)}</span></li>`).join('')}</ul>`
    : '<p>Все още няма потвърдени предложения.</p>';
  return `<section class="t27-thankyou" aria-label="Обобщение на изпратената анкета">
    <div class="t27-card t27-thankyou-hero">
      <span class="t27-thankyou-confetti" aria-hidden="true">✦ ✧ ✷</span>
      <p class="t27-kicker">БЛАГОДАРИМ ВИ · ТРОЯН 2027</p>
      <h2>Готово, ${e(model.family.title)}! 🎉</h2>
      <p>Отговорите са потвърдени и могат да бъдат редактирани.</p>
      <p class="t27-pill">Потвърдено на ${e(stamp(model.status.submittedAt))}</p>
    </div>
    <details class="t27-fold" open><summary>Вашите отговори и нощувки</summary>
      <div class="t27-stack">${reviewMarkup}</div></details>
    <section class="t27-card t27-stack"><h2>Кой какво е заявил да донесе</h2>
      <p class="t27-help">Само потвърдените приноси за общата организация. Личните предпочитания остават поверителни.</p>
      ${list}
    </section>
  </section>`;
}
