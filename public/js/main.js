// public/js/main.js - Application entrypoint and event bindings

import { BUILDINGS, DIRECTIONS, RECIPES, ITEMS, getUpgradeCost, getAdjustedCycleTime } from '/src/config.js';
import { api } from './api.js';
import { state } from './state.js';
import { FactoryRenderer } from './renderer.js';

let renderer = null;
let lastFrameTime = performance.now();
let autoSaveInterval = null;

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  renderer = new FactoryRenderer(canvas);

  setupUI();
  setupCanvasEvents(canvas);
  setupKeyboardShortcuts();

  // Check auth session
  await initSession();

  // Start game loops
  requestAnimationFrame(gameLoop);
  startAutoSave();
});

// Main Animation & Simulation Loop
function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // Tick simulation
  state.simulation.tick(dt);

  // Render frame
  renderer.render(dt);

  // Update HUD
  updateHUD();

  // If machine is selected in inspector, refresh inspector details
  if (state.selectedCoords) {
    updateInspector();
  }

  requestAnimationFrame(gameLoop);
}

// Session Initialization
async function initSession() {
  const token = api.getToken();
  if (!token) {
    showAuthModal(true);
    return;
  }

  try {
    const data = await api.getFactory();
    state.user = data.user;
    state.simulation.balance = data.balance;
    state.simulation.profitRate = data.profitRate;
    state.simulation.loadGrid(data.grid);
    state.lastSaveTime = data.lastSaved;

    updateHUD();
    state.showToast(`Üdvözlünk újra, ${data.user.username}!`, 'info');

    // Check offline progress
    if (data.offlineProgress && data.offlineProgress.profit > 0) {
      showOfflineModal(data.offlineProgress);
    }
  } catch (err) {
    console.error('Session load failed:', err);
    api.setToken(null);
    showAuthModal(true);
  }
}

// HUD Updates
function updateHUD() {
  const balanceEl = document.getElementById('hudBalance');
  const rateEl = document.getElementById('hudProfitRate');
  const userEl = document.getElementById('hudUsername');
  const saveEl = document.getElementById('saveBadge');

  if (balanceEl) balanceEl.textContent = `$${state.simulation.balance.toLocaleString()}`;
  if (rateEl) rateEl.textContent = `$${state.simulation.profitRate.toFixed(1)}/s`;
  if (userEl) userEl.textContent = state.user ? state.user.username : 'Vendég';
  if (saveEl) {
    if (state.isSaving) {
      saveEl.className = 'save-badge saving';
      saveEl.textContent = 'Mentés...';
    } else {
      saveEl.className = 'save-badge';
      saveEl.textContent = 'Felhőbe mentve';
    }
  }
}

// Setup Canvas Events
function setupCanvasEvents(canvas) {
  canvas.addEventListener('mousemove', (e) => {
    state.hoverCoords = renderer.screenToGrid(e.clientX, e.clientY);
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverCoords = null;
  });

  canvas.addEventListener('click', (e) => {
    const coords = renderer.screenToGrid(e.clientX, e.clientY);
    if (!coords) return;

    handleGridClick(coords.x, coords.y);
  });

  // Right-click rotates direction or clears selection
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    rotateBuildDirection();
  });
}

function handleGridClick(x, y) {
  const tool = state.activeTool;
  const sim = state.simulation;

  if (tool === 'inspect') {
    state.selectedCoords = { x, y };
    state.selectedBuilding = sim.getBuilding(x, y);
    updateInspector();
    return;
  }

  if (tool === 'demolish') {
    const existing = sim.getBuilding(x, y);
    if (!existing) {
      state.showToast('Ez a mező már üres.', 'info');
      return;
    }
    const res = sim.demolish(x, y);
    if (res.success) {
      state.showToast(`Gép elbontva. Visszatérítés: +$${res.refund}`, 'info');
      if (state.selectedCoords && state.selectedCoords.x === x && state.selectedCoords.y === y) {
        state.selectedCoords = null;
        state.selectedBuilding = null;
        updateInspector();
      }
    }
    return;
  }

  // Build tools: miner, conveyor, crafter, seller
  const extra = {};
  if (tool === 'miner') {
    extra.resource = state.selectedResource;
  } else if (tool === 'crafter') {
    extra.recipeId = state.selectedRecipe;
  }

  const res = sim.build(x, y, tool, state.buildDirection, extra);
  if (!res.success) {
    // Acceptance criteria 6 & 7: visually notify user of error
    state.showToast(res.error, 'error');
  } else {
    // Select the newly built machine
    state.selectedCoords = { x, y };
    state.selectedBuilding = res.building;
    updateInspector();
  }
}

