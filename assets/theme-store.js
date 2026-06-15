/* WaveOps — single source of truth for theme/accent/font/density.
   Both the nav toggle and the React Tweaks panel call into this. */
(function () {
  const KEY = 'flowops:tweaks:v1';
  const DEFAULTS = { theme: 'light', accent: 'violet', font: 'a', density: 'compact' };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  let state = load();
  const listeners = new Set();

  function apply() {
    const el = document.documentElement;
    el.setAttribute('data-theme', state.theme);
    el.setAttribute('data-accent', state.accent);
    el.setAttribute('data-font', state.font);
    el.setAttribute('data-density', state.density);
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function emit() {
    listeners.forEach((fn) => { try { fn(state); } catch (e) {} });
  }

  const FlowTheme = {
    get(k) { return k ? state[k] : { ...state }; },
    set(patch, val) {
      if (typeof patch === 'string') patch = { [patch]: val };
      state = { ...state, ...patch };
      apply();
      persist();
      emit();
    },
    toggleTheme() {
      this.set('theme', state.theme === 'dark' ? 'light' : 'dark');
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    defaults: { ...DEFAULTS },
  };

  // Apply ASAP to avoid flash.
  apply();
  window.FlowTheme = FlowTheme;
})();
