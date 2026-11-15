// public/js/state.js - Frontend application state

import { FactorySimulation } from '/src/simulation.js';
import { DIRECTIONS } from '/src/config.js';

export const state = {
  user: null,
  simulation: new FactorySimulation(),
  
  // Active UI tool
  activeTool: 'inspect', // 'inspect', 'miner', 'conveyor', 'crafter', 'seller', 'demolish'
  buildDirection: DIRECTIONS.RIGHT,
  selectedResource: 'iron_ore',
  selectedRecipe: 'iron_gear',

  // Selection
  selectedCoords: null, // { x, y }
  selectedBuilding: null,

  // Hover
  hoverCoords: null, // { x, y }

  // Save status
  isSaving: false,
  lastSaveTime: null,

  // Particle effects for sales (+$10 floating text)
  particles: [],

  // Toast notifications
  toasts: [],

  // Listeners for UI re-render
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  },

  showToast(message, type = 'info', duration = 3500) {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    this.toasts.push(toast);
    this.renderToasts();

    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.renderToasts();
    }, duration);
  },

  renderToasts() {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    container.innerHTML = this.toasts
      .map(
        t => `
        <div class="toast ${t.type}">
          <span>${t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span>${t.message}</span>
        </div>
      `
      )
      .join('');
  },

  addParticle(x, y, text, color = '#34d399') {
    this.particles.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      life: 1.0 // seconds
    });
  }
};
