import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  MODE_TARGET_PHASE,
  normalizeCyclePhase,
  sampleSolarCycleState,
  SYSTEM_MODES,
  SYSTEM_NODES,
  type SystemFlowMode,
  type SystemModeInfo,
  type SystemNodeId,
} from '../lib/howItWorksNodes.ts';
import { tr } from '../lib/i18n.ts';

interface HowItWorks3DCanvasProps {
  selectedNodeId: SystemNodeId;
  activeMode: SystemFlowMode;
  onSelectNode: (id: SystemNodeId) => void;
  onSelectMode: (mode: SystemFlowMode) => void;
}

const NODE_CAMERA_TARGETS: Record<SystemNodeId, { target: [number, number, number]; camOffset: [number, number, number] }> = {
  panels: { target: [-1.4, 0.85, -0.5], camOffset: [-2.0, 5.2, 7.8] },
  inverter: { target: [0.0, 0.95, -0.1], camOffset: [0.2, 4.4, 7.6] },
  battery: { target: [-1.2, 0.65, 0.7], camOffset: [-2.4, 4.2, 7.4] },
  loads: { target: [1.4, 0.85, 0.6], camOffset: [2.4, 4.6, 7.6] },
  grid: { target: [1.5, 0.95, -0.7], camOffset: [3.2, 4.9, 7.2] },
};

const DEFAULT_CAMERA_POS = new THREE.Vector3(0.4, 5.4, 9.2);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.65, 0);

// Reusable pre-allocated math objects (zero GC inside render loop)
const _v3 = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _vCamTarget = new THREE.Vector3();
const _vSunDir = new THREE.Vector3();
const _cBg = new THREE.Color();
const _cSkyZenith = new THREE.Color();
const _cKey = new THREE.Color();
const _cHemiSky = new THREE.Color();
const _cHemiGround = new THREE.Color();
const _cRim = new THREE.Color();
const _cSun = new THREE.Color();
const _cSunGlow = new THREE.Color();
const CYCLE_DURATION_SECONDS = 24;

function detectSoftwareWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') {
    return { supported: false, isSoftwareGl: true };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      return { supported: false, isSoftwareGl: true };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

function createSolarCellTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Authentic N-Type All-Black / Deep Navy Monocrystalline gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#061124');
  grad.addColorStop(0.5, '#0b1e3f');
  grad.addColorStop(1, '#050d1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Half-cut cell layout (6 cols x 12 half-cell rows with center split gap)
  const cols = 6;
  const rows = 12;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  // Fine multi-busbars (5 silver ribbons per wafer column)
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.24)';
  ctx.lineWidth = 1;
  for (let c = 0; c < cols; c++) {
    for (let b = 1; b <= 4; b++) {
      const bx = c * cellW + (cellW * b) / 5;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, 512);
      ctx.stroke();
    }
  }

  // Inter-cell backsheet grid lines
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellW, 0);
    ctx.lineTo(c * cellW, 512);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellH);
    ctx.lineTo(512, r * cellH);
    ctx.stroke();
  }

  // Signature diamond corner chamfers at wafer intersections
  ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
  for (let c = 1; c < cols; c++) {
    for (let r = 1; r < rows; r++) {
      const cx = c * cellW;
      const cy = r * cellH;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3.5);
      ctx.lineTo(cx + 3.5, cy);
      ctx.lineTo(cx, cy + 3.5);
      ctx.lineTo(cx - 3.5, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Central horizontal half-cut busbar ribbon across row 6
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.fillRect(0, 253, 512, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createGlowSpriteTexture(innerHex: string, midHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.35, midHex);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Authentic Deye Circular Silver Medallion + 4-Quadrant Color Touchscreen LCD
function drawDeyeMedallionCanvas(canvas: HTMLCanvasElement, mode: SystemFlowMode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = 512;
  ctx.clearRect(0, 0, size, size);

  // Brushed metallic aluminum faceplate base
  const metalGrad = ctx.createLinearGradient(0, 0, size, size);
  metalGrad.addColorStop(0, '#e2e8f0');
  metalGrad.addColorStop(0.45, '#cbd5e1');
  metalGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = metalGrad;
  ctx.beginPath();
  ctx.arc(256, 256, 252, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Signature Deye Brand Logo (blue "Deye" + red dot accent)
  ctx.fillStyle = '#0f4c81';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Deye', 262, 86);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(200, 50, 9, 9);

  // 4 Status LEDs: DC, AC, Normal, Alarm
  const isBlackout = mode === 'blackout';
  const leds: Array<{ label: string; x: number; color: string }> = [
    { label: 'DC', x: 148, color: '#22c55e' },
    { label: 'AC', x: 218, color: isBlackout ? '#1e293b' : '#22c55e' },
    { label: 'Normal', x: 294, color: isBlackout ? '#1e293b' : '#22c55e' },
    { label: 'Alarm', x: 366, color: isBlackout ? '#ef4444' : '#1e293b' },
  ];
  ctx.font = 'bold 14px sans-serif';
  for (const led of leds) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(led.x, 114, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = led.color;
    ctx.beginPath();
    ctx.arc(led.x, 114, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillText(led.label, led.x, 136);
  }

  // Inner LCD Touchscreen Bezel
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(114, 152, 284, 198);
  ctx.fillStyle = '#ecfeff';
  ctx.fillRect(120, 158, 272, 186);

  const telemetry: Record<
    SystemFlowMode,
    { pv: string; grid: string; batPct: string; batKw: string; load: string; status: string; statusCol: string }
  > = {
    day_solar: { pv: '8.4 kW', grid: '+2.8 kW', batPct: '92%', batKw: '+2.4 kW', load: '3.2 kW', status: 'ON', statusCol: '#16a34a' },
    evening_battery: { pv: '0.0 kW', grid: '0.0 kW', batPct: '68%', batKw: '-3.4 kW', load: '3.4 kW', status: 'BAT', statusCol: '#ea580c' },
    blackout: { pv: '2.1 kW', grid: 'OFF', batPct: '74%', batKw: '-1.5 kW', load: '3.6 kW', status: 'UPS', statusCol: '#dc2626' },
    night_tariff: { pv: '0.0 kW', grid: '-4.5 kW', batPct: '45%', batKw: '+3.1 kW', load: '1.4 kW', status: 'CHG', statusCol: '#2563eb' },
  };
  const info = telemetry[mode];

  // Top status bar inside Deye LCD
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SOLAR HYBRID', 130, 176);
  ctx.textAlign = 'right';
  ctx.fillText(mode === 'blackout' ? 'BACKUP <10ms' : '230V 50Hz', 382, 176);

  // Dashed flow lines to central circle
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(192, 222);
  ctx.lineTo(320, 222);
  ctx.moveTo(192, 294);
  ctx.lineTo(320, 294);
  ctx.moveTo(256, 222);
  ctx.lineTo(256, 294);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center status circle ("ON" / "UPS")
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(256, 258, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = info.statusCol;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = info.statusCol;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(info.status, 256, 263);

  // 4 Quadrant Gauges (Solar, Grid, Battery, Load)
  const drawQuad = (cx: number, cy: number, title: string, val: string, ringCol: string) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, cy - 4);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(val, cx, cy + 12);
  };

  drawQuad(166, 218, 'PV', info.pv, '#f59e0b');
  drawQuad(346, 218, 'GRID', info.grid, isBlackout ? '#ef4444' : '#6366f1');
  drawQuad(166, 298, `BAT ${info.batPct}`, info.batKw, '#10b981');
  drawQuad(346, 298, 'HOME', info.load, '#0284c7');

  // 4 Tactile Deye Buttons below LCD (Esc, Up, Down, Enter)
  const keys = [
    { label: 'Esc', x: 162, y: 396 },
    { label: '▲', x: 256, y: 374 },
    { label: '▼', x: 256, y: 422 },
    { label: 'OK', x: 350, y: 396 },
  ];
  for (const k of keys) {
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.fillRect(k.x - 20, k.y - 16, 40, 32);
    ctx.strokeRect(k.x - 20, k.y - 16, 40, 32);
    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(k.label, k.x, k.y + 5);
  }
}

// Authentic Round Deye Battery Cabinet Front OLED Dial (from backup_deye_8kw.jpg)
function drawBatteryDialCanvas(canvas: HTMLCanvasElement, mode: SystemFlowMode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#09111f';
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  const socMap: Record<SystemFlowMode, { pct: number; label: string; col: string }> = {
    day_solar: { pct: 92, label: 'CHG', col: '#38bdf8' },
    evening_battery: { pct: 68, label: 'DIS', col: '#10b981' },
    blackout: { pct: 74, label: 'UPS', col: '#f59e0b' },
    night_tariff: { pct: 45, label: 'CHG', col: '#60a5fa' },
  };
  const state = socMap[mode];

  // Glowing outer SOC ring
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = state.col;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 96, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * state.pct) / 100);
  ctx.stroke();

  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Deye', 128, 86);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px monospace';
  ctx.fillText(`${state.pct}%`, 128, 146);

  ctx.fillStyle = state.col;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`LiFePO4 · ${state.label}`, 128, 184);
}

// Bidirectional Smart Meter LCD Readout
function drawMeterLcdCanvas(canvas: HTMLCanvasElement, mode: SystemFlowMode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isOffline = mode === 'blackout';
  ctx.fillStyle = isOffline ? '#2b0b12' : '#082032';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = isOffline ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 154);

  const labelMap: Record<SystemFlowMode, { top: string; mid: string; sub: string; col: string }> = {
    day_solar: { top: 'NET BILLING', mid: '+2.80 kW', sub: 'EXPORT -> GRID', col: '#34d399' },
    evening_battery: { top: 'SMART METER', mid: '0.00 kW', sub: 'ZERO GRID USE', col: '#93c5fd' },
    blackout: { top: 'LINE FAULT', mid: 'OFFLINE', sub: 'ISOLATED <10ms', col: '#f87171' },
    night_tariff: { top: 'TARIFF 2.16', mid: '-4.50 kW', sub: 'NIGHT CHARGE', col: '#60a5fa' },
  };
  const info = labelMap[mode];

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(info.top, 128, 38);

  ctx.fillStyle = info.col;
  ctx.font = 'bold 38px monospace';
  ctx.fillText(info.mid, 128, 94);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(info.sub, 128, 134);
}