// Setup UI Buttons
function setupUI() {
  // Tool selector buttons
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTool = btn.dataset.tool;
      updateOptionsVisibility();
    });
  });

  // Direction buttons
  const dirButtons = document.querySelectorAll('.dir-btn');
  dirButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setBuildDirection(btn.dataset.dir);
    });
  });

  // Resource & Recipe selects
  const resourceSelect = document.getElementById('resourceSelect');
  if (resourceSelect) {
    resourceSelect.addEventListener('change', (e) => {
      state.selectedResource = e.target.value;
    });
  }

  const recipeSelect = document.getElementById('recipeSelect');
  if (recipeSelect) {
    recipeSelect.addEventListener('change', (e) => {
      state.selectedRecipe = e.target.value;
    });
  }

  // Save button
  const saveBtn = document.getElementById('btnSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', manualSave);
  }

  // Logout button
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await manualSave();
      await api.logout();
      state.user = null;
      showAuthModal(true);
    });
  }

  // Auth Modal tabs
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'flex';
      formRegister.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'flex';
    });
  }

  // Form submits
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value.trim();
      const p = document.getElementById('loginPassword').value;
      try {
        const res = await api.login(u, p);
        state.user = res.user;
        showAuthModal(false);
        await initSession();
      } catch (err) {
        state.showToast(err.message, 'error');
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('regUsername').value.trim();
      const p = document.getElementById('regPassword').value;
      try {
        const res = await api.register(u, p);
        state.user = res.user;
        showAuthModal(false);
        await initSession();
      } catch (err) {
        state.showToast(err.message, 'error');
      }
    });
  }

  // Guest button
  const guestBtn = document.getElementById('btnGuest');
  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      const guestName = 'player_' + Math.floor(Math.random() * 9000 + 1000);
      try {
        const res = await api.register(guestName, 'pass1234');
        state.user = res.user;
        showAuthModal(false);
        await initSession();
      } catch (err) {
        state.showToast(err.message, 'error');
      }
    });
  }

  // Claim offline button
  const claimBtn = document.getElementById('btnClaimOffline');
  if (claimBtn) {
    claimBtn.addEventListener('click', async () => {
      try {
        const res = await api.claimOffline();
        if (res.success) {
          state.simulation.balance = res.newBalance;
          state.showToast(`+$${res.claimedAmount.toLocaleString()} offline profit jóváírva!`, 'success');
        }
      } catch (err) {
        state.showToast(err.message, 'error');
      } finally {
        showOfflineModal(null);
      }
    });
  }
}

function setBuildDirection(dir) {
  state.buildDirection = dir;
  const dirButtons = document.querySelectorAll('.dir-btn');
  dirButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.dir === dir);
  });
}

function rotateBuildDirection() {
  const dirs = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
  const nextIdx = (dirs.indexOf(state.buildDirection) + 1) % dirs.length;
  setBuildDirection(dirs[nextIdx]);
}

function updateOptionsVisibility() {
  const resourceBox = document.getElementById('resourceOptionBox');
  const recipeBox = document.getElementById('recipeOptionBox');

  if (resourceBox) resourceBox.style.display = state.activeTool === 'miner' ? 'block' : 'none';
  if (recipeBox) recipeBox.style.display = state.activeTool === 'crafter' ? 'block' : 'none';
}

