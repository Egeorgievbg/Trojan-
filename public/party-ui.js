export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, part => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[part]);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function partyApi(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetch('/api/v2/' + path, {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(body === undefined ? {} : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
    });
    const data = await result.json().catch(() => null);
    if (!result.ok || !data) throw new ApiError(result.status, data?.message || 'Сървърът временно не отговаря.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Връзката прекъсна. Опитай отново. Незапазеното остава на този екран.');
  } finally {
    clearTimeout(timer);
  }
}

export function partyInstance(app) {
  const listeners = new AbortController();
  let alive = true;
  function of(target, event, callback, options = {}) {
    target.addEventListener(event, callback, { ...options, signal: listeners.signal });
  }
  of(app, 'error', event => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.t27')) {
      event.target.hidden = true;
      event.target.closest('.t27-photo, .t27-food-image')?.classList.add('is-unavailable');
    }
  }, { capture: true });
  return {
    of, alive: () => alive, dispose() { alive = false; listeners.abort(); }
  };
}

export function action(action, label, className = 't27-btn', extra = '') {
  return `<button type="button" class="${className}" data-action27="${escapeHtml(action)}" ${extra}>${escapeHtml(label)}</button>`;
}

export function dishImage(recipe, dynamic) {
  if (recipe.group === 'drink') return '';
  const id = encodeURIComponent(recipe.id);
  const src = dynamic ? '/api/v2/dish-photo?id=' + id : '/food/' + id + '-320.webp';
  const responsive = dynamic ? '' : `srcset="/food/${id}-320.webp 320w, /food/${id}-640.webp 640w" sizes="(max-width: 354px) 100vw, (max-width: 720px) 50vw, 240px"`;
  return `<span class="t27-food-image"><img src="${src}" ${responsive} width="320" height="240" loading="lazy" decoding="async" alt=""></span>`;
}

export function stamp(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia'
  }).format(new Date(value));
}

export function banner(message, kind = 'info') {
  return message ? `<div class="t27-notice t27-notice--${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${escapeHtml(message)}</div>` : '';
}
