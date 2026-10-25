const STORAGE_KEY = 'roadmap_solved_tasks';
const THEME_KEY = 'roadmap_theme';

let tasks = [];
let solvedIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentStatusFilter = 'all';
let currentDiffFilter = 'all';
let currentCategoryFilter = 'all';

let collapsedCategories = new Set();
let collapsedSubtopics = new Set();

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

// 2. Загрузка задач (с глубокой вложенностью)
async function loadTasks() {
  try {
    const res = await fetch('tasks.json');
    const rawData = await res.json();
    
    tasks = rawData.flatMap(catItem => {
      // 1. Формат с глубокой вложенностью: Категория -> subtopics -> tasks
      if (catItem.subtopics && Array.isArray(catItem.subtopics)) {
        return catItem.subtopics.flatMap(subItem => {
          if (subItem.tasks && Array.isArray(subItem.tasks)) {
            return subItem.tasks.map(t => ({
              category: catItem.category || 'Общее',
              subtopic: subItem.subtopic || '',
              difficulty: t.difficulty || subItem.difficulty || catItem.difficulty || 'Easy',
              locked: t.locked !== undefined ? t.locked : (subItem.locked !== undefined ? subItem.locked : (catItem.locked || false)),
              lockReason: t.lockReason || subItem.lockReason || catItem.lockReason || '',
              ...t
            }));
          }
          return [];
        });
      }

      // 2. Обычный блочный формат (если вдруг где-то используется)
      if (catItem.tasks && Array.isArray(catItem.tasks)) {
        return catItem.tasks.map(t => ({
          category: catItem.category || 'Общее',
          subtopic: catItem.subtopic || '',
          difficulty: t.difficulty || catItem.difficulty || 'Easy',
          locked: t.locked !== undefined ? t.locked : (catItem.locked || false),
          lockReason: t.lockReason || catItem.lockReason || '',
          ...t
        }));
      }

      // 3. Старый плоский формат (для обратной совместимости)
      return catItem;
    });

    //populateCategoryFilter();
    render();
  } catch (e) {
    console.error('Ошибка загрузки tasks.json:', e);
    document.getElementById('task-list').innerHTML = 
      '<div class="text-center text-rose-500 py-10">Ошибка загрузки tasks.json</div>';
  }
}

// 3. Сворачивание тем и подтем
window.toggleCategory = function(cat) {
  if (collapsedCategories.has(cat)) {
    collapsedCategories.delete(cat);
  } else {
    collapsedCategories.add(cat);
  }
  render();
};

window.toggleSubtopic = function(subKey) {
  if (collapsedSubtopics.has(subKey)) {
    collapsedSubtopics.delete(subKey);
  } else {
    collapsedSubtopics.add(subKey);
  }
  render();
};

window.toggleAllCategories = function() {
  const allCategories = [...new Set(tasks.map(t => t.category || 'Общее'))];
  if (collapsedCategories.size === allCategories.length) {
    collapsedCategories.clear();
  } else {
    allCategories.forEach(c => collapsedCategories.add(c));
  }
  render();
};

// 4. Отметка задач + Конфетти
window.toggleTask = function(id, event) {
  const task = tasks.find(t => t.id === id);
  if (task && task.locked) return;

  const isNowSolved = !solvedIds.includes(id);

  if (isNowSolved) {
    solvedIds.push(id);

    // Салют из точки клика
    const x = event ? event.clientX / window.innerWidth : 0.5;
    const y = event ? event.clientY / window.innerHeight : 0.6;
    
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { x, y },
      ticks: 150,
      gravity: 1.2,
      scalar: 0.75
    });
  } else {
    solvedIds = solvedIds.filter(item => item !== id);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(solvedIds));
  render();

  if (solvedIds.length === tasks.length && tasks.length > 0) {
    setTimeout(() => {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }, 200);
  }
};

