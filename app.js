const STORAGE_KEY = 'roadmap_solved_tasks';
const THEME_KEY = 'roadmap_theme';

const XP_MAP = {
  Easy: 1,
  Medium: 2,
  Hard: 3
};

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

function generateTaskId(url) {
  if (!url) return 'task_' + Math.random().toString(36).substring(2, 9);
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return 'task_' + Math.abs(hash); // например: "task_1849204"
}

// Автоопределение платформы по URL
function getPlatformFromUrl(url) {
  if (!url) return 'Другое';
  const u = url.toLowerCase();
  
  if (u.includes('leetcode.com')) return 'LeetCode';
  if (u.includes('codeforces.com')) return 'CodeForces';
  if (u.includes('acmp.ru')) return 'ACMP';
  if (u.includes('timus.ru')) return 'Timus';
  if (u.includes('atcoder.jp')) return 'AtCoder';
  if (u.includes('stepik.org')) return 'Stepik';
  if (u.includes('informatics.msk.ru') || u.includes('informatics.mccme.ru')) return 'Informatics';
  if (u.includes('hackerrank.com')) return 'HackerRank';
  
  // Если платформа незнакомая, берем домен (например, codewars.com)
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch (e) {
    return 'Другое';
  }
}

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
            return subItem.tasks.map(t => {
              // Автоматический ID: берем ручной или генерируем из ссылки
              const taskId = t.id !== undefined ? String(t.id) : generateTaskId(t.url);

              return {
                category: catItem.category || 'Общее',
                subtopic: subItem.subtopic || '',
                difficulty: t.difficulty || subItem.difficulty || catItem.difficulty || 'Easy',
                locked: t.locked !== undefined ? t.locked : (subItem.locked !== undefined ? subItem.locked : (catItem.locked || false)),
                lockReason: t.lockReason || subItem.lockReason || catItem.lockReason || '',
                ...t,
                id: taskId // железно фиксируем уникальный id
              };
            });
          }
          return [];
        });
      }

      // 2. Обычный блочный формат (если где-то остался)
      if (catItem.tasks && Array.isArray(catItem.tasks)) {
        return catItem.tasks.map(t => {
          const taskId = t.id !== undefined ? String(t.id) : generateTaskId(t.url);
          return {
            category: catItem.category || 'Общее',
            subtopic: catItem.subtopic || '',
            difficulty: t.difficulty || catItem.difficulty || 'Easy',
            locked: t.locked !== undefined ? t.locked : (catItem.locked || false),
            lockReason: t.lockReason || catItem.lockReason || '',
            ...t,
            id: taskId
          };
        });
      }

      // 3. Старый плоский формат
      const taskId = catItem.id !== undefined ? String(catItem.id) : generateTaskId(catItem.url);
      return {
        ...catItem,
        id: taskId
      };
    });

    populatePlatformFilter();
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

  // Проверяем 100% только среди открытых задач!
  const unlockedTasks = tasks.filter(t => !t.locked);
  const unlockedSolved = unlockedTasks.filter(t => solvedIds.includes(t.id));
  
  if (unlockedSolved.length === unlockedTasks.length && unlockedTasks.length > 0) {
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
let currentPlatformFilter = 'all';

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

// НОВЫЙ ФИЛЬТР ПО ПЛАТФОРМЕ
window.setPlatformFilter = function(platform) {
  currentPlatformFilter = platform;
  render();
};

// Автоматическое заполнение выпадающего списка платформ
function populatePlatformFilter() {
  const platformSelect = document.getElementById('platform-filter');
  if (!platformSelect) return;

  const platforms = new Set();
  tasks.forEach(t => {
    if (t.url) {
      platforms.add(getPlatformFromUrl(t.url));
    }
  });

  const currentVal = platformSelect.value;
  platformSelect.innerHTML = '<option value="all">Все платформы</option>';
  Array.from(platforms).sort().forEach(platform => {
    const opt = document.createElement('option');
    opt.value = platform;
    opt.textContent = platform;
    platformSelect.appendChild(opt);
  });
  platformSelect.value = currentVal || 'all';
}

// 6. Отрисовка
function render() {
  const unlockedTasks = tasks.filter(t => !t.locked);

  // 1. Подсчет по количеству задач
  const total = unlockedTasks.length;
  const solved = unlockedTasks.filter(t => solvedIds.includes(t.id)).length;
  const taskPercent = total > 0 ? Math.round((solved / total) * 100) : 0;

  // 2. Подсчет по баллам (Easy = 1, Medium = 2, Hard = 3)
  let totalPoints = 0;
  let earnedPoints = 0;

  unlockedTasks.forEach(t => {
    const pts = XP_MAP[t.difficulty] || 1;
    totalPoints += pts;
    if (solvedIds.includes(t.id)) {
      earnedPoints += pts;
    }
  });

  const pointsPercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Обновляем шкалу задач
  const progressTextEl = document.getElementById('progress-text');
  const progressBarEl = document.getElementById('progress-bar');
  if (progressTextEl) progressTextEl.innerText = `${solved} / ${total} (${taskPercent}%)`;
  if (progressBarEl) progressBarEl.style.width = `${taskPercent}%`;

  // Обновляем шкалу баллов
  const pointsTextEl = document.getElementById('points-text');
  const pointsBarEl = document.getElementById('points-bar');
  if (pointsTextEl) pointsTextEl.innerText = `${earnedPoints} / ${totalPoints} (${pointsPercent}%)`;
  if (pointsBarEl) pointsBarEl.style.width = `${pointsPercent}%`;

  // ФИЛЬТРАЦИЯ ЗАДАЧ (С учетом платформы)
  const filtered = tasks.filter(t => {
    const isSolved = solvedIds.includes(t.id);
    const matchesStatus = 
      currentStatusFilter === 'all' ? true :
      currentStatusFilter === 'solved' ? isSolved : !isSolved;
    
    const matchesDiff = 
      currentDiffFilter === 'all' ? true : (!t.locked && t.difficulty === currentDiffFilter);

    const matchesCat = 
      currentCategoryFilter === 'all' ? true : t.category === currentCategoryFilter;

    // Проверка платформы по ссылке
    const matchesPlatform = 
      currentPlatformFilter === 'all' ? true : (t.url && getPlatformFromUrl(t.url) === currentPlatformFilter);

    return matchesStatus && matchesDiff && matchesCat && matchesPlatform;
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
    
    // Считаем прогресс категории только по открытым задачам
    const allCatTasks = tasks.filter(t => (t.category || 'Общее') === cat);
    const unlockedCatTasks = allCatTasks.filter(t => !t.locked);
    const solvedInCat = unlockedCatTasks.filter(t => solvedIds.includes(t.id)).length;
    
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

          <!-- Счетчик в категории -->
          <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            ${unlockedCatTasks.length > 0 ? `${solvedInCat} / ${unlockedCatTasks.length}` : '🔒'}
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
                <!-- Шапка подтемы -->
                ${subName ? `
                  <div 
                    onclick="toggleSubtopic('${subKey}')"
                    class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] transform transition-transform ${isSubCollapsed ? '-rotate-90' : 'rotate-0'}">▼</span>
                      <span>${subName}${isSubAllLocked ? ' 🔒' : ''}</span>
                    </div>

                    <!-- ЕСЛИ ПОДТЕМА ЗАБЛОКИРОВАНА — СЧЁТЧИК СКРЫВАЕТСЯ -->
                    ${!isSubAllLocked ? `
                      <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ${solvedInSub} / ${allSubTasks.length}
                      </span>
                    ` : ''}
                  </div>
                ` : ''}

                <div class="${isSubCollapsed ? 'hidden' : 'space-y-2'}">
                  ${isSubAllLocked ? `
                    <!-- ЕСЛИ ПОДТЕМА ЗАБЛОКИРОВАНА: ТОЛЬКО ЗНАЧОК И ПРИЧИНА -->
                    <div class="py-7 px-4 flex flex-col items-center justify-center text-center bg-slate-100/40 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                      <span class="text-3xl mb-2 select-none">🔒</span>
                      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
                        ${allSubTasks[0]?.lockReason || 'Откроется после следующего занятия'}
                      </p>
                    </div>
                  ` : subTasks.map(t => {
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
                        ${isLocked ? '' : `onclick="toggleTask('${t.id}', event)"`}
                        class="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${cardClasses}"
                      >
                        <div class="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
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
                        
                        <!-- Правая часть: подсказка (i) + сложность -->
                        ${!isLocked ? `
                          <div class="flex items-center gap-2.5 flex-shrink-0">
                            <!-- МГНОВЕННАЯ ПОДСКАЗКА "i" -->
                            ${t.note ? `
                              <div class="relative group/tip flex items-center">
                                <span 
                                  onclick="event.stopPropagation()"
                                  class="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 text-xs font-serif font-bold flex items-center justify-center cursor-pointer hover:scale-110 hover:bg-amber-200 dark:hover:bg-amber-900 transition-all select-none shadow-sm"
                                >
                                  i
                                </span>

                                <div class="absolute right-0 bottom-full mb-2 hidden group-hover/tip:block z-30 w-64 p-3 rounded-xl bg-slate-900 text-slate-100 text-xs sm:text-sm leading-relaxed shadow-2xl border border-slate-700 pointer-events-none">
                                  <div class="font-bold text-amber-400 mb-1 flex items-center gap-1">
                                    <span>⚠️ Внимание</span>
                                  </div>
                                  <div>${t.note}</div>
                                  <div class="absolute top-full right-2.5 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            ` : ''}

                            <!-- Сложность (баллы показываются при наведении) -->
                            <span 
                              onclick="event.stopPropagation()"
                              class="difficulty-badge text-xs font-semibold px-2.5 py-0.5 rounded-full border ${diffColors[t.difficulty] || diffColors.Easy}"
                              data-tooltip="+${XP_MAP[t.difficulty] || 1} XP за решение"
                            >
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