// DIN-Rail Electrical Distribution Breaker Panel Texture
function createBreakerPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 256, 320);

  // Dark inner DIN rail recess
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(18, 22, 220, 276);

  // 2 rows of realistic DIN miniature circuit breakers (MCB + surge SPD)
  const rows = [48, 174];
  const mcbColors = ['#2563eb', '#2563eb', '#dc2626', '#f59e0b', '#16a34a'];
  for (const ry of rows) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(24, ry + 34, 208, 10);
    for (let i = 0; i < 5; i++) {
      const mx = 28 + i * 41;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(mx, ry, 36, 86);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx, ry, 36, 86);
      // Colored MCB toggle lever
      ctx.fillStyle = mcbColors[i];
      ctx.fillRect(mx + 6, ry + 34, 24, 14);
      // Green ON indicator window
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(mx + 13, ry + 18, 10, 8);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createDynamicCanvasTexture(
  w: number,
  h: number,
  maxAnisotropy: number,
  drawFn: (canvas: HTMLCanvasElement, mode: SystemFlowMode) => void,
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawFn(canvas, 'day_solar');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return { canvas, texture };
}

function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#102236';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 2;
  const step = 64;
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

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 126);
  grad.addColorStop(0, 'rgba(3, 8, 18, 0.72)');
  grad.addColorStop(0.65, 'rgba(3, 8, 18, 0.25)');
  grad.addColorStop(1, 'rgba(3, 8, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function HowItWorks3DCanvas({
  selectedNodeId,
  activeMode,
  onSelectNode,
  onSelectMode,
}: HowItWorks3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [autoCycle, setAutoCycle] = useState(() =>
    typeof window !== 'undefined'
      ? !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      : true,
  );

  const selectedNodeRef = useRef<SystemNodeId>(selectedNodeId);
  selectedNodeRef.current = selectedNodeId;

  const activeModeRef = useRef<SystemFlowMode>(activeMode);
  activeModeRef.current = activeMode;

  const autoCycleRef = useRef(autoCycle);
  autoCycleRef.current = autoCycle;

  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;

  const onSelectModeRef = useRef(onSelectMode);
  onSelectModeRef.current = onSelectMode;

  const clockLabelRef = useRef<HTMLSpanElement | null>(null);
  const resetCameraFnRef = useRef<(() => void) | null>(null);
  const focusNodeFnRef = useRef<((nodeId: SystemNodeId) => void) | null>(null);

  useEffect(() => {
    focusNodeFnRef.current?.(selectedNodeId);
  }, [selectedNodeId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const probe = detectSoftwareWebGL();
    if (!probe.supported) {
      setWebglUnavailable(true);
      return;
    }

    const isSoftwareGl = probe.isSoftwareGl;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let frameId = 0;
    let disposed = false;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute(
      'aria-label',
      tr('Інтерактивна 3D-схема сонячної електростанції та резервного живлення', 'Интерактивная 3D-схема солнечной электростанции и резервного питания'),
    );

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const initialCyclePhase = 0.14; // Start in crisp morning sunlight rising toward noon
    let cyclePhase = initialCyclePhase;
    const initialAtm = sampleSolarCycleState(
      initialCyclePhase,
      activeModeRef.current === 'blackout',
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialAtm.skyHorizonHex);
    scene.fog = new THREE.FogExp2(initialAtm.skyHorizonHex, 0.02);
    scene.environmentIntensity = initialAtm.envIntensity;

    // Studio reflection environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const initialFov = width < 520 ? 52 : width < 768 ? 46 : 40;
    const camera = new THREE.PerspectiveCamera(initialFov, width / height, 0.1, 80);
    camera.position.copy(DEFAULT_CAMERA_POS);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 5.4;
    controls.maxDistance = 14.5;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.update();

    // Lighting rig (<= 3 shadow casters: dynamic sun/moon key + sky/ground hemi + rim)
    const hemiLight = new THREE.HemisphereLight(
      initialAtm.hemiSkyHex,
      initialAtm.hemiGroundHex,
      initialAtm.hemiIntensity,
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(initialAtm.keyHex, initialAtm.keyIntensity);
    keyLight.position.set(...initialAtm.lightPos);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -7.5;
    keyLight.shadow.camera.right = 7.5;
    keyLight.shadow.camera.top = 7.5;
    keyLight.shadow.camera.bottom = -7.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(initialAtm.rimHex, initialAtm.rimIntensity);
    rimLight.position.set(-7, 4.5, -6);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [envTarget];
    const trackDisp = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // Procedural Sky Gradient Dome (smooth day azure -> warm dusk -> deep midnight blue)
    const skyDomeGeo = trackDisp(new THREE.SphereGeometry(36, 28, 18));
    const skyDomeMat = trackDisp(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenithColor: { value: new THREE.Color(initialAtm.skyZenithHex) },
          uHorizonColor: { value: new THREE.Color(initialAtm.skyHorizonHex) },
          uSunDir: { value: new THREE.Vector3(...initialAtm.sunPos).normalize() },
          uSunGlowColor: { value: new THREE.Color(initialAtm.sunGlowHex) },
          uSunGlowStrength: { value: initialAtm.sunGlowStrength },
        },
        vertexShader: `
          varying vec3 vWorldDir;
          void main() {
            vWorldDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uZenithColor;
          uniform vec3 uHorizonColor;
          uniform vec3 uSunDir;
          uniform vec3 uSunGlowColor;
          uniform float uSunGlowStrength;
          varying vec3 vWorldDir;
          void main() {
            vec3 dir = normalize(vWorldDir);
            float h = clamp(dir.y * 1.15, 0.0, 1.0);
            vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.62));
            float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
            col += uSunGlowColor * pow(sunDot, 10.0) * uSunGlowStrength;
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDome);

    const solarTex = trackDisp(createSolarCellTexture(maxAniso));
    const screenRes = createDynamicCanvasTexture(512, 512, maxAniso, drawDeyeMedallionCanvas);
    const screenTex = trackDisp(screenRes.texture);
    const batDialRes = createDynamicCanvasTexture(256, 256, maxAniso, drawBatteryDialCanvas);
    const batDialTex = trackDisp(batDialRes.texture);
    const meterLcdRes = createDynamicCanvasTexture(256, 160, maxAniso, drawMeterLcdCanvas);
    const meterLcdTex = trackDisp(meterLcdRes.texture);
    const breakerTex = trackDisp(createBreakerPanelTexture(maxAniso));
    const floorTex = trackDisp(createFloorGridTexture(maxAniso));
    const shadowTex = trackDisp(createContactShadowTexture());
    const sunHaloTex = trackDisp(createGlowSpriteTexture('rgba(254, 240, 138, 0.95)', 'rgba(245, 158, 11, 0.42)'));
    const moonHaloTex = trackDisp(createGlowSpriteTexture('rgba(219, 234, 254, 0.88)', 'rgba(96, 165, 250, 0.3)'));

    // Celestial Sky Elements: Sun, Moon, Starfield, Solar Photon Streams
    const sunGroup = new THREE.Group();
    sunGroup.position.set(...initialAtm.sunPos);
    const sunCoreMat = trackDisp(
      new THREE.MeshBasicMaterial({
        color: initialAtm.sunHex,
        transparent: true,
        opacity: initialAtm.sunOpacity,
      }),
    );
    const sunCore = new THREE.Mesh(trackDisp(new THREE.SphereGeometry(0.46, 20, 20)), sunCoreMat);
    const sunHaloMat = trackDisp(
      new THREE.SpriteMaterial({
        map: sunHaloTex,
        transparent: true,
        opacity: initialAtm.sunOpacity * 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const sunHalo = new THREE.Sprite(sunHaloMat);
    sunHalo.scale.set(2.8, 2.8, 1);
    sunGroup.add(sunCore, sunHalo);
    scene.add(sunGroup);

    const moonGroup = new THREE.Group();
    moonGroup.position.set(...initialAtm.moonPos);
    const moonCoreMat = trackDisp(
      new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: initialAtm.moonOpacity,
      }),
    );
    const moonCore = new THREE.Mesh(trackDisp(new THREE.SphereGeometry(0.36, 20, 20)), moonCoreMat);
    const moonHaloMat = trackDisp(
      new THREE.SpriteMaterial({
        map: moonHaloTex,
        transparent: true,
        opacity: initialAtm.moonOpacity * 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const moonHalo = new THREE.Sprite(moonHaloMat);
    moonHalo.scale.set(2.1, 2.1, 1);
    moonGroup.add(moonCore, moonHalo);
    scene.add(moonGroup);

    // Procedural Twinkling Starfield Dome
    const starCount = 96;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const angle = (i / starCount) * Math.PI * 2 + (i % 7) * 0.37;
      const radius = 14 + (i % 5) * 2.2;
      starPositions[i * 3] = Math.cos(angle) * radius;
      starPositions[i * 3 + 1] = 2.8 + ((i * 19) % 10) * 0.78;
      starPositions[i * 3 + 2] = Math.sin(angle) * radius - 3.5;
    }
    const starGeo = trackDisp(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = trackDisp(
      new THREE.PointsMaterial({
        color: 0xe0f2fe,
        size: 0.14,
        transparent: true,
        opacity: initialAtm.starOpacity,
        depthWrite: false,
        fog: false,
      }),
    );
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Ground Stage & Plinth
    const stageGroup = new THREE.Group();
    const floorMat = trackDisp(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.78,
        metalness: 0.12,
      }),
    );
    const plinthGeo = trackDisp(new THREE.BoxGeometry(10.6, 0.24, 6.2));
    const plinth = new THREE.Mesh(plinthGeo, floorMat);
    plinth.position.set(0, -0.12, 0);
    plinth.receiveShadow = true;
    stageGroup.add(plinth);

    const plinthEdgeMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        metalness: 0.75,
        roughness: 0.28,
      }),
    );
    const plinthTrimGeo = trackDisp(new THREE.BoxGeometry(10.72, 0.08, 6.32));
    const plinthTrim = new THREE.Mesh(plinthTrimGeo, plinthEdgeMat);
    plinthTrim.position.set(0, -0.22, 0);
    stageGroup.add(plinthTrim);

    const contactShadowGeo = trackDisp(new THREE.PlaneGeometry(13.5, 8.6));
    const contactShadowMat = trackDisp(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
    );
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, -0.27, 0);
    stageGroup.add(contactShadow);
    scene.add(stageGroup);

    // Shared materials
    const aluminumMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.24 }),
    );
    const darkMetalMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.36 }),
    );
    const housingWhiteMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.1, roughness: 0.42 }),
    );

    // Selection ring meshes + highlight targets per node
    const nodeGroups = new Map<SystemNodeId, THREE.Group>();
    const nodeRings = new Map<SystemNodeId, THREE.Mesh>();
    const hitProxies: THREE.Mesh[] = [];

    const ringGeo = trackDisp(new THREE.RingGeometry(0.95, 1.07, 48));

    function registerNode(
      id: SystemNodeId,
      group: THREE.Group,
      accentHex: string,
      hitSize: [number, number, number],
      hitCenter: [number, number, number],
      ringRadius = 1.0,
    ) {
      group.userData.nodeId = id;
      scene.add(group);
      nodeGroups.set(id, group);

      const ringMat = trackDisp(
        new THREE.MeshBasicMaterial({
          color: accentHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      );
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(group.position.x, 0.02, group.position.z);
      ring.scale.setScalar(ringRadius);
      scene.add(ring);
      nodeRings.set(id, ring);

      // Raycast hit proxy on layer 1
      const proxyGeo = trackDisp(new THREE.BoxGeometry(hitSize[0], hitSize[1], hitSize[2]));
      const proxyMat = trackDisp(new THREE.MeshBasicMaterial({ visible: false }));
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.position.set(
        group.position.x + hitCenter[0],
        group.position.y + hitCenter[1],
        group.position.z + hitCenter[2],
      );
      proxy.layers.set(1);
      proxy.userData.nodeId = id;
      scene.add(proxy);
      hitProxies.push(proxy);
    }

    // Additional real-site industrial & cable materials
    const blackAnodizedMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.72, roughness: 0.28 }),
    );
    const slateRoofMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x3b3532, metalness: 0.18, roughness: 0.72 }),
    );
    const slateStoneMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.08, roughness: 0.82 }),
    );
    const redCableMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48, metalness: 0.08 }),
    );
    const blackCableMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.1 }),
    );
    const groundWireMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45, metalness: 0.1 }),
    );

    // 1. REAL N-TYPE HALF-CUT SOLAR PANELS ARRAY (Composite 9-part assembly)
    const panelsGroup = new THREE.Group();
    panelsGroup.position.set(-3.3, 0, -1.25);

    const legGeo = trackDisp(new THREE.CylinderGeometry(0.045, 0.055, 1.0, 12));
    const footGeo = trackDisp(new THREE.BoxGeometry(0.24, 0.06, 0.24));
    for (const lx of [-0.95, 0.95]) {
      const backLeg = new THREE.Mesh(legGeo, aluminumMat);
      backLeg.position.set(lx, 0.65, -0.55);
      backLeg.scale.y = 1.3;
      backLeg.castShadow = true;
      panelsGroup.add(backLeg);

      const frontLeg = new THREE.Mesh(legGeo, aluminumMat);
      frontLeg.position.set(lx, 0.34, 0.55);
      frontLeg.scale.y = 0.68;
      frontLeg.castShadow = true;
      panelsGroup.add(frontLeg);

      const f1 = new THREE.Mesh(footGeo, darkMetalMat);
      f1.position.set(lx, 0.03, -0.55);
      const f2 = new THREE.Mesh(footGeo, darkMetalMat);
      f2.position.set(lx, 0.03, 0.55);
      panelsGroup.add(f1, f2);
    }

    const arrayTilt = new THREE.Group();
    arrayTilt.position.set(0, 0.98, 0);
    arrayTilt.rotation.x = 0.44; // ~25° Odesa tilt

    const railGeo = trackDisp(new THREE.BoxGeometry(2.74, 0.06, 0.06));
    const rail1 = new THREE.Mesh(railGeo, aluminumMat);
    rail1.position.set(0, -0.05, -0.45);
    const rail2 = new THREE.Mesh(railGeo, aluminumMat);
    rail2.position.set(0, -0.05, 0.45);
    arrayTilt.add(rail1, rail2);

    const panelCellMat = trackDisp(
      new THREE.MeshPhysicalMaterial({
        map: solarTex,
        emissive: 0x1d4ed8,
        emissiveIntensity: initialAtm.panelEmissive,
        roughness: 0.14,
        metalness: 0.32,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
      }),
    );
    // Dark anodized black frame matching modern Trina / JA Solar / Jinko modules
    const panelFrameGeo = trackDisp(new THREE.BoxGeometry(0.84, 0.05, 1.56));
    const panelFaceGeo = trackDisp(new THREE.PlaneGeometry(0.79, 1.5));
    for (const px of [-0.9, 0, 0.9]) {
      const frame = new THREE.Mesh(panelFrameGeo, blackAnodizedMat);
      frame.position.set(px, 0, 0);
      frame.castShadow = true;
      frame.receiveShadow = true;

      const cellFace = new THREE.Mesh(panelFaceGeo, panelCellMat);
      cellFace.rotation.x = -Math.PI / 2;
      cellFace.position.set(px, 0.027, 0);
      arrayTilt.add(frame, cellFace);
    }

    // Silver solar rail mid-clamps & end-clamps
    const clampGeo = trackDisp(new THREE.BoxGeometry(0.055, 0.075, 0.08));
    for (const cx of [-1.34, -0.45, 0.45, 1.34]) {
      for (const cz of [-0.45, 0.45]) {
        const clamp = new THREE.Mesh(clampGeo, aluminumMat);
        clamp.position.set(cx, 0.015, cz);
        arrayTilt.add(clamp);
      }
    }
    panelsGroup.add(arrayTilt);

    // DC Surge Arrester / MC4 String Box underneath
    const mc4Box = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.34, 0.26, 0.22)),
      housingWhiteMat,
    );
    mc4Box.position.set(0.72, 0.42, 0.32);
    mc4Box.castShadow = true;
    const mc4Window = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.22, 0.12, 0.03)),
      darkMetalMat,
    );
    mc4Window.position.set(0.72, 0.44, 0.435);
    panelsGroup.add(mc4Box, mc4Window);

    registerNode('panels', panelsGroup, '#f59e0b', [2.8, 1.8, 2.0], [0, 0.9, 0], 1.45);

    // 2. REAL DEYE HYBRID INVERTER (Modeled after real Deye SUN chassis + circular medallion LCD)
    const inverterGroup = new THREE.Group();
    inverterGroup.position.set(0, 0, -0.4);

    // Mounting pedestal + wall backplate
    const invStandBase = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.36, 0.08, 0.68)),
      darkMetalMat,
    );
    invStandBase.position.set(0, 0.04, 0);
    invStandBase.castShadow = true;
    const invPost = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.92, 1.56, 0.09)),
      darkMetalMat,
    );
    invPost.position.set(0, 0.8, -0.22);
    invPost.castShadow = true;
    inverterGroup.add(invStandBase, invPost);

    // Main white powder-coated Deye chassis
    const invBody = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.06, 1.18, 0.34)),
      housingWhiteMat,
    );
    invBody.position.set(0, 1.06, 0.02);
    invBody.castShadow = true;
    invBody.receiveShadow = true;
    inverterGroup.add(invBody);

    // Lower dark wiring bay + DC rotary isolator switch (characteristic Deye lower shroud)
    const invWiringBay = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.98, 0.28, 0.31)),
      darkMetalMat,
    );
    invWiringBay.position.set(0, 0.36, 0.01);
    invWiringBay.castShadow = true;
    const dcSwitchBase = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.16, 0.16, 0.04)),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
    );
    trackDisp(dcSwitchBase.material as THREE.Material);
    dcSwitchBase.position.set(-0.32, 0.36, 0.17);
    const dcSwitchKnob = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.05, 0.11, 0.04)),
      redCableMat,
    );
    dcSwitchKnob.position.set(-0.32, 0.36, 0.195);
    inverterGroup.add(invWiringBay, dcSwitchBase, dcSwitchKnob);

    // Top brushed dark cooling shroud + External Wi-Fi Stick Logger
    const invTopCap = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.1, 0.1, 0.38)),
      darkMetalMat,
    );
    invTopCap.position.set(0, 1.68, 0.02);
    const wifiDongle = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 12)),
      housingWhiteMat,
    );
    wifiDongle.position.set(0.46, 0.18, 0.11);
    const wifiLed = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10)),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    );
    trackDisp(wifiLed.material as THREE.Material);
    wifiLed.position.set(0.46, 0.065, 0.11);
    inverterGroup.add(invTopCap, wifiDongle, wifiLed);

    // Side extruded cooling heatsink fins
    const finGeo = trackDisp(new THREE.BoxGeometry(0.045, 1.06, 0.28));
    for (let i = 0; i < 3; i++) {
      const finL = new THREE.Mesh(finGeo, aluminumMat);
      finL.position.set(-0.555, 1.06, -0.02 + (i - 1) * 0.04);
      const finR = new THREE.Mesh(finGeo, aluminumMat);
      finR.position.set(0.555, 1.06, -0.02 + (i - 1) * 0.04);
      inverterGroup.add(finL, finR);
    }

    // Signature Deye Circular Brushed-Silver Medallion + Color LCD Diagram
    const medallionBacking = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.41, 0.41, 0.032, 36)),
      aluminumMat,
    );
    medallionBacking.rotation.x = Math.PI / 2;
    medallionBacking.position.set(0, 1.12, 0.195);

    const lcdScreenMat = trackDisp(
      new THREE.MeshBasicMaterial({
        map: screenTex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const lcdScreen = new THREE.Mesh(
      trackDisp(new THREE.CircleGeometry(0.395, 36)),
      lcdScreenMat,
    );
    lcdScreen.position.set(0, 1.12, 0.214);

    // Subtle status LED indicator dot on bottom front bevel
    const invLedMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );
    const invLedStrip = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.36, 0.032, 0.025)),
      invLedMat,
    );
    invLedStrip.position.set(0.18, 0.36, 0.17);
    inverterGroup.add(medallionBacking, lcdScreen, invLedStrip);

    // Bottom 4 color-coded cable glands
    const glandGeo = trackDisp(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 12));
    const portConfigs: Array<[number, number]> = [
      [-0.36, 0xf59e0b], // PV DC
      [-0.12, 0x10b981], // BAT
      [0.12, 0x38bdf8],  // LOAD
      [0.36, 0x818cf8],  // GRID
    ];
    for (const [px, col] of portConfigs) {
      const pMat = trackDisp(
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        }),
      );
      const gland = new THREE.Mesh(glandGeo, pMat);
      gland.position.set(px, 0.2, 0.04);
      inverterGroup.add(gland);
    }

    registerNode('inverter', inverterGroup, '#38bdf8', [1.45, 2.0, 0.9], [0, 1.0, 0], 1.1);

    // 3. REAL DEYE / DYNESS LiFePO4 BATTERY CABINET (Modeled after backup_deye_8kw.jpg)
    const batteryGroup = new THREE.Group();
    batteryGroup.position.set(-2.5, 0, 1.45);

    const batPlinth = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.16, 0.09, 0.68)),
      darkMetalMat,
    );
    batPlinth.position.set(0, 0.045, 0);
    batPlinth.castShadow = true;
    batteryGroup.add(batPlinth);

    // Sleek matte white cabinet with 3 modular seam tiers
    const batBody = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.06, 1.24, 0.58)),
      housingWhiteMat,
    );
    batBody.position.set(0, 0.71, 0);
    batBody.castShadow = true;
    batBody.receiveShadow = true;
    batteryGroup.add(batBody);

    // Brushed top steel plate with recessed hex mounting bolts (per backup_deye_8kw.jpg)
    const batTopPlate = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.08, 0.06, 0.6)),
      aluminumMat,
    );
    batTopPlate.position.set(0, 1.35, 0);
    batTopPlate.castShadow = true;
    batteryGroup.add(batTopPlate);

    const boltGeo = trackDisp(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8));
    for (const bx of [-0.42, 0, 0.42]) {
      for (const bz of [-0.2, 0.2]) {
        const bolt = new THREE.Mesh(boltGeo, darkMetalMat);
        bolt.position.set(bx, 1.385, bz);
        batteryGroup.add(bolt);
      }
    }

    // Horizontal modular tier shadow grooves + 3 animated green SOC status strips
    const batGrooveGeo = trackDisp(new THREE.BoxGeometry(1.07, 0.018, 0.59));
    const batSocGeo = trackDisp(new THREE.BoxGeometry(0.18, 0.04, 0.025));
    const batSocMats: THREE.MeshStandardMaterial[] = [];

    for (let i = 0; i < 3; i++) {
      const tierY = 0.28 + i * 0.38;
      if (i > 0) {
        const groove = new THREE.Mesh(batGrooveGeo, darkMetalMat);
        groove.position.set(0, tierY - 0.16, 0);
        batteryGroup.add(groove);
      }

      const socMat = trackDisp(
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x10b981,
          emissiveIntensity: 1.3,
          roughness: 0.2,
        }),
      );
      batSocMats.push(socMat);
      const socBar = new THREE.Mesh(batSocGeo, socMat);
      socBar.position.set(0.36, tierY, 0.295);
      batteryGroup.add(socBar);
    }

    // Signature round black Deye OLED SOC ring display on upper front center
    const batDialRing = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.175, 0.175, 0.025, 32)),
      blackAnodizedMat,
    );
    batDialRing.rotation.x = Math.PI / 2;
    batDialRing.position.set(0, 0.88, 0.29);

    const batDialMat = trackDisp(
      new THREE.MeshBasicMaterial({
        map: batDialTex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const batDialFace = new THREE.Mesh(
      trackDisp(new THREE.CircleGeometry(0.162, 32)),
      batDialMat,
    );
    batDialFace.position.set(0, 0.88, 0.305);
    batteryGroup.add(batDialRing, batDialFace);

    // Authentic side Red (+), Black (-), and Yellow-Green Ground DC battery cables
    const batRedCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.53, 1.12, 0.06),
      new THREE.Vector3(-0.68, 0.85, 0.12),
      new THREE.Vector3(-0.64, 0.28, 0.08),
    ]);
    const batBlackCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.53, 1.12, 0.06),
      new THREE.Vector3(0.68, 0.85, 0.12),
      new THREE.Vector3(0.64, 0.28, 0.08),
    ]);
    const batGroundCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.53, 1.04, -0.08),
      new THREE.Vector3(-0.63, 0.7, -0.14),
      new THREE.Vector3(-0.58, 0.2, -0.12),
    ]);
    batteryGroup.add(
      new THREE.Mesh(trackDisp(new THREE.TubeGeometry(batRedCurve, 18, 0.026, 8, false)), redCableMat),
      new THREE.Mesh(trackDisp(new THREE.TubeGeometry(batBlackCurve, 18, 0.026, 8, false)), blackCableMat),
      new THREE.Mesh(trackDisp(new THREE.TubeGeometry(batGroundCurve, 16, 0.016, 6, false)), groundWireMat),
    );

    registerNode('battery', batteryGroup, '#10b981', [1.4, 1.5, 0.9], [0, 0.75, 0], 1.05);

    // 4. REAL ODESA MODERN HOUSE & DIN-RAIL BREAKER SHIELD (Modeled after house_6kw.png)
    const loadsGroup = new THREE.Group();
    loadsGroup.position.set(3.05, 0, 1.15);

    const housePad = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(2.14, 0.08, 1.74)),
      slateStoneMat,
    );
    housePad.position.set(0, 0.04, 0);
    housePad.receiveShadow = true;
    loadsGroup.add(housePad);

    // Dark stone lower wall band + white stucco upper facade
    const houseLowerBand = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.88, 0.42, 1.44)),
      slateStoneMat,
    );
    houseLowerBand.position.set(0, 0.29, 0);
    houseLowerBand.castShadow = true;
    houseLowerBand.receiveShadow = true;

    const houseBody = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.86, 0.88, 1.42)),
      housingWhiteMat,
    );
    houseBody.position.set(0, 0.94, 0);
    houseBody.castShadow = true;
    houseBody.receiveShadow = true;
    loadsGroup.add(houseLowerBand, houseBody);

    // 4-sided pitched hip roof + fascia eaves + twin architectural chimneys (per house_6kw.png)
    const roofEaves = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(2.12, 0.07, 1.68)),
      blackAnodizedMat,
    );
    roofEaves.position.set(0, 1.4, 0);
    roofEaves.castShadow = true;

    const hipRoof = new THREE.Mesh(
      trackDisp(new THREE.ConeGeometry(1.48, 0.58, 4)),
      slateRoofMat,
    );
    hipRoof.rotation.y = Math.PI / 4;
    hipRoof.scale.set(1.02, 1.0, 0.78);
    hipRoof.position.set(0, 1.71, 0);
    hipRoof.castShadow = true;

    const chimney1 = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.18, 0.34, 0.18)),
      housingWhiteMat,
    );
    chimney1.position.set(-0.28, 1.88, -0.14);
    const chimneyCap = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.22, 0.05, 0.22)),
      blackAnodizedMat,
    );
    chimneyCap.position.set(-0.28, 2.06, -0.14);
    loadsGroup.add(roofEaves, hipRoof, chimney1, chimneyCap);

    // Framed dark-anodized architectural windows with warm glowing glass
    const windowMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        roughness: 0.16,
      }),
    );
    const addFramedWindow = (wx: number, wy: number, wz: number, ww: number, wh: number) => {
      const frame = new THREE.Mesh(trackDisp(new THREE.BoxGeometry(ww + 0.06, wh + 0.06, 0.04)), blackAnodizedMat);
      frame.position.set(wx, wy, wz);
      const glass = new THREE.Mesh(trackDisp(new THREE.BoxGeometry(ww, wh, 0.05)), windowMat);
      glass.position.set(wx, wy, wz + 0.005);
      const mullion = new THREE.Mesh(trackDisp(new THREE.BoxGeometry(0.025, wh, 0.06)), blackAnodizedMat);
      mullion.position.set(wx, wy, wz + 0.01);
      loadsGroup.add(frame, glass, mullion);
    };
    addFramedWindow(0.42, 0.88, 0.71, 0.56, 0.52);
    addFramedWindow(-0.42, 0.88, 0.71, 0.48, 0.52);

    const door = new THREE.Mesh(trackDisp(new THREE.BoxGeometry(0.38, 0.76, 0.04)), blackAnodizedMat);
    door.position.set(-0.4, 0.46, -0.71);
    loadsGroup.add(door);

    // Detailed DIN-Rail AC/DC Breaker Shield mounted on wall facing Inverter
    const breakerHousing = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.14, 0.58, 0.46)),
      housingWhiteMat,
    );
    breakerHousing.position.set(-0.96, 0.74, 0);
    breakerHousing.castShadow = true;

    const breakerFaceMat = trackDisp(
      new THREE.MeshStandardMaterial({
        map: breakerTex,
        roughness: 0.3,
        metalness: 0.1,
      }),
    );
    const breakerFace = new THREE.Mesh(
      trackDisp(new THREE.PlaneGeometry(0.38, 0.48)),
      breakerFaceMat,
    );
    breakerFace.rotation.y = -Math.PI / 2;
    breakerFace.position.set(-1.032, 0.74, 0);

    const breakerLed = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.025, 0.045, 0.24)),
      invLedMat,
    );
    breakerLed.position.set(-1.035, 1.0, 0);

    // Warm Exterior Backup Porch Sconce (glows in evening, night & BLACKOUT!)
    const porchFixture = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.16, 0.14, 0.08)),
      blackAnodizedMat,
    );
    porchFixture.position.set(0, 1.24, 0.74);
    const porchBulbMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: initialAtm.porchGlow,
        roughness: 0.2,
      }),
    );
    const porchBulb = new THREE.Mesh(
      trackDisp(new THREE.SphereGeometry(0.065, 10, 10)),
      porchBulbMat,
    );
    porchBulb.position.set(0, 1.18, 0.76);

    loadsGroup.add(breakerHousing, breakerFace, breakerLed, porchFixture, porchBulb);

    registerNode('loads', loadsGroup, '#60a5fa', [2.2, 2.0, 1.8], [0, 0.9, 0], 1.35);

    // 5. REAL UTILITY GRID POLE & BIDIRECTIONAL SMART METER (Composite 9-part assembly)
    const gridGroup = new THREE.Group();
    gridGroup.position.set(3.25, 0, -1.55);

    const concreteMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.05 }),
    );
    const gridBase = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.36, 0.42, 0.22, 16)),
      darkMetalMat,
    );
    gridBase.position.set(0, 0.11, 0);
    gridBase.castShadow = true;

    const poleMast = new THREE.Mesh(
      trackDisp(new THREE.CylinderGeometry(0.075, 0.115, 2.2, 12)),
      concreteMat,
    );
    poleMast.position.set(0, 1.2, 0);
    poleMast.castShadow = true;

    const crossarm = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(1.22, 0.075, 0.075)),
      aluminumMat,
    );
    crossarm.position.set(0, 2.1, 0);
    crossarm.castShadow = true;
    gridGroup.add(gridBase, poleMast, crossarm);

    const insulatorGeo = trackDisp(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 10));
    const insulatorMat = trackDisp(
      new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        roughness: 0.12,
        metalness: 0.1,
        clearcoat: 1.0,
      }),
    );
    for (const ix of [-0.48, 0, 0.48]) {
      const ins = new THREE.Mesh(insulatorGeo, insulatorMat);
      ins.position.set(ix, 2.2, 0);
      gridGroup.add(ins);

      // Overhead catenary grid line wire extending from insulator
      const wireCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ix, 2.26, 0),
        new THREE.Vector3(ix + 0.35, 2.02, -0.55),
        new THREE.Vector3(ix + 0.72, 2.14, -1.1),
      ]);
      gridGroup.add(
        new THREE.Mesh(
          trackDisp(new THREE.TubeGeometry(wireCurve, 12, 0.012, 6, false)),
          blackCableMat,
        ),
      );
    }

    // Smart Bidirectional Meter Box with Live Backlit LCD
    const meterBox = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.42, 0.54, 0.24)),
      housingWhiteMat,
    );
    meterBox.position.set(-0.2, 0.84, 0.14);
    meterBox.castShadow = true;

    const meterLcdMat = trackDisp(
      new THREE.MeshBasicMaterial({
        map: meterLcdTex,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const meterLcd = new THREE.Mesh(
      trackDisp(new THREE.PlaneGeometry(0.32, 0.21)),
      meterLcdMat,
    );
    meterLcd.position.set(-0.2, 0.9, 0.264);

    const gridStatusMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x818cf8,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );
    const gridStatusLed = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.24, 0.045, 0.025)),
      gridStatusMat,
    );
    gridStatusLed.position.set(-0.2, 0.71, 0.264);

    // Neighborhood City Streetlight Arm on Utility Pole (goes completely DARK during Blackout!)
    const lampArm = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.58, 0.055, 0.055)),
      aluminumMat,
    );
    lampArm.position.set(-0.26, 1.94, 0.12);
    const streetLampMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0xfde68a,
        emissiveIntensity: initialAtm.streetLampGlow,
        roughness: 0.25,
      }),
    );
    const streetLampHead = new THREE.Mesh(
      trackDisp(new THREE.BoxGeometry(0.26, 0.07, 0.14)),
      streetLampMat,
    );
    streetLampHead.position.set(-0.5, 1.9, 0.12);

    gridGroup.add(meterBox, meterLcd, gridStatusLed, lampArm, streetLampHead);

    registerNode('grid', gridGroup, '#818cf8', [1.4, 2.4, 1.1], [0, 1.2, 0], 1.0);

    // 6. CURVED ENERGY CONDUIT TUBES + TRAVELING ENERGY PULSES
    interface ConduitSpec {
      key: keyof SystemModeInfo['flows'];
      points: THREE.Vector3[];
      colorHex: number;
      reverseColorHex?: number;
    }

    const conduitSpecs: ConduitSpec[] = [
      {
        key: 'pvToInv',
        colorHex: 0xf59e0b,
        points: [
          new THREE.Vector3(-2.6, 0.42, -0.92),
          new THREE.Vector3(-1.6, 0.14, -0.78),
          new THREE.Vector3(-0.36, 0.14, -0.45),
          new THREE.Vector3(-0.36, 0.35, -0.34),
        ],
      },
      {
        key: 'invToBat',
        colorHex: 0x10b981,
        points: [
          new THREE.Vector3(-0.12, 0.35, -0.34),
          new THREE.Vector3(-0.12, 0.14, 0.38),
          new THREE.Vector3(-1.45, 0.14, 1.08),
          new THREE.Vector3(-2.15, 1.28, 1.45),
        ],
      },
      {
        key: 'invToLoads',
        colorHex: 0x38bdf8,
        points: [
          new THREE.Vector3(0.12, 0.35, -0.34),
          new THREE.Vector3(0.45, 0.14, 0.48),
          new THREE.Vector3(1.55, 0.14, 1.15),
          new THREE.Vector3(2.05, 0.74, 1.15),
        ],
      },
      {
        key: 'invToGrid',
        colorHex: 0x818cf8,
        reverseColorHex: 0x38bdf8,
        points: [
          new THREE.Vector3(0.36, 0.35, -0.34),
          new THREE.Vector3(1.35, 0.14, -0.72),
          new THREE.Vector3(2.45, 0.14, -1.25),
          new THREE.Vector3(3.05, 0.82, -1.42),
        ],
      },
    ];

    const pulseGeo = trackDisp(new THREE.SphereGeometry(0.075, 12, 12));
    const conduits = conduitSpecs.map((spec) => {
      const curve = new THREE.CatmullRomCurve3(spec.points);
      const tubeGeo = trackDisp(new THREE.TubeGeometry(curve, 36, 0.036, 10, false));
      const tubeMat = trackDisp(
        new THREE.MeshStandardMaterial({
          color: spec.colorHex,
          emissive: spec.colorHex,
          emissiveIntensity: 0.25,
          roughness: 0.3,
          metalness: 0.2,
          transparent: true,
          opacity: 0.72,
        }),
      );
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      const pulseMat = trackDisp(
        new THREE.MeshBasicMaterial({
          color: spec.colorHex,
        }),
      );
      const pulses: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(pulseGeo, pulseMat);
        scene.add(p);
        pulses.push(p);
      }

      return {
        ...spec,
        curve,
        tubeMat,
        pulseMat,
        pulses,
        phase: 0,
      };
    });

    // 7. SOLAR PHOTON STREAMS (Descending from sky sun onto solar panels)
    const photonCount = 15;
    const photonMat = trackDisp(
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: initialAtm.photonOpacity,
      }),
    );
    const photonGeo = trackDisp(new THREE.SphereGeometry(0.055, 8, 8));
    const photonStreams: Array<{ mesh: THREE.Mesh; offsetX: number; offsetZ: number; phase: number }> = [];
    for (let i = 0; i < photonCount; i++) {
      const m = new THREE.Mesh(photonGeo, photonMat);
      scene.add(m);
      photonStreams.push({
        mesh: m,
        offsetX: ((i % 5) - 2) * 0.52,
        offsetZ: (Math.floor(i / 5) - 1) * 0.45,
        phase: (i / photonCount) % 1,
      });
    }

    // Camera transition state (cancelled immediately when user interacts)
    let transitionActive = false;
    const targetGoal = new THREE.Vector3().copy(DEFAULT_CAMERA_TARGET);
    const camGoal = new THREE.Vector3().copy(DEFAULT_CAMERA_POS);

    const onControlStart = () => {
      transitionActive = false;
    };
    controls.addEventListener('start', onControlStart);

    focusNodeFnRef.current = (nodeId: SystemNodeId) => {
      const preset = NODE_CAMERA_TARGETS[nodeId];
      if (!preset) return;
      targetGoal.set(preset.target[0], preset.target[1], preset.target[2]);
      camGoal.set(preset.camOffset[0], preset.camOffset[1], preset.camOffset[2]);
      transitionActive = true;
    };

    resetCameraFnRef.current = () => {
      targetGoal.copy(DEFAULT_CAMERA_TARGET);
      camGoal.copy(DEFAULT_CAMERA_POS);
      transitionActive = true;
    };

    // Raycasting for click & hover
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let hoveredNode: SystemNodeId | null = null;
    let lastRaycastTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastTime < 45) return;
      lastRaycastTime = now;
      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      const hitId = hits.length > 0 ? (hits[0].object.userData.nodeId as SystemNodeId) : null;
      if (hitId !== hoveredNode) {
        hoveredNode = hitId;
        renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return; // Dragged camera, not clicked node
      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.nodeId as SystemNodeId;
        if (hitId) {
          onSelectNodeRef.current(hitId);
        }
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for clean responsive fit
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextW = Math.max(Math.floor(entry.contentRect.width), 280);
      const nextH = Math.max(Math.floor(entry.contentRect.height), 260);
      camera.fov = nextW < 520 ? 52 : nextW < 768 ? 46 : 40;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    });
    resizeObserver.observe(container);

    // Pre-warm shaders on GPU devices
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Software WebGL loop pacer per Three.js skill
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const timer = new THREE.Timer();
    timer.connect(document);
    let lastRenderedScreenMode: SystemFlowMode | null = null;
    let lastClockText = '';
    let isViewportVisible = true;
    let isTabVisible = typeof document === 'undefined' ? true : !document.hidden;
    let loopPaused = false;

    function scheduleNextFrame() {
      if (disposed || loopPaused) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function syncPlaybackState() {
      const shouldPause = !isViewportVisible || !isTabVisible;
      if (shouldPause === loopPaused) return;
      loopPaused = shouldPause;
      if (loopPaused) {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
      } else {
        timer.reset();
        scheduleNextFrame();
      }
    }

    function tick(timestamp?: number) {
      if (disposed || loopPaused) return;

      timer.update(typeof timestamp === 'number' ? timestamp : undefined);
      const delta = Math.min(timer.getDelta(), 0.1);
      const elapsed = timer.getElapsed();

      const currentMode = activeModeRef.current;

      // Advance continuous 24h solar arc OR glide smoothly along the arc toward selected mode
      if (autoCycleRef.current && !prefersReducedMotion) {
        cyclePhase = normalizeCyclePhase(cyclePhase + delta / CYCLE_DURATION_SECONDS);
      } else {
        const targetPhase = MODE_TARGET_PHASE[currentMode];
        const forwardDelta = (targetPhase - cyclePhase + 1) % 1;
        const arcDelta = forwardDelta <= 0.65 ? forwardDelta : forwardDelta - 1;
        if (Math.abs(arcDelta) > 0.0005) {
          cyclePhase = normalizeCyclePhase(
            cyclePhase + arcDelta * (1 - Math.exp(-3.2 * delta)),
          );
        } else {
          cyclePhase = targetPhase;
        }
      }

      const atm = sampleSolarCycleState(
        cyclePhase,
        !autoCycleRef.current && currentMode === 'blackout',
      );

      // Sync React mode only when autoCycle crosses day / evening / night thresholds
      if (autoCycleRef.current && atm.suggestedMode !== currentMode) {
        activeModeRef.current = atm.suggestedMode;
        onSelectModeRef.current(atm.suggestedMode);
      }

      const effectiveMode = autoCycleRef.current ? atm.suggestedMode : currentMode;
      const modeDef = SYSTEM_MODES.find((m) => m.id === effectiveMode) ?? SYSTEM_MODES[0];

      // Update live time-of-day clock readout directly without React re-renders
      if (clockLabelRef.current && atm.clockLabel !== lastClockText) {
        lastClockText = atm.clockLabel;
        clockLabelRef.current.textContent = atm.clockLabel;
      }

      // Redraw Deye Inverter Medallion LCD, Battery OLED Dial, and Smart Meter LCD on mode change
      if (lastRenderedScreenMode !== effectiveMode) {
        lastRenderedScreenMode = effectiveMode;
        drawDeyeMedallionCanvas(screenRes.canvas, effectiveMode);
        screenTex.needsUpdate = true;
        drawBatteryDialCanvas(batDialRes.canvas, effectiveMode);
        batDialTex.needsUpdate = true;
        drawMeterLcdCanvas(meterLcdRes.canvas, effectiveMode);
        meterLcdTex.needsUpdate = true;
      }

      // Smooth Day / Sunset / Blue Night atmosphere & lighting interpolation (zero GC)
      const bgColor = scene.background as THREE.Color;
      const lerpAlpha = 1 - Math.exp(-5.0 * delta);

      _cBg.setHex(atm.skyHorizonHex);
      bgColor.lerp(_cBg, lerpAlpha);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(bgColor);
      }

      _cSkyZenith.setHex(atm.skyZenithHex);
      skyDomeMat.uniforms.uZenithColor.value.lerp(_cSkyZenith, lerpAlpha);
      skyDomeMat.uniforms.uHorizonColor.value.copy(bgColor);
      _vSunDir.set(atm.sunPos[0], atm.sunPos[1], atm.sunPos[2]).normalize();
      skyDomeMat.uniforms.uSunDir.value.copy(_vSunDir);
      _cSunGlow.setHex(atm.sunGlowHex);
      skyDomeMat.uniforms.uSunGlowColor.value.lerp(_cSunGlow, lerpAlpha);
      skyDomeMat.uniforms.uSunGlowStrength.value = THREE.MathUtils.damp(
        skyDomeMat.uniforms.uSunGlowStrength.value,
        atm.sunGlowStrength,
        4.5,
        delta,
      );

      // Dynamic directional key light tracks sun/moon arc so shadows sweep across ground
      keyLight.position.x = THREE.MathUtils.damp(keyLight.position.x, atm.lightPos[0], 4.5, delta);
      keyLight.position.y = THREE.MathUtils.damp(keyLight.position.y, atm.lightPos[1], 4.5, delta);
      keyLight.position.z = THREE.MathUtils.damp(keyLight.position.z, atm.lightPos[2], 4.5, delta);

      _cKey.setHex(atm.keyHex);
      keyLight.color.lerp(_cKey, lerpAlpha);
      keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, atm.keyIntensity, 4.5, delta);

      _cHemiSky.setHex(atm.hemiSkyHex);
      _cHemiGround.setHex(atm.hemiGroundHex);
      hemiLight.color.lerp(_cHemiSky, lerpAlpha);
      hemiLight.groundColor.lerp(_cHemiGround, lerpAlpha);
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, atm.hemiIntensity, 4.5, delta);

      _cRim.setHex(atm.rimHex);
      rimLight.color.lerp(_cRim, lerpAlpha);
      rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, atm.rimIntensity, 4.5, delta);
      scene.environmentIntensity = THREE.MathUtils.damp(
        scene.environmentIntensity,
        atm.envIntensity,
        4.5,
        delta,
      );

      // Sun & Moon smooth orbital arc + halo color shift
      sunGroup.position.x = THREE.MathUtils.damp(sunGroup.position.x, atm.sunPos[0], 6.0, delta);
      sunGroup.position.y = THREE.MathUtils.damp(sunGroup.position.y, atm.sunPos[1], 6.0, delta);
      sunGroup.position.z = THREE.MathUtils.damp(sunGroup.position.z, atm.sunPos[2], 6.0, delta);
      _cSun.setHex(atm.sunHex);
      sunCoreMat.color.lerp(_cSun, lerpAlpha);
      sunHaloMat.color.lerp(_cSunGlow, lerpAlpha);
      sunCoreMat.opacity = THREE.MathUtils.damp(sunCoreMat.opacity, atm.sunOpacity, 5.5, delta);
      sunHaloMat.opacity = sunCoreMat.opacity * (0.88 + Math.sin(elapsed * 2.2) * 0.1);
      sunGroup.visible = sunCoreMat.opacity > 0.02;

      moonGroup.position.x = THREE.MathUtils.damp(moonGroup.position.x, atm.moonPos[0], 6.0, delta);
      moonGroup.position.y = THREE.MathUtils.damp(moonGroup.position.y, atm.moonPos[1], 6.0, delta);
      moonGroup.position.z = THREE.MathUtils.damp(moonGroup.position.z, atm.moonPos[2], 6.0, delta);
      moonCoreMat.opacity = THREE.MathUtils.damp(moonCoreMat.opacity, atm.moonOpacity, 5.5, delta);
      moonHaloMat.opacity = moonCoreMat.opacity * 0.85;
      moonGroup.visible = moonCoreMat.opacity > 0.02;

      // Twinkling Starfield during twilight & blue night
      const twinkle = 0.85 + Math.sin(elapsed * 2.5) * 0.15;
      starMat.opacity = THREE.MathUtils.damp(starMat.opacity, atm.starOpacity * twinkle, 4.0, delta);
      starField.visible = starMat.opacity > 0.02;

      // Solar panel sheen, House windows/porch, Utility streetlight
      panelCellMat.emissiveIntensity = THREE.MathUtils.damp(
        panelCellMat.emissiveIntensity,
        atm.panelEmissive,
        4.0,
        delta,
      );
      windowMat.emissiveIntensity = THREE.MathUtils.damp(
        windowMat.emissiveIntensity,
        atm.windowGlow,
        4.5,
        delta,
      );
      porchBulbMat.emissiveIntensity = THREE.MathUtils.damp(
        porchBulbMat.emissiveIntensity,
        atm.porchGlow,
        4.5,
        delta,
      );
      streetLampMat.emissiveIntensity = THREE.MathUtils.damp(
        streetLampMat.emissiveIntensity,
        atm.streetLampGlow,
        5.5,
        delta,
      );

      // Solar Photon Beams streaming onto panels
      photonMat.opacity = THREE.MathUtils.damp(photonMat.opacity, atm.photonOpacity, 4.5, delta);
      const showPhotons = photonMat.opacity > 0.03;
      for (const p of photonStreams) {
        p.mesh.visible = showPhotons;
        if (!showPhotons) continue;
        if (!prefersReducedMotion) {
          p.phase = (p.phase + delta * atm.photonSpeed) % 1;
        }
        const targetX = -3.3 + p.offsetX;
        const targetY = 1.02;
        const targetZ = -1.25 + p.offsetZ;
        p.mesh.position.set(
          THREE.MathUtils.lerp(sunGroup.position.x + p.offsetX * 0.6, targetX, p.phase),
          THREE.MathUtils.lerp(sunGroup.position.y - 0.3, targetY, p.phase),
          THREE.MathUtils.lerp(sunGroup.position.z + p.offsetZ * 0.5, targetZ, p.phase),
        );
        const s = 0.6 + Math.sin(p.phase * Math.PI) * 0.55;
        p.mesh.scale.setScalar(s);
      }

      // Animated LiFePO4 Battery Charge / Discharge LED bars
      const batFlow = modeDef.flows.invToBat;
      const chargeSweep = ((elapsed * 1.4) % 3);
      for (let i = 0; i < batSocMats.length; i++) {
        let targetEmissive = 1.0;
        if (batFlow > 0) {
          // Charging: sequential bottom-to-top glow wave
          const dist = Math.abs(chargeSweep - i);
          targetEmissive = dist < 0.85 ? 2.1 : 0.75;
        } else if (batFlow < 0) {
          // Discharging: steady pulse top-to-bottom
          const revSweep = 2 - chargeSweep;
          const dist = Math.abs(revSweep - i);
          targetEmissive = dist < 0.85 ? 1.9 : 0.65;
        }
        batSocMats[i].emissiveIntensity = THREE.MathUtils.damp(
          batSocMats[i].emissiveIntensity,
          targetEmissive,
          8,
          delta,
        );
      }

      // Utility Grid meter beacon
      if (modeDef.gridOnline) {
        gridStatusMat.color.setHex(0x818cf8);
        gridStatusMat.emissive.setHex(0x818cf8);
        gridStatusMat.emissiveIntensity = 1.3;
      } else {
        // Red fault flicker during Blackout
        gridStatusMat.color.setHex(0xef4444);
        gridStatusMat.emissive.setHex(0xef4444);
        gridStatusMat.emissiveIntensity = 0.6 + Math.abs(Math.sin(elapsed * 5.0)) * 1.2;
      }

      // Highlight selected & hovered node rings smoothly
      const currentSelected = selectedNodeRef.current;
      for (const [id, ring] of nodeRings.entries()) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const isSel = id === currentSelected;
        const isHov = id === hoveredNode;
        const targetOpacity = isSel ? 0.92 : isHov ? 0.55 : 0.14;
        mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 8, delta);
      }

      // Subtle living motion on energy flow conduits
      for (const conduit of conduits) {
        const speed = modeDef.flows[conduit.key];
        if (speed === 0) {
          conduit.tubeMat.opacity = THREE.MathUtils.damp(conduit.tubeMat.opacity, 0.18, 6, delta);
          for (const pulse of conduit.pulses) {
            pulse.visible = false;
          }
          continue;
        }

        conduit.tubeMat.opacity = THREE.MathUtils.damp(conduit.tubeMat.opacity, 0.82, 6, delta);
        const animSpeed = prefersReducedMotion ? 0 : speed * 0.44;
        conduit.phase = (conduit.phase + delta * animSpeed + 10) % 1;

        for (let i = 0; i < conduit.pulses.length; i++) {
          const pulse = conduit.pulses[i];
          pulse.visible = true;
          const t = (conduit.phase + i / conduit.pulses.length) % 1;
          conduit.curve.getPointAt(t, _v3);
          pulse.position.copy(_v3);
          const scale = 0.85 + Math.sin(elapsed * 4 + i) * 0.15;
          pulse.scale.setScalar(scale);
        }
      }

      // Smooth damped camera focus transition
      if (transitionActive) {
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetGoal.x, 5.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, targetGoal.y, 5.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetGoal.z, 5.5, delta);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, camGoal.x, 5.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camGoal.y, 5.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, camGoal.z, 5.5, delta);

        _vTarget.copy(controls.target);
        _vCamTarget.copy(camera.position);
        if (
          _vTarget.distanceTo(targetGoal) < 0.02 &&
          _vCamTarget.distanceTo(camGoal) < 0.04
        ) {
          transitionActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      scheduleNextFrame();
    }

    const viewportObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              isViewportVisible = entries.some((entry) => entry.isIntersecting);
              syncPlaybackState();
            },
            { rootMargin: '120px 0px' },
          )
        : null;
    viewportObserver?.observe(container);

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      syncPlaybackState();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    renderer.render(scene, camera);
    scheduleNextFrame();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      viewportObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      timer.disconnect();
      timer.dispose();
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const activeNode = SYSTEM_NODES.find((n) => n.id === selectedNodeId) ?? SYSTEM_NODES[0];
  const activeModeObj = SYSTEM_MODES.find((m) => m.id === activeMode) ?? SYSTEM_MODES[0];

  if (webglUnavailable || contextLost) {
    return (
      <div className="relative w-full h-[380px] sm:h-[440px] rounded-2xl bg-[#0b1929] border border-slate-800 flex flex-col items-center justify-center p-6 text-center text-white">
        <p className="text-sm font-bold mb-2">
          {tr('Інтерактивна 2D-схема роботи СЕС', 'Интерактивная 2D-схема работы СЭС')}
        </p>
        <p className="text-xs text-slate-300 max-w-md mb-5">
          {tr(
            'Оберіть вузол системи нижче, щоб переглянути схему підключення, призначення та економічний ефект.',
            'Выберите узел системы ниже, чтобы посмотреть схему подключения, назначение и экономический эффект.',
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SYSTEM_NODES.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                node.id === selectedNodeId
                  ? 'bg-[#1769aa] border-sky-400 text-white'
                  : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
              }`}
            >
              {node.order}. {tr(node.titleUk, node.titleRu)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-sky-200/35 bg-[#07182e] shadow-xl select-none">
      {/* Unobstructed 3D Viewport */}
      <div className="relative w-full h-[300px] sm:h-[420px] lg:h-[470px] bg-[#0b1929]">
        <div ref={mountRef} className="w-full h-full" />

        {/* Compact Top Corner Status & Reset Only (zero scene obstruction on mobile) */}
        <div className="pointer-events-none absolute top-2.5 inset-x-2.5 sm:top-3.5 sm:inset-x-3.5 z-10 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#091523]/82 border border-white/15 px-2.5 py-1 text-[11px] font-bold text-white">
            <span className="text-sky-300 font-mono">{activeNode.order}</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span
              ref={clockLabelRef}
              className="font-mono text-amber-300 tabular-nums"
            >
              09:20
            </span>
            <span className="hidden sm:inline text-slate-400" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-sky-100 truncate max-w-[160px] md:max-w-none">
              {tr(activeModeObj.labelUk, activeModeObj.labelRu)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => resetCameraFnRef.current?.()}
            aria-label={tr('Загальний вигляд 3D-сцени', 'Общий вид 3D-сцены')}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[#091523]/82 hover:bg-[#0b66b2] border border-white/15 px-2.5 py-1 text-[11px] font-bold text-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{tr('Загальний вигляд', 'Общий вид')}</span>
          </button>
        </div>
      </div>

      {/* Integrated Control & Readout Bar Below 3D Scene */}
      <div className="border-t border-sky-200/20 bg-gradient-to-r from-[#071c36] via-[#0b2e55] to-[#072342] px-4 py-3.5 sm:px-5 sm:py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs sm:text-[13px]">
          <div className="font-extrabold text-white">
            {activeNode.order} · {tr(activeNode.titleUk, activeNode.titleRu)}
            <span className="mx-2 text-sky-400/70" aria-hidden="true">—</span>
            <span className="font-semibold text-amber-300">
              {tr(activeModeObj.labelUk, activeModeObj.labelRu)}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-sky-100/90 font-medium leading-[1.55] sm:text-right">
            {tr(activeModeObj.summaryUk, activeModeObj.summaryRu)}
          </p>
        </div>

        <div className="pt-2.5 border-t border-sky-200/15 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tr('Режим роботи станції', 'Режим работы станции')}>
            {SYSTEM_MODES.map((mode) => {
              const isActive = mode.id === activeMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setAutoCycle(false);
                    onSelectMode(mode.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#f59e0b] text-[#061c36] shadow-xs'
                      : 'bg-white/10 text-sky-100 hover:bg-white/18'
                  }`}
                >
                  {tr(mode.labelUk, mode.labelRu)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-pressed={autoCycle}
              onClick={() => setAutoCycle((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                autoCycle
                  ? 'bg-sky-500/25 border border-sky-400/50 text-sky-100 hover:bg-sky-500/35'
                  : 'bg-white/10 border border-transparent text-sky-100/80 hover:bg-white/20'
              }`}
            >
              {autoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{tr('Цикл доби', 'Цикл суток')}</span>
            </button>

            <button
              type="button"
              onClick={() => resetCameraFnRef.current?.()}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-sky-100 whitespace-nowrap cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{tr('Загальний вигляд', 'Общий вид')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
