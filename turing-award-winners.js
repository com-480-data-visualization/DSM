/* ---------------- state ------------------------------------------------- */
let cachedWinners = []; // keep the data around
let showAll = false; // current view state

/* ---------------- helpers ---------------------------------------------- */
function winnersPerRow(grid) {
  return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
}

/* ---------------- main renderer ---------------------------------------- */
function renderCards(winners) {
  cachedWinners = winners; // cache for later toggles

  const grid = document.getElementById('cards-container');
  const wrapper = document.getElementById('cards-wrapper');
  const cols = winnersPerRow(grid);

  grid.innerHTML = ''; // fresh slate each render

  winners.forEach((w, i) => {
    const wrap = document.createElement('div');
    wrap.className = `
      group relative row-span-3
      grid grid-rows-subgrid gap-2 place-items-center
      border-2 border-slate-400 rounded-2xl p-4 bg-white
      hover:shadow-lg hover:border-slate-600 transition
      ${!showAll && i >= cols ? 'hidden' : ''}
    `;

    wrap.append(
      Object.assign(document.createElement('span'), {
        textContent: w.name,
        className: 'row-start-1 text-sm font-semibold text-slate-700 text-center',
      }),
      Object.assign(document.createElement('img'), {
        src: `./data/images/${w.image_filename}`,
        alt: w.name,
        className: `
          row-start-2 aspect-square w-28 object-cover rounded-xl
          filter grayscale brightness-90 transition
          group-hover:brightness-110`,
      }),
      Object.assign(document.createElement('span'), {
        textContent: w.year,
        className: 'row-start-3 text-xs text-slate-500',
      }),
      (() => {
        const tip = document.createElement('div');
        tip.className = `
          absolute left-1/2 -translate-x-1/2 bottom-full mb-3
          hidden group-hover:block w-64 text-sm text-white
          bg-gray-800 rounded-lg shadow-lg p-3 text-center`;
        tip.innerHTML = `
          ${w.citation}
          <div class="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3
                      bg-gray-800 rotate-45"></div>`;
        return tip;
      })(),
      Object.assign(document.createElement('a'), {
        href: w.profile_url,
        target: '_blank',
        className: 'absolute inset-0',
      })
    );

    grid.appendChild(wrap);
  });

  /* -------- toggle button (add / update) ------------------------------- */
  const needToggle = winners.length > cols;
  let btn = document.getElementById('toggle-cards');

  if (!needToggle && btn) {
    btn.remove();
    return;
  } // nothing to toggle
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'toggle-cards';
    btn.className = `
      block mx-auto mt-6 px-4 py-2 rounded-lg
      bg-slate-700 text-white hover:bg-slate-600 transition`;
    wrapper.appendChild(btn);
  }

  btn.textContent = showAll ? 'See less' : 'See more';
  btn.onclick = () => {
    showAll = !showAll;
    renderCards(cachedWinners);
  };
}

/* ---------------- first load ------------------------------------------- */
async function loadWinners() {
  const res = await fetch('./data/turing_award_winners.json');
  const winners = await res.json();
  renderCards(winners);
}
loadWinners();

/* ---------------- optional: keep layout responsive --------------------- */
window.addEventListener('resize', () => renderCards(cachedWinners));
