const STORAGE_KEY = 'roadmap_solved_tasks';
const THEME_KEY = 'roadmap_theme';

let tasks = [];
let solvedIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentStatusFilter = 'all';
let currentDiffFilter = 'all';
let currentCategoryFilter = 'all';

// Хранилище для свернутых категорий (по умолчанию все открыты)
let collapsedCategories = new Set();

const diffColors = {
  Easy: 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/60',
  Medium: 'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/60',
  Hard: 'text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-400 dark:bg-rose-950/60 dark:border-rose-800/60'
};

// 1. Тема
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function applyTheme(theme) {
  const moonIcon = document.getElementById('moon-icon');
  const sunIcon = document.getElementById('sun-icon');

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    moonIcon.classList.add('hidden');
    sunIcon.classList.remove('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
  localStorage.setItem(THEME_KEY, theme);
}

// 2. Загрузка задач
async function loadTasks() {
  try {
    const res = await fetch('tasks.json');
    tasks = await res.json();
    populateCategoryFilter();
    render();
  } catch (e) {
    document.getElementById('task-list').innerHTML = 
      '<div class="text-center text-rose-500 py-10">Ошибка загрузки tasks.json</div>';
  }
}

function populateCategoryFilter() {
  const categories = [...new Set(tasks.map(t => t.category || 'Общее'))];
  const select = document.getElementById('category-filter');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    select.appendChild(opt);
  });
}

// 3. Сворачивание / Разворачивание категорий
function toggleCategoryCollapse(cat) {
  if (collapsedCategories.has(cat)) {
    collapsedCategories.delete(cat);
  } else {
    collapsedCategories.add(cat);
  }
  render();
}

// 4. Отметка выполнения
function toggleTask(id) {
  if (solvedIds.includes(id)) {
    solvedIds = solvedIds.filter(item => item !== id);
  } else {
    solvedIds.push(id);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solvedIds));
  render();

  if (solvedIds.length === tasks.length && tasks.length > 0) {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }
}

function resetProgress() {
  if (confirm('Сбросить весь твой прогресс выполнения задач?')) {
    solvedIds = [];
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
}

// 5. Фильтры
function setStatusFilter(status) {
  currentStatusFilter = status;
  ['all', 'unsolved', 'solved'].forEach(s => {
    const btn = document.getElementById(`filter-${s}`);
    if (s === status) {
      btn.className = 'px-3 py-1.5 rounded-md font-medium bg-slate-900 dark:bg-slate-800 text-white transition-colors';
    } else {
      btn.className = 'px-3 py-1.5 rounded-md font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors';
    }
  });
  render();
}

function setDiffFilter(diff) {
  currentDiffFilter = diff;
  render();
}

function setCategoryFilter(category) {
  currentCategoryFilter = category;
  render();
}

// 6. Отрисовка
function render() {
  // Прогресс
  const total = tasks.length;
  const solved = solvedIds.length;
  const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

  document.getElementById('progress-text').innerText = `${solved} / ${total} (${percent}%)`;
  document.getElementById('progress-bar').style.width = `${percent}%`;

  // Фильтрация задач
  const filtered = tasks.filter(t => {
    const isSolved = solvedIds.includes(t.id);
    const matchesStatus = 
      currentStatusFilter === 'all' ? true :
      currentStatusFilter === 'solved' ? isSolved : !isSolved;
    
    const matchesDiff = 
      currentDiffFilter === 'all' ? true : t.difficulty === currentDiffFilter;

    const matchesCat = 
      currentCategoryFilter === 'all' ? true : t.category === currentCategoryFilter;

    return matchesStatus && matchesDiff && matchesCat;
  });

  const listContainer = document.getElementById('task-list');
  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="text-center py-10 text-slate-400">Ничего не найдено</div>';
    return;
  }

  const activeCategories = [...new Set(filtered.map(t => t.category || 'Общее'))];

  listContainer.innerHTML = activeCategories.map(cat => {
    const catTasks = filtered.filter(t => (t.category || 'Общее') === cat);
    const allCatTasks = tasks.filter(t => (t.category || 'Общее') === cat);
    const solvedInCat = allCatTasks.filter(t => solvedIds.includes(t.id)).length;
    
    // Проверяем, свернут ли раздел сейчас
    const isCollapsed = collapsedCategories.has(cat);

    return `
      <section class="space-y-3">
        <!-- Кликабельная шапка раздела -->
        <div 
          onclick="toggleCategoryCollapse('${cat}')" 
          class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2 cursor-pointer select-none group"
        >
          <div class="flex items-center gap-2">
            <!-- Стрелочка: поворачивается на -90 градусов, когда блок свернут -->
            <svg 
              class="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <h2 class="text-lg font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-500 transition-colors">
              ${cat}
            </h2>
          </div>

          <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            ${solvedInCat} / ${allCatTasks.length}
          </span>
        </div>

        <!-- Задачи категории: скрываются классом hidden, если раздел свернут -->
        <div class="${isCollapsed ? 'hidden' : 'space-y-2'}">
          ${catTasks.map(t => {
            const isSolved = solvedIds.includes(t.id);
            return `
              <div class="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                isSolved 
                  ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/40 opacity-60' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
              }">
                <div class="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
                  <input 
                    type="checkbox" 
                    id="task-${t.id}" 
                    ${isSolved ? 'checked' : ''} 
                    onchange="toggleTask(${t.id})"
                    class="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 cursor-pointer accent-blue-600"
                  />
                  <label for="task-${t.id}" class="text-sm sm:text-base font-medium truncate cursor-pointer select-none ${isSolved ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}">
                    ${t.title}
                  </label>
                </div>
                
                <div class="flex items-center gap-2.5">
                  <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border ${diffColors[t.difficulty] || diffColors.Easy}">
                    ${t.difficulty}
                  </span>
                  <a href="${t.url}" target="_blank" rel="noopener noreferrer" class="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Открыть задачу">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }).join('');
}

// Запуск
initTheme();
loadTasks();