window.resetProgress = function() {
  if (confirm('Сбросить весь твой прогресс выполнения задач?')) {
    solvedIds = [];
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
};

// 5. Фильтры
window.setStatusFilter = function(status) {
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
};

window.setDiffFilter = function(diff) {
  currentDiffFilter = diff;
  render();
};

window.setCategoryFilter = function(category) {
  currentCategoryFilter = category;
  render();
};

// 6. Отрисовка
function render() {
  const total = tasks.length;
  const solved = solvedIds.length;
  const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

  document.getElementById('progress-text').innerText = `${solved} / ${total} (${percent}%)`;
  document.getElementById('progress-bar').style.width = `${percent}%`;

  const filtered = tasks.filter(t => {
    const isSolved = solvedIds.includes(t.id);
    const matchesStatus = 
      currentStatusFilter === 'all' ? true :
      currentStatusFilter === 'solved' ? isSolved : !isSolved;
    
    const matchesDiff = 
      currentDiffFilter === 'all' ? true : (!t.locked && t.difficulty === currentDiffFilter);

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
  const allCollapsed = activeCategories.length > 0 && activeCategories.every(c => collapsedCategories.has(c));

  let headerControls = '';
  if (currentCategoryFilter === 'all' && activeCategories.length > 1) {
    headerControls = `
      <div class="flex justify-end pb-1">
        <button onclick="toggleAllCategories()" class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          ${allCollapsed ? 'Развернуть все разделы' : 'Свернуть все разделы'}
        </button>
      </div>
    `;
  }

  listContainer.innerHTML = headerControls + activeCategories.map(cat => {
    const catTasks = filtered.filter(t => (t.category || 'Общее') === cat);
    const allCatTasks = tasks.filter(t => (t.category || 'Общее') === cat);
    const solvedInCat = allCatTasks.filter(t => solvedIds.includes(t.id)).length;
    
    const isCollapsed = collapsedCategories.has(cat);

    // Группировка задач внутри темы по подтемам (subtopic)
    const subtopicNames = [...new Set(catTasks.map(t => t.subtopic || ''))];

    return `
      <section class="space-y-3 mb-6 bg-slate-50/50 dark:bg-slate-900/30 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <!-- Главная шапка темы -->
        <div 
          onclick="toggleCategory('${cat}')" 
          class="flex items-center justify-between p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer select-none transition-all group"
          title="Нажмите, чтобы ${isCollapsed ? 'развернуть' : 'свернуть'}"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-200/80 dark:bg-slate-800 group-hover:bg-blue-500 group-hover:text-white text-slate-500 dark:text-slate-400 transition-colors">
              <svg 
                class="w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <h2 class="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              ${cat}
            </h2>
          </div>

          <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            ${solvedInCat} / ${allCatTasks.length}
          </span>
        </div>

        <!-- Содержимое темы (подтемы и задачи) -->
        <div class="${isCollapsed ? 'hidden' : 'space-y-4 pt-2'}">
          ${subtopicNames.map(subName => {
            const subTasks = catTasks.filter(t => (t.subtopic || '') === subName);
            const subKey = `${cat}_${subName}`;
            const isSubCollapsed = collapsedSubtopics.has(subKey);

            const allSubTasks = tasks.filter(t => (t.category || 'Общее') === cat && (t.subtopic || '') === subName);
            const solvedInSub = allSubTasks.filter(t => solvedIds.includes(t.id)).length;
            const isSubAllLocked = allSubTasks.length > 0 && allSubTasks.every(t => t.locked);

            return `
              <div class="space-y-2">
                <!-- Шапка подтемы (отображается, если у задачи есть subtopic) -->
                ${subName ? `
                  <div 
                    onclick="toggleSubtopic('${subKey}')"
                    class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] transform transition-transform ${isSubCollapsed ? '-rotate-90' : 'rotate-0'}">▼</span>
                      <span>${isSubAllLocked ? '🔒 ' : ' '}${subName}</span>
                    </div>
                    <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      ${solvedInSub} / ${allSubTasks.length}
                    </span>
                  </div>
                ` : ''}

                <!-- Список задач подтемы -->
                <div class="${isSubCollapsed ? 'hidden' : 'space-y-2'}">
                  ${subTasks.map(t => {
                    const isSolved = solvedIds.includes(t.id);
                    const isLocked = t.locked === true;

                    let cardClasses = '';
                    if (isLocked) {
                      cardClasses = 'bg-slate-100/40 dark:bg-slate-900/20 border-slate-200/60 dark:border-slate-800/40 opacity-60 cursor-not-allowed select-none border-dashed';
                    } else if (isSolved) {
                      cardClasses = 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/40 opacity-60 cursor-pointer select-none';
                    } else {
                      cardClasses = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm cursor-pointer select-none';
                    }

                    return `
                      <div 
                        ${isLocked ? '' : `onclick="toggleTask(${t.id}, event)"`}
                        class="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${cardClasses}"
                      >
                        <div class="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
                          <!-- Иконка -->
                          ${isLocked 
                            ? `<span class="text-base select-none flex-shrink-0" title="${t.lockReason || 'Заблокировано'}">🔒</span>` 
                            : `<input 
                                type="checkbox" 
                                id="task-${t.id}" 
                                ${isSolved ? 'checked' : ''} 
                                class="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 accent-blue-600 flex-shrink-0 pointer-events-none"
                              />`
                          }
                          
                          <div class="truncate">
                            <!-- Название -->
                            ${isLocked 
                              ? `<span class="text-sm sm:text-base font-medium italic text-slate-400 dark:text-slate-500 select-none">Скрытая задача</span>`
                              : `<a 
                                  href="${t.url}" 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  onclick="event.stopPropagation()"
                                  class="text-sm sm:text-base font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors ${
                                    isSolved ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                                  }"
                                  title="Перейти к задаче: ${t.title}"
                                >
                                  ${t.title}
                                </a>`
                            }
                            ${isLocked && t.lockReason ? `<p class="text-[11px] text-amber-600 dark:text-amber-400 font-medium not-italic">${t.lockReason}</p>` : ''}
                          </div>
                        </div>
                        
                        <!-- Сложность -->
                        ${!isLocked ? `
                          <div class="flex-shrink-0">
                            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border ${diffColors[t.difficulty] || diffColors.Easy}">
                              ${t.difficulty}
                            </span>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
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