// Inspector Updates
function updateInspector() {
  const card = document.getElementById('inspectorCard');
  if (!card) return;

  if (!state.selectedCoords) {
    card.innerHTML = `<p style="color: var(--text-dim); font-size: 0.9rem;">Válassz ki egy gépet a játéktéren a részletek megtekintéséhez.</p>`;
    return;
  }

  const { x, y } = state.selectedCoords;
  const b = state.simulation.getBuilding(x, y);

  if (!b) {
    card.innerHTML = `
      <div class="inspector-header">
        <span class="inspector-title">Üres mező</span>
        <span style="font-size: 0.8rem; color: var(--text-dim);">(${x}, ${y})</span>
      </div>
      <p style="color: var(--text-dim); font-size: 0.85rem;">Ezen a mezőn jelenleg nem található gép.</p>
    `;
    return;
  }

  const meta = BUILDINGS[b.type];
  const upgradeCost = getUpgradeCost(b.type, b.level);
  const cycleTime = getAdjustedCycleTime(meta.baseCycleTime, b.level);

  let extraHtml = '';
  if (b.type === 'miner') {
    const itemDef = ITEMS[b.resource];
    extraHtml = `
      <div class="detail-row">
        <span>Bányászott érc:</span>
        <strong style="color: ${itemDef.color}">${itemDef.name} ($${itemDef.value})</strong>
      </div>
      <div class="detail-row">
        <span>Ciklusidő:</span>
        <strong>${cycleTime.toFixed(2)}s</strong>
      </div>
      <div class="detail-row">
        <span>Állapot:</span>
        <strong style="color: ${b.outputSlot ? '#f59e0b' : '#10b981'}">
          ${b.outputSlot ? 'Torlódás (várakozás)' : 'Termelés folyamatban'}
        </strong>
      </div>
    `;
  } else if (b.type === 'crafter') {
    const recipe = RECIPES[b.recipeId];
    const outItem = ITEMS[recipe.output];
    const bufferBars = Object.entries(recipe.inputs).map(([ing, req]) => {
      const cur = b.inputBuffer[ing] || 0;
      const pct = (cur / 4) * 100;
      const ingDef = ITEMS[ing];
      return `
        <div class="buffer-bar-wrapper">
          <div class="buffer-header">
            <span>${ingDef.name} (${cur}/4)</span>
            <span>Szükséges: ${req} db</span>
          </div>
          <div class="buffer-track">
            <div class="buffer-fill" style="width: ${pct}%; background: ${ingDef.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    extraHtml = `
      <div class="detail-row">
        <span>Aktuális recept:</span>
        <strong>${recipe.name} (érték: $${outItem.value})</strong>
      </div>
      <div class="detail-row">
        <span>Gyártási idő:</span>
        <strong>${cycleTime.toFixed(2)}s</strong>
      </div>
      <div class="detail-row">
        <span>Állapot:</span>
        <strong style="color: ${b.outputSlot ? '#f59e0b' : b.isCrafting ? '#10b981' : '#64748b'}">
          ${b.outputSlot ? 'Kimenet blokkolva' : b.isCrafting ? `Gyártás (${Math.floor(b.craftProgress * 100)}%)` : 'Alapanyagra vár'}
        </strong>
      </div>
      <div style="margin-top: 6px;">
        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Bemeneti tároló:</span>
        ${bufferBars}
      </div>
    `;
  } else if (b.type === 'seller') {
    extraHtml = `
      <div class="detail-row">
        <span>Eladási bónusz:</span>
        <strong style="color: #34d399;">+${(b.level - 1) * 10}%</strong>
      </div>
      <div class="detail-row">
        <span>Összes bevétel:</span>
        <strong>$${(b.totalSales || 0).toLocaleString()}</strong>
      </div>
    `;
  }

  const upgradeBtnHtml = upgradeCost !== null ? `
    <button id="btnUpgradeMachine" class="btn-primary" style="width: 100%;">
      🚀 Fejlesztés Szint ${b.level + 1}-re ($${upgradeCost})
    </button>
  ` : `<span style="font-size: 0.8rem; color: #fbbf24; text-align: center;">Maximális szint elérve!</span>`;

  card.innerHTML = `
    <div class="inspector-header">
      <span class="inspector-title">${meta.name}</span>
      <span class="level-badge">Szint ${b.level}</span>
    </div>
    <div class="detail-row">
      <span>Koordináta:</span>
      <strong>(${x}, ${y})</strong>
    </div>
    ${extraHtml}
    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
      ${upgradeBtnHtml}
      <button id="btnDemolishSelected" class="btn-danger" style="width: 100%;">
        🗑️ Lebontás (Visszatérítés: $${Math.floor(meta.baseCost * 0.7)})
      </button>
    </div>
  `;

  // Bind upgrade button
  const upgradeBtn = document.getElementById('btnUpgradeMachine');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      const res = state.simulation.upgrade(x, y);
      if (!res.success) {
        state.showToast(res.error, 'error');
      } else {
        state.showToast(`${meta.name} fejlesztve Szint ${res.level}-re!`, 'success');
        updateInspector();
      }
    });
  }

  // Bind demolish button
  const demolishBtn = document.getElementById('btnDemolishSelected');
  if (demolishBtn) {
    demolishBtn.addEventListener('click', () => {
      const res = state.simulation.demolish(x, y);
      if (res.success) {
        state.showToast(`Gép elbontva. Visszatérítés: +$${res.refund}`, 'info');
        state.selectedCoords = null;
        state.selectedBuilding = null;
        updateInspector();
      }
    });
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'r' || e.key === 'R') {
      rotateBuildDirection();
    } else if (e.key === 's' || e.key === 'S') {
      manualSave();
    } else if (e.key === 'Escape') {
      state.selectedCoords = null;
      state.selectedBuilding = null;
      updateInspector();
    } else if (e.key === '1') {
      selectTool('inspect');
    } else if (e.key === '2') {
      selectTool('miner');
    } else if (e.key === '3') {
      selectTool('conveyor');
    } else if (e.key === '4') {
      selectTool('crafter');
    } else if (e.key === '5') {
      selectTool('seller');
    } else if (e.key === '6') {
      selectTool('demolish');
    }
  });
}

function selectTool(toolName) {
  state.activeTool = toolName;
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.tool === toolName);
  });
  updateOptionsVisibility();
}

// Auto-Save System
function startAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(async () => {
    if (state.user) {
      await manualSave(true);
    }
  }, 15000); // Auto-save every 15s
}

async function manualSave(isSilent = false) {
  if (!state.user) return;
  state.isSaving = true;
  updateHUD();

  try {
    const data = state.simulation.serialize();
    await api.saveFactory(data.balance, data.profitRate, data.grid);
    state.lastSaveTime = Date.now();
    if (!isSilent) {
      state.showToast('Gyár állapota sikeresen elmentve a szerverre!', 'success');
    }
  } catch (err) {
    console.error('Save failed:', err);
    if (!isSilent) {
      state.showToast(`Mentési hiba: ${err.message}`, 'error');
    }
  } finally {
    state.isSaving = false;
    updateHUD();
  }
}

// Modals
function showAuthModal(show) {
  const overlay = document.getElementById('authModalOverlay');
  if (overlay) {
    overlay.classList.toggle('active', show);
  }
}

function showOfflineModal(progress) {
  const overlay = document.getElementById('offlineModalOverlay');
  if (!overlay) return;

  if (!progress) {
    overlay.classList.remove('active');
    return;
  }

  const hours = Math.floor(progress.elapsedSeconds / 3600);
  const minutes = Math.floor((progress.elapsedSeconds % 3600) / 60);

  const amountEl = document.getElementById('offlineProfitAmount');
  const timeEl = document.getElementById('offlineTimeText');
  const cappedEl = document.getElementById('offlineCappedNotice');

  if (amountEl) amountEl.textContent = `+$${progress.profit.toLocaleString()}`;
  if (timeEl) timeEl.textContent = `${hours} óra ${minutes} perc`;
  if (cappedEl) {
    cappedEl.style.display = progress.capped ? 'block' : 'none';
  }

  overlay.classList.add('active');
}
