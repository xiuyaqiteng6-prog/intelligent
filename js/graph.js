// graph.js — 力学モデルによるグラフレイアウトと Canvas 描画

import { CATEGORIES } from './data.js';

const CORE_COLOR = '#c9b6ff';

export class GraphView {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.width = 0;
    this.height = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.camera = { x: 0, y: 0, scale: 1 };
    this.selectedId = 'core';
    this.filterCategory = null; // null = 全て
    this.onSelect = null;
    this.onCoreClick = null;
    this.particles = [];

    this._drag = null;
    this._pan = null;
    this._bindEvents();
    this.resize();
  }

  setState(state) {
    this.state = state;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      const p = this._toWorld(this._localPos(e));
      const hit = this._hitTest(p);
      if (hit) {
        this._drag = { id: hit.id, offX: hit.x - p.x, offY: hit.y - p.y };
      } else {
        this._pan = { startX: e.clientX, startY: e.clientY, camX: this.camera.x, camY: this.camera.y };
      }
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (this._drag) {
        const p = this._toWorld(this._localPos(e));
        const node = this.state.nodes.find((n) => n.id === this._drag.id);
        if (node) { node.x = p.x + this._drag.offX; node.y = p.y + this._drag.offY; node.vx = 0; node.vy = 0; }
      } else if (this._pan) {
        const dx = (e.clientX - this._pan.startX) / this.camera.scale;
        const dy = (e.clientY - this._pan.startY) / this.camera.scale;
        this.camera.x = this._pan.camX - dx;
        this.camera.y = this._pan.camY - dy;
      }
    });
    const endDrag = (e) => {
      if (this._drag) {
        const p = this._toWorld(this._localPos(e));
        const hit = this._hitTest(p);
        if (hit && hit.id === this._drag.id) {
          this.selectedId = hit.id;
          if (this.onSelect) this.onSelect(hit.id);
          if (hit.id === 'core' && this.onCoreClick) this.onCoreClick();
        }
      }
      this._drag = null;
      this._pan = null;
    };
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', endDrag);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      this.camera.scale = Math.max(0.35, Math.min(2.5, this.camera.scale * factor));
    }, { passive: false });
    window.addEventListener('resize', () => this.resize());
  }

  _localPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _toWorld(local) {
    return {
      x: (local.x - this.width / 2) / this.camera.scale + this.camera.x,
      y: (local.y - this.height / 2) / this.camera.scale + this.camera.y,
    };
  }

  _toScreen(x, y) {
    return {
      x: (x - this.camera.x) * this.camera.scale + this.width / 2,
      y: (y - this.camera.y) * this.camera.scale + this.height / 2,
    };
  }

  _hitTest(worldPos) {
    const nodes = this.state.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const rad = this._radius(n) + 4;
      const dx = n.x - worldPos.x, dy = n.y - worldPos.y;
      if (dx * dx + dy * dy <= rad * rad) return n;
    }
    return null;
  }

  _radius(n) {
    if (n.category === 'core') return 22;
    return 9 + Math.min(6, (n.mastery || 1) * 1.2);
  }

  focusOn(id) {
    const n = this.state.nodes.find((x) => x.id === id);
    if (n) { this.camera.x = n.x; this.camera.y = n.y; }
  }

  // なでた時などに呼ぶキラキラ演出
  spawnSparkles(worldX, worldY, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      this.particles.push({
        x: worldX, y: worldY,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, maxLife: 0.6 + Math.random() * 0.5,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  _stepParticles(dtSeconds) {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      p.life += dtSeconds;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  // --- 物理シミュレーション(簡易フォースレイアウト) ---
  step(dt) {
    this._stepParticles(dt / 60);
    const nodes = this.state.nodes;
    const edges = this.state.edges;
    if (nodes.length < 2) return;
    const repulsion = 12000;
    const springLen = 80;
    const springK = 0.03;
    const damping = 0.85;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      let fx = 0, fy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) distSq = 1;
        const dist = Math.sqrt(distSq);
        const force = repulsion / distSq;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      // コアは常に中心に留まる。他のノードはバネと反発力だけで自然に配置される。
      if (a.category === 'core') {
        a.x += (0 - a.x) * 0.12;
        a.y += (0 - a.y) * 0.12;
      }
      a._fx = fx; a._fy = fy;
    }
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.a);
      const b = nodes.find((n) => n.id === e.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const diff = (dist - springLen) * springK;
      const fx = (dx / dist) * diff, fy = (dy / dist) * diff;
      if (a.category !== 'core') { a._fx += fx; a._fy += fy; }
      if (b.category !== 'core') { b._fx -= fx; b._fy -= fy; }
    }
    const maxSpeed = 40;
    for (const n of nodes) {
      if (n.category === 'core') { n.vx = 0; n.vy = 0; continue; }
      n.vx = (n.vx + (n._fx || 0) * dt) * damping;
      n.vy = (n.vy + (n._fy || 0) * dt) * damping;
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > maxSpeed) { n.vx = (n.vx / speed) * maxSpeed; n.vy = (n.vy / speed) * maxSpeed; }
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }
  }

  draw(t) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(dpr, dpr);

    // 背景グリッド
    ctx.fillStyle = '#16151c';
    ctx.fillRect(0, 0, this.width, this.height);
    this._drawGrid();

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.scale, this.camera.scale);
    ctx.translate(-this.camera.x, -this.camera.y);

    // エッジ
    const EDGE_HIGHLIGHT_MS = 2500;
    for (const e of this.state.edges) {
      const a = this.state.nodes.find((n) => n.id === e.a);
      const b = this.state.nodes.find((n) => n.id === e.b);
      if (!a || !b) continue;
      const age = e.addedAt ? Date.now() - e.addedAt : Infinity;
      if (age < EDGE_HIGHLIGHT_MS) {
        const fade = 1 - age / EDGE_HIGHLIGHT_MS;
        ctx.lineWidth = (1 + fade * 2) / this.camera.scale;
        ctx.strokeStyle = `rgba(201,182,255,${0.25 + fade * 0.65})`;
      } else {
        const highlight = this.filterCategory && (a.category === this.filterCategory || b.category === this.filterCategory);
        ctx.lineWidth = 1 / this.camera.scale;
        ctx.strokeStyle = highlight ? 'rgba(200,182,255,0.55)' : 'rgba(150,150,170,0.18)';
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // ノード
    for (const n of this.state.nodes) {
      const dimmed = this.filterCategory && n.category !== 'core' && n.category !== this.filterCategory;
      const color = n.category === 'core' ? CORE_COLOR : (CATEGORIES[n.category]?.color || '#999');
      const r = this._radius(n);
      const selected = n.id === this.selectedId;

      if (n.category === 'core') {
        const pulse = 1 + Math.sin(t / 700) * 0.05;
        const glowR = r * 2.4 * pulse;
        const grad = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, glowR);
        grad.addColorStop(0, 'rgba(201,182,255,0.35)');
        grad.addColorStop(1, 'rgba(201,182,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = dimmed ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (selected) {
        ctx.lineWidth = 2 / this.camera.scale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      if (this.camera.scale > 0.55 || n.category === 'core' || selected) {
        ctx.globalAlpha = dimmed ? 0.25 : 0.92;
        ctx.fillStyle = '#e7e5f0';
        ctx.font = `${n.category === 'core' ? 'bold ' : ''}${12 / this.camera.scale}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + r + 13 / this.camera.scale);
      }
      ctx.globalAlpha = 1;
    }

    // パーティクル(なでた時のキラキラ)
    for (const p of this.particles) {
      const fade = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = '#e6d9ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    ctx.restore();
  }

  _drawGrid() {
    const ctx = this.ctx;
    const spacing = 42 * this.camera.scale;
    const offX = (this.width / 2 - this.camera.x * this.camera.scale) % spacing;
    const offY = (this.height / 2 - this.camera.y * this.camera.scale) % spacing;
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offX; x < this.width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
    for (let y = offY; y < this.height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
    ctx.stroke();
  }
}
