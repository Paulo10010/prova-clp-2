import * as THREE from 'three';

/** Textura procedural do painel: 5 módulos ao longo do eixo, células monocristalinas. */
export function criarTexturaPainel(modulos = 5, colunas = 6, linhas = 10): THREE.CanvasTexture {
  const W = 512;
  const H = Math.round((W * 5.0) / 2.2); // proporção do painel (2,2 m × 5,0 m)
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  g.fillStyle = '#c9ced4'; // moldura de alumínio
  g.fillRect(0, 0, W, H);

  const gap = 6;
  const modH = (H - gap * (modulos + 1)) / modulos;
  for (let m = 0; m < modulos; m++) {
    const y0 = gap + m * (modH + gap);
    const x0 = gap;
    const modW = W - 2 * gap;
    g.fillStyle = '#0d1626';
    g.fillRect(x0, y0, modW, modH);

    const cw = modW / colunas;
    const ch = modH / linhas;
    for (let i = 0; i < colunas; i++) {
      for (let j = 0; j < linhas; j++) {
        const cx = x0 + i * cw + 1.5;
        const cy = y0 + j * ch + 1.5;
        const grad = g.createLinearGradient(cx, cy, cx + cw, cy + ch);
        grad.addColorStop(0, '#1b2f52');
        grad.addColorStop(1, '#11203b');
        g.fillStyle = grad;
        g.fillRect(cx, cy, cw - 3, ch - 3);
        // cantos cortados (célula mono)
        g.fillStyle = '#0d1626';
        const k = 3;
        g.fillRect(cx, cy, k, k); g.fillRect(cx + cw - 3 - k, cy, k, k);
        g.fillRect(cx, cy + ch - 3 - k, k, k); g.fillRect(cx + cw - 3 - k, cy + ch - 3 - k, k, k);
        // busbars
        g.fillStyle = 'rgba(200,210,225,0.35)';
        for (let b = 1; b <= 3; b++) g.fillRect(cx + ((cw - 3) * b) / 4, cy, 1, ch - 3);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Faixas na escova para a rotação ficar visível. */
export function criarTexturaEscova(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#1f7a8c' : '#2fa3b5';
    g.fillRect(i * 16, 0, 16, 32);
  }
  g.fillStyle = '#f2b43c';
  g.fillRect(0, 0, 10, 32); // marca de referência
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Grama procedural: base verde com manchas e folhas curtas, para repetir no chão. */
export function criarTexturaGrama(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;

  g.fillStyle = '#4f8a2f';
  g.fillRect(0, 0, S, S);

  // manchas claras/escuras para quebrar a repetição
  const tons = ['#5c9a36', '#447a28', '#62a33c', '#3f7225'];
  for (let i = 0; i < 60; i++) {
    g.fillStyle = tons[i % tons.length];
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 18, 0, Math.PI * 2);
    g.fill();
  }

  // folhas
  g.globalAlpha = 0.8;
  g.lineWidth = 1;
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const l = 2 + Math.random() * 4;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    g.strokeStyle = Math.random() < 0.5 ? '#6db544' : '#386a20';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 20);
  t.anisotropy = 8;
  return t;
}
