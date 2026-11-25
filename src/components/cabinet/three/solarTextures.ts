import * as THREE from 'three';
import type { Solar3DTelemetry } from '../../../lib/solar3dModel.ts';

export interface InverterLcdHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export function createSolarCellTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep monocrystalline navy-indigo silicon background
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#0b1830');
    grad.addColorStop(0.5, '#102446');
    grad.addColorStop(1, '#09152b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const cols = 6;
    const rows = 10;
    const cellW = 512 / cols;
    const cellH = 512 / rows;

    // Individual half-cut cells + fine silver busbars
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;

        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(28, 63, 118, 0.24)' : 'rgba(12, 32, 68, 0.22)';
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

        // Micro busbars inside each silicon wafer
        ctx.strokeStyle = 'rgba(186, 212, 245, 0.28)';
        ctx.lineWidth = 1;
        for (let b = 1; b <= 3; b++) {
          const bx = x + (cellW * b) / 4;
          ctx.beginPath();
          ctx.moveTo(bx, y + 3);
          ctx.lineTo(bx, y + cellH - 3);
          ctx.stroke();
        }
      }
    }

    // Crisp silver cell grid gaps
    ctx.strokeStyle = '#6d8bb0';
    ctx.lineWidth = 2;
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * cellW);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * cellH);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Center half-cut module divider bus
    ctx.fillStyle = '#9db4cf';
    ctx.fillRect(0, 253, 512, 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createGroundGridTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#dce5ee';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(23, 105, 170, 0.08)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let i = 0; i <= 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(13, 31, 51, 0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(9, 20, 36, 0.42)');
    grad.addColorStop(0.55, 'rgba(9, 20, 36, 0.16)');
    grad.addColorStop(1, 'rgba(9, 20, 36, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createInverterLcdHandle(anisotropy: number): InverterLcdHandle {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return { canvas, ctx, texture };
}

export function updateInverterLcdCanvas(
  handle: InverterLcdHandle,
  telemetry: Solar3DTelemetry,
): void {
  const { ctx, canvas, texture } = handle;
  const w = canvas.width;
  const h = canvas.height;

  // Crisp industrial OLED screen background
  ctx.fillStyle = '#071422';
  ctx.fillRect(0, 0, w, h);

  // Subtle screen bezel line
  ctx.strokeStyle = telemetry.mode === 'blackout' ? '#f59e0b' : '#22d3ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Top status bar
  ctx.fillStyle = telemetry.mode === 'blackout' ? '#f59e0b' : '#0ea5e9';
  ctx.fillRect(16, 16, w - 32, 54);

  ctx.fillStyle = '#061220';
  ctx.font = 'bold 24px monospace';
  const modeLabel =
    telemetry.mode === 'blackout'
      ? 'UPS BACKUP · OFF-GRID'
      : telemetry.mode === 'night'
        ? 'NIGHT DISCHARGE'
        : 'HYBRID SOLAR · ON-GRID';
  ctx.fillText(modeLabel, 28, 51);

  // 4 live metric tiles inside the 3D LCD display
  const tiles: Array<{ label: string; value: string; color: string; x: number; y: number }> = [
    {
      label: 'PV ARRAY',
      value: `${telemetry.pvKw.toFixed(1)} kW`,
      color: '#fbbf24',
      x: 22,
      y: 92,
    },
    {
      label: 'HOME LOAD',
      value: `${telemetry.loadKw.toFixed(1)} kW`,
      color: '#38bdf8',
      x: 264,
      y: 92,
    },
    {
      label: 'LiFePO4 SOC',
      value: `${telemetry.batterySocPct}%`,
      color: '#34d399',
      x: 22,
      y: 226,
    },
    {
      label: telemetry.gridOnline ? 'GRID FLOW' : 'AUTONOMY',
      value: telemetry.gridOnline
        ? `${telemetry.gridFlowKw > 0 ? '+' : ''}${telemetry.gridFlowKw.toFixed(1)} kW`
        : `${telemetry.autonomyHours.toFixed(1)} h`,
      color: telemetry.gridOnline ? '#a78bfa' : '#fb923c',
      x: 264,
      y: 226,
    },
  ];

  for (const tile of tiles) {
    ctx.fillStyle = '#0f243a';
    ctx.fillRect(tile.x, tile.y, 224, 114);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tile.x, tile.y, 224, 114);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(tile.label, tile.x + 16, tile.y + 34);

    ctx.fillStyle = tile.color;
    ctx.font = 'bold 42px monospace';
    ctx.fillText(tile.value, tile.x + 16, tile.y + 92);
  }

  // Bottom bar with battery flow sign
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px monospace';
  const batDir =
    telemetry.batteryFlowKw >= 0.05
      ? `BAT CHG +${telemetry.batteryFlowKw.toFixed(1)} kW`
      : telemetry.batteryFlowKw <= -0.05
        ? `BAT DIS ${telemetry.batteryFlowKw.toFixed(1)} kW`
        : 'BAT STANDBY 0.0 kW';
  ctx.fillText(batDir, 24, 366);

  texture.needsUpdate = true;
}
