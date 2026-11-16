const paths = {
  cabin: 'M3 20h18M5 20v-9l7-7 7 7v9M9 20v-6h6v6M4 12l8-8 8 8',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18M8 15h2m4 0h2',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  person: 'M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  pin: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  table: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18M20 3c-3 0-5 3-5 7v3h5m0-10v18',
  basket: 'M3 10h18l-2 10H5L3 10Zm3 0 4-6m8 6-4-6m-5 9v4m6-4v4',
  camera: 'M8 6l2-3h4l2 3h3a2 2 0 0 1 2 2v11H3V8a2 2 0 0 1 2-2h3Zm4 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  next: 'M4 12h15m-6-6 6 6-6 6',
  back: 'M20 12H5m6-6-6 6 6 6',
  close: 'm6 6 12 12M18 6 6 18',
  expand: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  form: 'M7 5H4v16h16V5h-3M9 3h6v4H9zM8 11h8m-8 5h8',
  photos: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 14 5-5 4 4 3-3 6 6M8 8h.01',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  shield: 'M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10Zm-3-10 2 2 4-4',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-10-5v5l4 2',
  check: 'm5 12 4 4L19 6',
  edit: 'm14 6 4 4M4 20l1-5L16 4a3 3 0 0 1 4 4L9 19l-5 1Z',
  logout: 'M10 20H4V4h6m4 4 4 4-4 4m-6-4h12',
  alert: 'M12 9v4m0 4h.01M11 4a1 1 0 0 1 2 0l9 15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1L11 4Z',
  spark: 'M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3m0-14-3 3m-8 8-3 3'
};

export function icon(name) {
  if (!Object.hasOwn(paths, name)) return '';
  return `<svg aria-hidden="true" focusable="false" class="t27-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
}

export function loadingMark() {
  return `<span aria-hidden="true" class="t27-load-mark">${icon('cabin')}</span>`;
}
