// public/js/renderer.js - HTML5 Canvas 2D rendering engine

import {
  GRID_WIDTH,
  GRID_HEIGHT,
  ITEMS,
  BUILDINGS,
  DIRECTION_OFFSETS,
  DIRECTIONS
} from '/src/config.js';
import { state } from './state.js';

export class FactoryRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 48;
    this.animTime = 0; // Accumulated time for animations

    this.resize();
  }

  resize() {
    this.canvas.width = GRID_WIDTH * this.tileSize;
    this.canvas.height = GRID_HEIGHT * this.tileSize;
  }

  screenToGrid(canvasX, canvasY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = Math.floor(((canvasX - rect.left) * scaleX) / this.tileSize);
    const y = Math.floor(((canvasY - rect.top) * scaleY) / this.tileSize);

    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      return { x, y };
    }
    return null;
  }

  render(dt = 0.016) {
    this.animTime += dt;
    const ctx = this.ctx;
    const sim = state.simulation;

    // 1. Clear background
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw grid background tiles
    this.drawGridTiles(ctx);

    // 3. Draw placed buildings (except items)
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const b = sim.grid[y][x];
        if (b) {
          this.drawBuilding(ctx, x, y, b);
        }
      }
    }

    // 4. Draw items (on conveyors, miners, crafters)
    this.drawItems(ctx, sim);

    // 5. Draw selection reticle
    if (state.selectedCoords) {
      this.drawSelection(ctx, state.selectedCoords.x, state.selectedCoords.y);
    }

    // 6. Draw ghost hover preview
    if (state.hoverCoords) {
      this.drawHoverPreview(ctx, state.hoverCoords.x, state.hoverCoords.y);
    }

    // 7. Update and draw particles
    this.drawParticles(ctx, dt);
  }

  drawGridTiles(ctx) {
    ctx.strokeStyle = '#1a2433';
    ctx.lineWidth = 1;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        // Subtle tile pattern
        ctx.fillStyle = (x + y) % 2 === 0 ? '#101722' : '#0d131c';
        ctx.fillRect(px, py, this.tileSize, this.tileSize);
        ctx.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
      }
    }
  }

  drawBuilding(ctx, x, y, b) {
    const px = x * this.tileSize;
    const py = y * this.tileSize;
    const size = this.tileSize;
    const center = size / 2;

    ctx.save();
    ctx.translate(px, py);

    if (b.type === 'conveyor') {
      this.drawConveyor(ctx, b, size);
    } else if (b.type === 'miner') {
      this.drawMiner(ctx, b, size);
    } else if (b.type === 'crafter') {
      this.drawCrafter(ctx, b, size);
    } else if (b.type === 'seller') {
      this.drawSeller(ctx, b, size);
    }

    ctx.restore();
  }

  drawConveyor(ctx, b, size) {
    // Belt base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 2, size - 4, size - 4);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);

    // Animated chevron arrows
    const offset = (this.animTime * 30) % 12;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(this.getRotation(b.direction));

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = -16; i <= 16; i += 12) {
      const arrowX = i + offset - 6;
      if (arrowX > -size / 2 + 4 && arrowX < size / 2 - 4) {
        ctx.beginPath();
        ctx.moveTo(arrowX - 4, -8);
        ctx.lineTo(arrowX + 4, 0);
        ctx.lineTo(arrowX - 4, 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawMiner(ctx, b, size) {
    // Machine body
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.roundRect(4, 4, size - 8, size - 8, 6);
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Resource color inner circle
    const resColor = b.resource === 'copper_ore' ? '#c87d55' : '#8a9ba8';
    ctx.fillStyle = resColor;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // Rotating drill indicator
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(this.animTime * 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();

    // Direction arrow
    this.drawDirectionMarker(ctx, b.direction, size, '#60a5fa');

    // Status light
    const isCongested = b.outputSlot !== null;
    ctx.fillStyle = isCongested ? '#f59e0b' : '#10b981';
    ctx.beginPath();
    ctx.arc(size - 8, 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Level tag
    if (b.level > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`L${b.level}`, 6, size - 6);
    }
  }

  drawCrafter(ctx, b, size) {
    // Machine body
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.roundRect(4, 4, size - 8, size - 8, 6);
    ctx.fill();
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crafting progress ring
    if (b.isCrafting) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.craftProgress);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Cog icon
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙️', size / 2, size / 2);

    // Direction marker
    this.drawDirectionMarker(ctx, b.direction, size, '#c7d2fe');

    // Status light
    const isBlocked = b.outputSlot !== null;
    ctx.fillStyle = isBlocked ? '#f59e0b' : b.isCrafting ? '#10b981' : '#64748b';
    ctx.beginPath();
    ctx.arc(size - 8, 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Level tag
    if (b.level > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`L${b.level}`, 6, size - 6);
    }
  }

  drawSeller(ctx, b, size) {
    // Seller body
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(4, 4, size - 8, size - 8, 6);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gold coin / dollar symbol
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', size / 2, size / 2);

    // Glowing border pulse
    const pulse = Math.sin(this.animTime * 3) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.3 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, size - 12, size - 12);

    if (b.level > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`L${b.level}`, 6, size - 6);
    }
  }

  drawDirectionMarker(ctx, direction, size, color) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(this.getRotation(direction));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size / 2 - 2, 0);
    ctx.lineTo(size / 2 - 8, -4);
    ctx.lineTo(size / 2 - 8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  getRotation(direction) {
    switch (direction) {
      case DIRECTIONS.UP:
        return -Math.PI / 2;
      case DIRECTIONS.RIGHT:
        return 0;
      case DIRECTIONS.DOWN:
        return Math.PI / 2;
      case DIRECTIONS.LEFT:
        return Math.PI;
      default:
        return 0;
    }
  }

  drawItems(ctx, sim) {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const b = sim.grid[y][x];
        if (!b) continue;

        // 1. Conveyor items
        if (b.type === 'conveyor' && b.item) {
          const offset = DIRECTION_OFFSETS[b.direction];
          const progress = Math.min(1.0, b.item.progress);
          const px = (x + 0.5 + offset.dx * (progress - 0.5)) * this.tileSize;
          const py = (y + 0.5 + offset.dy * (progress - 0.5)) * this.tileSize;
          this.drawSingleItem(ctx, px, py, b.item.itemId);
        }

        // 2. Miner outputSlot
        if (b.type === 'miner' && b.outputSlot) {
          const offset = DIRECTION_OFFSETS[b.direction];
          const px = (x + 0.5 + offset.dx * 0.4) * this.tileSize;
          const py = (y + 0.5 + offset.dy * 0.4) * this.tileSize;
          this.drawSingleItem(ctx, px, py, b.outputSlot.itemId);
        }

        // 3. Crafter outputSlot
        if (b.type === 'crafter' && b.outputSlot) {
          const offset = DIRECTION_OFFSETS[b.direction];
          const px = (x + 0.5 + offset.dx * 0.4) * this.tileSize;
          const py = (y + 0.5 + offset.dy * 0.4) * this.tileSize;
          this.drawSingleItem(ctx, px, py, b.outputSlot.itemId);
        }
      }
    }
  }

  drawSingleItem(ctx, cx, cy, itemId) {
    const itemDef = ITEMS[itemId] || { color: '#ffffff', glow: '#ffffff' };

    ctx.save();
    // Item shadow / glow
    ctx.shadowColor = itemDef.glow;
    ctx.shadowBlur = 8;

    ctx.fillStyle = itemDef.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawSelection(ctx, x, y) {
    const px = x * this.tileSize;
    const py = y * this.tileSize;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
  }

  drawHoverPreview(ctx, x, y) {
    const tool = state.activeTool;
    if (tool === 'inspect') {
      const px = x * this.tileSize;
      const py = y * this.tileSize;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
      return;
    }

    const sim = state.simulation;
    const existing = sim.getBuilding(x, y);

    if (tool === 'demolish') {
      const px = x * this.tileSize;
      const py = y * this.tileSize;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, this.tileSize, this.tileSize);
      return;
    }

    const buildingMeta = BUILDINGS[tool];
    if (!buildingMeta) return;

    const canAfford = sim.balance >= buildingMeta.baseCost;
    const isFree = existing === null;
    const isValid = canAfford && isFree;

    const px = x * this.tileSize;
    const py = y * this.tileSize;

    ctx.fillStyle = isValid ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.35)';
    ctx.fillRect(px, py, this.tileSize, this.tileSize);

    ctx.strokeStyle = isValid ? '#3b82f6' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, this.tileSize, this.tileSize);

    // Draw ghost direction indicator
    if (tool !== 'seller') {
      this.drawDirectionMarker(ctx, state.buildDirection, this.tileSize, isValid ? '#93c5fd' : '#fca5a5');
    }
  }

  drawParticles(ctx, dt) {
    ctx.save();
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.y -= dt * 25; // Move upward
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}
