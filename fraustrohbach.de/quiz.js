(() => {
  const state = {
    playerName: '',
    score: 0,
    totalQuestions: 0,
    remaining: [],
    hasStartedJudgment: false,
    leaderboard: [],
  };

  const screens = ['start', 'quiz', 'fail', 'success', 'reflections'];

  function showScreen(name) {
    const swap = () => {
      for (const id of screens) {
        const el = document.querySelector(`[data-screen="${id}"]`);
        if (el) el.classList.toggle('hidden', id !== name);
      }
    };
    if (document.startViewTransition) document.startViewTransition(swap);
    else swap();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem('leaderboard') || '';
      state.leaderboard = raw
        .split('|')
        .filter(Boolean)
        .map((entry) => {
          const [name, scoreStr] = entry.split(':');
          const score = parseInt(scoreStr, 10);
          if (!name || Number.isNaN(score)) return null;
          return { name, score };
        })
        .filter(Boolean);
    } catch {
      state.leaderboard = [];
    }
  }

  function saveLeaderboard() {
    const serialized = state.leaderboard.map((e) => `${e.name}:${e.score}`).join('|');
    try {
      localStorage.setItem('leaderboard', serialized);
    } catch {}
  }

  function renderLeaderboard(container, unit) {
    if (!container) return;
    const sorted = state.leaderboard.slice().sort((a, b) => b.score - a.score);
    container.innerHTML = sorted
      .map((e) => `<li>${escapeHtml(e.name)}: ${e.score} ${unit}</li>`)
      .join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function percentage() {
    if (state.totalQuestions === 0) return 0;
    return Math.floor((state.score * 100) / state.totalQuestions);
  }

  function startGame(questions) {
    state.score = 0;
    state.totalQuestions = questions.length;
    state.remaining = shuffle(questions);
    state.hasStartedJudgment = false;
    document.getElementById('current-question').textContent =
      'Tap the button to judge yourself!';
    document.getElementById('judge-me').classList.remove('hidden');
    document.getElementById('answer-buttons').classList.add('hidden');
    document.getElementById('test-passed').classList.add('hidden');
    showScreen('quiz');
  }

  function advance() {
    if (state.remaining.length === 0) {
      showSuccess();
      return;
    }
    const next = state.remaining.pop();
    const qEl = document.getElementById('current-question');
    qEl.style.opacity = '0';
    qEl.style.transform = 'translateX(-12px)';
    requestAnimationFrame(() => {
      qEl.textContent = next;
      qEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      qEl.style.opacity = '1';
      qEl.style.transform = 'translateX(0)';
    });
    if (state.remaining.length === 0) {
      document.getElementById('answer-buttons').classList.add('hidden');
      document.getElementById('test-passed').classList.remove('hidden');
    }
  }

  function showFail() {
    document.getElementById('fail-percentage').textContent = `${percentage()}`;
    document.getElementById('fail-summary').textContent =
      `${state.playerName}, you answered ${state.score} questions before failing.`;
    renderLeaderboard(document.getElementById('fail-leaderboard'), 'points');
    showScreen('fail');
  }

  function showSuccess() {
    document.getElementById('success-percentage').textContent = `${percentage()}`;
    renderLeaderboard(document.getElementById('success-leaderboard'), 'questions');
    showScreen('success');
  }

  function saveCurrentScore(refreshScreen) {
    state.leaderboard.push({ name: state.playerName, score: state.score });
    saveLeaderboard();
    refreshScreen();
  }

  function resetAll() {
    state.playerName = '';
    state.score = 0;
    state.totalQuestions = 0;
    state.remaining = [];
    state.hasStartedJudgment = false;
    const nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = '';
    document.getElementById('current-question').textContent =
      'Tap the button to judge yourself!';
    showScreen('start');
  }

  async function loadQuestions() {
    const res = await fetch('quiz-data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load quiz-data.json');
    const data = await res.json();
    return {
      questions: [...data.satiricalQuestions, ...data.realVeganQuestions],
      reflections: data.reflections,
    };
  }

  function renderReflections(reflections) {
    const titleEl = document.getElementById('reflections-title');
    const bodyEl = document.getElementById('reflections-body');
    if (titleEl) titleEl.textContent = reflections.title;
    if (bodyEl) {
      bodyEl.innerHTML = reflections.paragraphs
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadLeaderboard();

    let bundle;
    try {
      bundle = await loadQuestions();
    } catch (e) {
      document.getElementById('current-question').textContent =
        'Failed to load questions.';
      return;
    }

    renderReflections(bundle.reflections);

    document.getElementById('start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('player-name').value.trim();
      if (!name) return;
      state.playerName = name;
      startGame(bundle.questions);
    });

    document.getElementById('judge-me').addEventListener('click', () => {
      const next = state.remaining.pop();
      if (!next) return;
      document.getElementById('current-question').textContent = next;
      state.hasStartedJudgment = true;
      document.getElementById('judge-me').classList.add('hidden');
      document.getElementById('answer-buttons').classList.remove('hidden');
    });

    document.getElementById('soul-pure').addEventListener('click', () => {
      state.score += 1;
      advance();
    });

    document.getElementById('fail-button').addEventListener('click', () => {
      showFail();
    });

    document.getElementById('test-passed').addEventListener('click', () => {
      showSuccess();
    });

    document.getElementById('fail-save').addEventListener('click', () => {
      saveCurrentScore(showFail);
    });

    document.getElementById('success-save').addEventListener('click', () => {
      saveCurrentScore(showSuccess);
    });

    document.getElementById('fail-reflections').addEventListener('click', () => {
      showScreen('reflections');
    });

    document.getElementById('success-reflections').addEventListener('click', () => {
      showScreen('reflections');
    });

    document.getElementById('start-over').addEventListener('click', () => {
      resetAll();
    });
  });
})();
