import { icon } from './interface.js';

const features = [
  ['table', 'Меню за четири дни', 'Изберете ястия и напитки за всяко хранене.'],
  ['people', 'Отговори за всеки', 'Попълнете веднъж за семейството, поотделно за всеки гост.'],
  ['basket', 'Общи покупки', 'Съберете продуктите, количествата и отговорниците на едно място.']
];

const days = [
  ['31', 'декември', 'Посрещаме 2027', ['Пристигане', 'Следобедно хапване', 'Празнична вечеря']],
  ['01', 'януари', 'Първият ден', ['Закуска', 'Обяд и игри', 'Вечеря']],
  ['02', 'януари', 'Още една вечер заедно', ['Закуска', 'Обяд и игри', 'Вечеря']],
  ['03', 'януари', 'Отпътуване', ['Закуска', 'Събиране на багажа', 'Освобождаване']]
];

export function homeCounts(overview) {
  if (!overview || !Number.isSafeInteger(overview.households) || !Number.isSafeInteger(overview.participants)) return '';
  return `<span>${icon('people')} ${overview.households} домакинства · ${overview.participants} поканени</span>`;
}

export function homePage(overview, photos, countdown) {
  return `<header class="home-header">
    <div class="home-header-inner">
      <a class="home-brand" href="/" aria-label="Троян 2027 — начало">${icon('cabin')}<span>Троян <b>2027</b></span></a>
      <nav aria-label="Основна навигация"><a href="#villa">Вилата</a><a href="#program">Програма</a>
        <button class="home-btn home-btn--pine" data-action="family">${icon('form')}<span>Анкета</span></button></nav>
    </div>
  </header>
  <main class="home-page">
    <section class="hero home-hero" aria-labelledby="home-title">
      <img class="home-hero-image" src="/images/aerial-640.webp"
        srcset="/images/aerial-640.webp 640w, /images/aerial-1120.webp 1120w, /images/aerial-1600.webp 1600w"
        sizes="100vw" fetchpriority="high" alt="">
      <div class="home-hero-inner">
        <div class="home-hero-copy">
          <p class="home-kicker">${icon('calendar')} 31 декември – 3 януари</p>
          <h1 id="home-title">Нова година<br><em>в Троян.</em></h1>
          <p class="home-intro">Четири дни заедно. Подготвяме менюто, игрите и празничната вечеря.</p>
          <div class="home-actions">
            <button class="home-btn home-btn--gold" data-action="family">Попълни за семейството ${icon('next')}</button>
            <a class="home-btn home-btn--ghost" href="#villa">${icon('camera')} Разгледай вилата</a>
          </div>
        </div>
        <div class="home-event-line">
          <span>${icon('pin')} Троян, България</span>
          <span class="home-countdown">${icon('clock')} <span id="countdown">${countdown}</span></span>
          <div id="home-counts">${homeCounts(overview)}</div>
        </div>
      </div>
    </section>
    <section class="home-section home-basics" aria-labelledby="home-plan">
      <h2 id="home-plan">Подготовка за празника</h2>
      <div class="home-grid">${features.map(([mark, title, copy]) => `<article class="home-feature" data-home-motion>
        <span class="home-feature-icon">${icon(mark)}</span><div><h3>${title}</h3><p>${copy}</p></div>
      </article>`).join('')}</div>
    </section>
    <section class="home-section home-gallery" id="villa" aria-labelledby="home-villa">
      <div class="home-section-title"><div><p class="home-kicker">${icon('camera')} Мястото</p><h2 id="home-villa">Вилата в Троян</h2></div></div>
      <div class="home-photo-grid">${photos.map(([file, title], index) => {
        const name = file.replace('.jpg', '');
        const sizes = index === 0 ? '(max-width: 700px) 100vw, 55vw' : '(max-width: 700px) 50vw, 30vw';
        return `<button class="home-photo" data-photo="${index}" aria-label="Разгледай: ${title}" data-home-motion>
          <img src="/images/${name}-640.webp" srcset="/images/${name}-640.webp 640w, /images/${name}-1280.webp 1280w"
            sizes="${sizes}" loading="lazy" decoding="async" alt="">
          <span>${title}${icon('expand')}</span></button>`;
      }).join('')}</div>
      <p class="home-help">Снимки на вилата. Летните удобства не са потвърдени за зимния сезон.</p>
    </section>
    <section class="home-section" id="program" aria-labelledby="home-program">
      <p class="home-kicker">${icon('calendar')} 31.12 – 03.01</p>
      <h2 id="home-program">Програма за четирите дни</h2>
      <div class="home-grid">${days.map(([date, month, title, plan]) => `<article class="home-day" data-home-motion>
        <div class="home-date"><strong>${date}</strong><span>${month}</span></div>
        <div><h3>${title}</h3><ul>${plan.map(item => `<li>${item}</li>`).join('')}</ul></div>
      </article>`).join('')}</div>
    </section>
    <section class="home-section">
      <div class="home-cta" data-home-motion>
        <div><h2>Семейна анкета</h2><p>Отвори личния линк от Viber, за да запазиш отговорите на семейството.</p></div>
        <button class="home-btn home-btn--gold" data-action="family">Към анкетата ${icon('next')}</button>
      </div>
    </section>
  </main>
  <footer class="home-footer"><span>Троян · Нова година 2027</span>
    <button class="home-btn home-btn--quiet" data-action="admin">${icon('shield')} Организатор</button>
  </footer>`;
}
