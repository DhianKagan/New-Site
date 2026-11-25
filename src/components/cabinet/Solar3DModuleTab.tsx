import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BatteryCharging,
  Box,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Layers,
  Moon,
  RotateCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import type { Deal, Product } from '../../types.ts';
import { formatUahFromUsd } from '../../lib/currency.ts';
import { tr } from '../../lib/i18n.ts';
import {
  computeSolar3DTelemetry,
  deriveInitial3DConfig,
  getComponentInspectionMeta,
  match3DEquipment,
  type Solar3DBatteryTier,
  type Solar3DCameraPreset,
  type Solar3DComponentId,
  type Solar3DMode,
  type Solar3DPowerTier,
} from '../../lib/solar3dModel.ts';
import { SmartImage } from '../SmartImage.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';
import { buildSolar3DScene, resolveComponentIdFromObject } from './three/solarSceneBuilder.ts';

interface Solar3DModuleTabProps {
  deals: Deal[];
  wishlistProducts: Product[];
  products: Product[];
  usdUahRate: number | null;
  initialPresetSeed?: {
    tierKw?: Solar3DPowerTier;
    batteryKwh?: Solar3DBatteryTier;
    label?: string;
    nonce: number;
  } | null;
  onAddToCart: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
  onOpenLeadModal: (topic: string, estimatedTotalUsd?: number, notes?: string) => void;
}

const CAMERA_PRESETS: Record<
  Solar3DCameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; uk: string; ru: string }
> = {
  overview: {
    pos: [8.4, 6.2, 8.8],
    target: [0.6, 1.4, -0.2],
    uk: 'Загальний вигляд',
    ru: 'Общий вид',
  },
  roof: {
    pos: [-2.8, 7.1, 6.6],
    target: [-0.2, 3.0, 0.7],
    uk: 'Дах та СЕС',
    ru: 'Крыша и СЭС',
  },
  techwall: {
    pos: [2.2, 2.2, 2.1],
    target: [1.95, 1.35, -1.75],
    uk: 'Техзона (Інвертор)',
    ru: 'Техзона (Инвертор)',
  },
  battery: {
    pos: [3.2, 1.35, 1.15],
    target: [1.65, 0.75, -1.68],
    uk: 'Стійка АКБ',
    ru: 'Стойка АКБ',
  },
};

const _dayBgColor = new THREE.Color(0xdce8f4);
const _duskBgColor = new THREE.Color(0x9fb6d1);
const _nightBgColor = new THREE.Color(0x0c1726);
const _targetBgColor = new THREE.Color();
const _targetSunPos = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCamLook = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

export function Solar3DModuleTab({
  deals,
  wishlistProducts,
  products,
  usdUahRate,
  initialPresetSeed = null,
  onAddToCart,
  onSelectProduct,
  onOpenLeadModal,
}: Solar3DModuleTabProps) {
  const autoSeed = useMemo(
    () => deriveInitial3DConfig({ deals, wishlistProducts, products }),
    [deals, wishlistProducts, products],
  );

  const [mode, setMode] = useState<Solar3DMode>('solar');
  const [hourOfDay, setHourOfDay] = useState<number>(13);
  const [tierKw, setTierKw] = useState<Solar3DPowerTier>(
    initialPresetSeed?.tierKw ?? autoSeed.tierKw,
  );
  const [batteryKwh, setBatteryKwh] = useState<Solar3DBatteryTier>(
    initialPresetSeed?.batteryKwh ?? autoSeed.batteryKwh,
  );
  const [cutawayOpen, setCutawayOpen] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [selectedComponent, setSelectedComponent] = useState<Solar3DComponentId>('inverter');
  const [hoveredComponent, setHoveredComponent] = useState<Solar3DComponentId | null>(null);
  const [cameraPreset, setCameraPreset] = useState<Solar3DCameraPreset>('overview');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  // Sync if user clicked "Відкрити в 3D" from a specific deal or if seed changes when no manual seed
  const appliedSeedNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (initialPresetSeed && initialPresetSeed.nonce !== appliedSeedNonceRef.current) {
      appliedSeedNonceRef.current = initialPresetSeed.nonce;
      if (initialPresetSeed.tierKw) setTierKw(initialPresetSeed.tierKw);
      if (initialPresetSeed.batteryKwh) setBatteryKwh(initialPresetSeed.batteryKwh);
    }
  }, [initialPresetSeed]);

  const telemetry = useMemo(
    () =>
      computeSolar3DTelemetry({
        mode,
        hourOfDay,
        tierKw,
        batteryKwh,
        usdUahRate,
      }),
    [mode, hourOfDay, tierKw, batteryKwh, usdUahRate],
  );

  const equipment = useMemo(
    () => match3DEquipment({ products, tierKw, batteryKwh }),
    [products, tierKw, batteryKwh],
  );

  const componentMeta = useMemo(
    () => getComponentInspectionMeta(selectedComponent, tierKw, batteryKwh),
    [selectedComponent, tierKw, batteryKwh],
  );

  const matchedProductForSelection: Product | null = useMemo(() => {
    switch (selectedComponent) {
      case 'panels':
        return equipment.panel ?? equipment.kit;
      case 'inverter':
        return equipment.inverter ?? equipment.kit;
      case 'battery':
        return equipment.battery ?? equipment.kit;
      case 'ats':
      case 'grid':
        return equipment.kit ?? equipment.inverter;
    }
  }, [selectedComponent, equipment]);

  // Ref bridge so Three.js RAF reads live state without recreating renderer
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef({
    telemetry,
    tierKw,
    batteryKwh,
    cutawayOpen,
    autoRotate,
    selectedComponent,
    hoveredComponent,
  });
  simRef.current = {
    telemetry,
    tierKw,
    batteryKwh,
    cutawayOpen,
    autoRotate,
    selectedComponent,
    hoveredComponent,
  };

  const sceneControllerRef = useRef<ReturnType<typeof buildSolar3DScene> | null>(null);
  const cameraTransitionRef = useRef<{
    active: boolean;
    preset: Solar3DCameraPreset;
  }>({ active: false, preset: 'overview' });

  // Apply non-animation visual updates (panel counts, battery stack count, LCD canvas texture)
  useEffect(() => {
    sceneControllerRef.current?.applyConfig(tierKw, batteryKwh, telemetry);
  }, [tierKw, batteryKwh, telemetry]);

  const handleSelectCameraPreset = (preset: Solar3DCameraPreset) => {
    setCameraPreset(preset);
    setAutoRotate(false);
    cameraTransitionRef.current = { active: true, preset };
    if (preset === 'techwall') {
      setSelectedComponent('inverter');
    } else if (preset === 'battery') {
      setSelectedComponent('battery');
    } else if (preset === 'roof') {
      setSelectedComponent('panels');
    }
  };

  // Mount WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: isSoftwareGl ? 'low-power' : 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce8f4);
    scene.fog = new THREE.FogExp2(0xdce8f4, 0.022);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 3.2;
    controls.maxDistance = 17;
    controls.enablePan = true;
    controls.update();

    const onControlsStart = () => {
      cameraTransitionRef.current.active = false;
    };
    controls.addEventListener('start', onControlsStart);

    // Environment IBL
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Lighting rig: Cool Hemisphere + Warm Key Sun + Subtle Cool Rim
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.35);
    sunLight.position.set(6, 10, 7);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 30;
      sunLight.shadow.camera.left = -7.5;
      sunLight.shadow.camera.right = 7.5;
      sunLight.shadow.camera.top = 7.5;
      sunLight.shadow.camera.bottom = -7.5;
      sunLight.shadow.bias = -0.0008;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.55);
    rimLight.position.set(-8, 5, -7);
    scene.add(rimLight);

    const maxAnisotropy = isSoftwareGl
      ? 1
      : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const sceneController = buildSolar3DScene(scene, maxAnisotropy, !isSoftwareGl);
    sceneControllerRef.current = sceneController;
    sceneController.applyConfig(
      simRef.current.tierKw,
      simRef.current.batteryKwh,
      simRef.current.telemetry,
    );

    // Raycaster for hover & click inspection
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const getComponentAtEvent = (ev: PointerEvent): Solar3DComponentId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(sceneController.interactables, true);
      if (hits.length === 0) return null;
      return resolveComponentIdFromObject(hits[0].object);
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      const hitId = getComponentAtEvent(ev);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      setHoveredComponent((prev) => (prev === hitId ? prev : hitId));
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownPos.x;
      const dy = ev.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return; // drag > 6px
      const hitId = getComponentAtEvent(ev);
      if (hitId) {
        setSelectedComponent(hitId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp container resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(240, Math.round(entry.contentRect.width));
      const h = Math.max(300, Math.round(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Context lost / restored resilience
    let contextLost = false;
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Animation loop with software-GL fence sync throttle
    let rafId = 0;
    let swTimerId: number | null = null;
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (tick: () => void) => {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const gl = renderer.getContext();
      if ('fenceSync' in gl) {
        const gl2 = gl as WebGL2RenderingContext;
        const fence = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const check = () => {
          if (disposed) {
            gl2.deleteSync(fence!);
            return;
          }
          if (gl2.clientWaitSync(fence!, 0, 0) === gl2.TIMEOUT_EXPIRED) {
            swTimerId = window.setTimeout(check, 50);
          } else {
            gl2.deleteSync(fence!);
            swTimerId = window.setTimeout(() => {
              rafId = requestAnimationFrame(tick);
            }, 80);
          }
        };
        swTimerId = window.setTimeout(check, 50);
      } else {
        swTimerId = window.setTimeout(() => {
          rafId = requestAnimationFrame(tick);
        }, 120);
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!contextLost) {
        const state = simRef.current;

        // Smooth camera preset transition
        if (cameraTransitionRef.current.active) {
          const preset = CAMERA_PRESETS[cameraTransitionRef.current.preset];
          _targetCamPos.set(...preset.pos);
          _targetCamLook.set(...preset.target);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 5.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 5.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 5.5, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetCamLook.x, 5.5, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetCamLook.y, 5.5, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetCamLook.z, 5.5, dt);

          if (camera.position.distanceTo(_targetCamPos) < 0.06) {
            cameraTransitionRef.current.active = false;
          }
        }

        controls.autoRotate = state.autoRotate && !cameraTransitionRef.current.active;
        controls.autoRotateSpeed = 0.7;
        controls.update();

        // Sun & Sky backdrop interpolation
        const elev = state.telemetry.sunElevation;
        const isNight = state.telemetry.mode === 'night' || elev <= 0.03;

        if (isNight) {
          _targetBgColor.copy(_nightBgColor);
        } else if (elev < 0.45) {
          _targetBgColor.copy(_duskBgColor).lerp(_dayBgColor, elev / 0.45);
        } else {
          _targetBgColor.copy(_dayBgColor);
        }

        if (scene.background instanceof THREE.Color) {
          scene.background.lerp(_targetBgColor, Math.min(1, dt * 4));
          if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.color.copy(scene.background);
          }
        }

        const az = state.telemetry.sunAzimuthRad;
        _targetSunPos.set(Math.sin(az) * 11, 2.5 + elev * 10, 6.5 + Math.cos(az) * 3.5);
        sunLight.position.lerp(_targetSunPos, Math.min(1, dt * 5));
        sunLight.intensity = THREE.MathUtils.damp(
          sunLight.intensity,
          isNight ? 0.25 : 0.9 + elev * 1.75,
          5,
          dt,
        );
        hemiLight.intensity = THREE.MathUtils.damp(
          hemiLight.intensity,
          isNight ? 0.34 : 0.65 + elev * 0.15,
          5,
          dt,
        );

        sceneController.updateFrame(
          dt,
          state.telemetry,
          state.cutawayOpen,
          state.selectedComponent,
          state.hoveredComponent,
        );

        renderer.render(scene, camera);
      }

      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (swTimerId !== null) window.clearTimeout(swTimerId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      sceneController.dispose();
      sceneControllerRef.current = null;
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const formatHourLabel = (h: number) => `${String(Math.round(h)).padStart(2, '0')}:00`;

  const modeTitle =
    mode === 'blackout'
      ? tr('Блекаут (АВР)', 'Блэкаут (АВР)')
      : mode === 'night'
        ? tr('Нічний режим', 'Ночной режим')
        : tr('Сонячний день', 'Солнечный день');

  return (
    <div className="space-y-4">
      {/* Top Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0d1f33] flex items-center gap-2">
            <Box className="w-5 h-5 text-[#1769aa]" />
            <span>{tr('Інтерактивний 3D-двійник вашої СЕС', 'Интерактивный 3D-двойник вашей СЭС')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {initialPresetSeed?.label
              ? initialPresetSeed.label
              : tr(autoSeed.sourceLabelUk, autoSeed.sourceLabelRu)}{' '}
            · {tr('Обертайте будинок на 360°, клікайте по вузлах і тестуйте блекаут у реальному часі.', 'Вращайте дом на 360°, кликайте по узлам и тестируйте блэкаут в реальном времени.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['panels', tr('Панелі', 'Панели')],
              ['inverter', tr('Інвертор', 'Инвертор')],
              ['battery', tr('АКБ', 'АКБ')],
              ['ats', tr('Щит АВР', 'Щит АВР')],
              ['grid', tr('Мережа', 'Сеть')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedComponent(id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                selectedComponent === id
                  ? 'bg-[#0d1f33] text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-[#1769aa] hover:text-[#0d1f33]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Viewport Stage */}
      <div className="relative w-full h-[560px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-300 bg-[#0c1726] shadow-sm">
        {/* Isolated Three.js Mount */}
        <div
          ref={mountRef}
          aria-label={tr('Інтерактивна 3D-сцена сонячної електростанції', 'Интерактивная 3D-сцена солнечной электростанции')}
          className="w-full h-full"
        />

        {webglUnavailable && (
          <div className="absolute inset-0 bg-[#0d1f33] text-white flex flex-col items-center justify-center p-6 text-center z-20">
            <AlertTriangle className="w-10 h-10 text-[#f59e0b] mb-3" />
            <h3 className="text-base font-extrabold">
              {tr('3D-прискорення WebGL недоступне у вашому браузері', '3D-ускорение WebGL недоступно в вашем браузере')}
            </h3>
            <p className="text-xs text-slate-300 max-w-md mt-1.5 leading-relaxed">
              {tr(
                'Увімкніть апаратне прискорення або скористайтеся вкладкою «Схеми підключення» чи «Конструктор СЕС» для детального підбору обладнання.',
                'Включите аппаратное ускорение или используйте вкладку «Схемы подключения» или «Конструктор СЭС» для детального подбора оборудования.',
              )}
            </p>
          </div>
        )}

        {/* Top-Left Live Telemetry Readout (solid rgba, zero backdrop-blur) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-2 max-w-[330px]">
          <div className="pointer-events-auto rounded-xl bg-[#0d1f33]/92 border border-white/15 text-white px-3.5 py-2.5 shadow-md">
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-300 mb-2">
              <span>{modeTitle} · {formatHourLabel(telemetry.effectiveHour)}</span>
              <span className="font-mono text-[#f59e0b] tabular-nums">
                {tierKw} кВт / {batteryKwh} кВт·год
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-[10px] text-amber-300 font-semibold">{tr('СЕС', 'СЭС')}</div>
                <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                  {telemetry.pvKw.toFixed(1)} <span className="text-[10px] font-normal">кВт</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-[10px] text-sky-300 font-semibold">{tr('Дім', 'Дом')}</div>
                <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                  {telemetry.loadKw.toFixed(1)} <span className="text-[10px] font-normal">кВт</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-[10px] text-emerald-300 font-semibold">{tr('АКБ', 'АКБ')}</div>
                <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                  {telemetry.batterySocPct}%
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-2 py-1.5">
                <div className="text-[10px] text-violet-300 font-semibold">
                  {telemetry.gridOnline ? tr('Мережа', 'Сеть') : tr('Резерв', 'Резерв')}
                </div>
                <div className="text-xs font-extrabold font-mono tabular-nums mt-0.5">
                  {telemetry.gridOnline
                    ? `${telemetry.gridFlowKw > 0 ? '+' : ''}${telemetry.gridFlowKw.toFixed(1)}`
                    : `${telemetry.autonomyHours.toFixed(0)}г`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Selected Component Inspector (compact on desktop, stays crisp) */}
        <div className="hidden md:block absolute top-3 right-3 z-10 w-[300px]">
          <div className="rounded-xl bg-[#0d1f33]/92 border border-white/15 text-white p-3.5 shadow-md space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]">
                  {tr('Вузол системи', 'Узел системы')}
                </div>
                <h3 className="text-sm font-extrabold leading-snug mt-0.5">
                  {tr(componentMeta.titleUk, componentMeta.titleRu)}
                </h3>
              </div>
              <Cpu className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {tr(componentMeta.roleUk, componentMeta.roleRu)}
            </p>

            <ul className="space-y-1 text-[11px] text-slate-200">
              {(tr('uk', 'ru') === 'uk' ? componentMeta.specsUk : componentMeta.specsRu).map((spec) => (
                <li key={spec} className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{spec}</span>
                </li>
              ))}
            </ul>

            {matchedProductForSelection && (
              <div className="pt-2 border-t border-white/15 space-y-2">
                <div className="flex items-center gap-2.5">
                  {matchedProductForSelection.img && (
                    <SmartImage
                      src={matchedProductForSelection.img}
                      alt={matchedProductForSelection.title}
                      className="w-10 h-10 rounded-lg object-cover bg-white shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
                      {matchedProductForSelection.title}
                    </div>
                    <div className="text-xs font-extrabold font-mono text-[#f59e0b] tabular-nums mt-0.5">
                      {formatUahFromUsd(matchedProductForSelection.price, usdUahRate)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAddToCart(matchedProductForSelection)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {tr('У кошик', 'В корзину')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectProduct) {
                        onSelectProduct(matchedProductForSelection);
                      } else {
                        onOpenLeadModal(
                          `3D-конфігурація ${tierKw} кВт / ${batteryKwh} кВт·год`,
                          equipment.estimatedTotalUsd,
                        );
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {tr('Детальніше', 'Подробнее')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Bottom Control Dock */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[940px] rounded-xl bg-[#0d1f33]/94 border border-white/15 text-white shadow-lg overflow-hidden">
            {/* Dock Header Bar */}
            <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['solar', Sun, tr('День', 'День')],
                    ['blackout', Zap, tr('Блекаут', 'Блэкаут')],
                    ['night', Moon, tr('Ніч', 'Ночь')],
                  ] as const
                ).map(([mId, Icon, label]) => (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => {
                      setMode(mId);
                      if (mId === 'solar' && hourOfDay > 19) setHourOfDay(13);
                      if (mId === 'night' && hourOfDay < 19) setHourOfDay(21);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                      mode === mId
                        ? mId === 'blackout'
                          ? 'bg-[#f59e0b] text-[#0d1f33]'
                          : 'bg-[#1769aa] text-white'
                        : 'bg-white/10 text-slate-200 hover:bg-white/18'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCutawayOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    cutawayOpen
                      ? 'bg-emerald-500 text-[#0d1f33]'
                      : 'bg-white/10 text-slate-200 hover:bg-white/18'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{tr('Розріз даху', 'Разрез крыши')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutoRotate((v) => !v)}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    autoRotate
                      ? 'bg-sky-500 text-[#0d1f33]'
                      : 'bg-white/10 text-slate-200 hover:bg-white/18'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{tr('Огляд 360°', 'Обзор 360°')}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <span>{dockCollapsed ? tr('Параметри', 'Параметры') : tr('Згорнути', 'Свернуть')}</span>
                {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!dockCollapsed && (
              <div className="px-3.5 py-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-[11px]">
                {/* Station Power & Battery */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 font-semibold">{tr('СЕС масив:', 'СЭС массив:')}</span>
                    <div className="flex gap-1">
                      {([5, 10, 15] as const).map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => setTierKw(kw)}
                          className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer ${
                            tierKw === kw ? 'bg-[#f59e0b] text-[#0d1f33]' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {kw} кВт
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 font-semibold">{tr('Ємність АКБ:', 'Ёмкость АКБ:')}</span>
                    <div className="flex gap-1">
                      {([5, 10, 20] as const).map((kwh) => (
                        <button
                          key={kwh}
                          type="button"
                          onClick={() => setBatteryKwh(kwh)}
                          className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer ${
                            batteryKwh === kwh ? 'bg-emerald-400 text-[#0d1f33]' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {kwh} кВт·г
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sun Position / Time of Day Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">{tr('Сонце / Час доби', 'Солнце / Время суток')}</span>
                    <span className="font-mono font-bold text-[#f59e0b] tabular-nums">
                      {formatHourLabel(hourOfDay)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={22}
                    step={0.5}
                    value={hourOfDay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHourOfDay(val);
                      if (val >= 20) setMode('night');
                      else if (mode === 'night') setMode('solar');
                    }}
                    className="w-full accent-[#f59e0b] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>06:00</span>
                    <span>13:00 (пік)</span>
                    <span>22:00</span>
                  </div>
                </div>

                {/* Camera Presets */}
                <div className="space-y-1">
                  <div className="text-slate-300 font-semibold">{tr('Ракурси камери', 'Ракурсы камеры')}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(CAMERA_PRESETS) as Solar3DCameraPreset[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectCameraPreset(key)}
                        className={`px-2 py-1 rounded text-[10px] font-bold truncate cursor-pointer transition-colors ${
                          cameraPreset === key
                            ? 'bg-sky-400 text-[#0d1f33]'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        }`}
                      >
                        {tr(CAMERA_PRESETS[key].uk, CAMERA_PRESETS[key].ru)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Inspector + Turnkey Kit Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#d97706] flex items-center justify-center shrink-0">
              <BatteryCharging className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-[#0d1f33]">
                {tr(
                  `Підібрана конфігурація: ${tierKw} кВт СЕС + ${batteryKwh} кВт·год LiFePO4`,
                  `Подобранная конфигурация: ${tierKw} кВт СЭС + ${batteryKwh} кВт·ч LiFePO4`,
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  {tr('Генерація в середньому:', 'Выработка в среднем:')}{' '}
                  <strong className="text-[#0d1f33] font-mono">{telemetry.dailyGenKwh} кВт·г/день</strong>
                </span>
                <span>
                  {tr('Автономність у блекаут:', 'Автономность в блэкаут:')}{' '}
                  <strong className="text-emerald-700 font-mono">~{telemetry.autonomyHours} год</strong>
                </span>
                {telemetry.monthlySavingsUah !== null && (
                  <span>
                    {tr('Економія на тарифі:', 'Экономия на тарифе:')}{' '}
                    <strong className="text-[#1769aa] font-mono">
                      ~{telemetry.monthlySavingsUah.toLocaleString('uk-UA')} грн/міс
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {equipment.kit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToCart(equipment.kit!)}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {tr('Комплект у кошик', 'Комплект в корзину')}
              </Button>
            )}
            <Button
              variant="accent"
              size="sm"
              onClick={() =>
                onOpenLeadModal(
                  `3D-проєкт СЕС ${tierKw} кВт + АКБ ${batteryKwh} кВт·год`,
                  equipment.estimatedTotalUsd,
                  `Сконфігуровано в 3D-кабінеті: режим=${mode}, панелей=${telemetry.panelCount} шт, модулів АКБ=${telemetry.batteryUnits}.`,
                )
              }
              className="bg-[#f59e0b] hover:bg-[#d97706] text-[#0d1f33] font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {tr('Замовити проєкт під ключ', 'Заказать проект под ключ')}
            </Button>
          </div>
        </Card>

        {/* Mobile / Compact Selected Node Card */}
        <Card className="p-4 md:hidden space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1769aa]">
            {tr('Обраний вузол', 'Выбранный узел')}
          </div>
          <div className="text-sm font-extrabold text-[#0d1f33]">
            {tr(componentMeta.titleUk, componentMeta.titleRu)}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {tr(componentMeta.roleUk, componentMeta.roleRu)}
          </p>
          {matchedProductForSelection && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0d1f33] truncate">
                  {matchedProductForSelection.title}
                </div>
                <div className="text-xs font-mono font-extrabold text-[#1769aa]">
                  {formatUahFromUsd(matchedProductForSelection.price, usdUahRate)}
                </div>
              </div>
              <Button size="sm" onClick={() => onAddToCart(matchedProductForSelection)}>
                {tr('У кошик', 'В корзину')}
              </Button>
            </div>
          )}
        </Card>

        {/* Desktop Hardware Price Breakdown */}
        <Card className="hidden lg:flex flex-col justify-between p-4">
          <div className="text-xs font-extrabold text-[#0d1f33] mb-1">
            {tr('Орієнтовна вартість обладнання', 'Ориентировочная стоимость оборудования')}
          </div>
          <div className="text-xl font-extrabold font-mono text-[#1769aa] tabular-nums">
            {equipment.estimatedTotalUsd > 0
              ? formatUahFromUsd(equipment.estimatedTotalUsd, usdUahRate)
              : tr('За запитом', 'По запросу')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {tr(
              `${equipment.panelsCount} панелей · ${equipment.batteryUnits}× LiFePO4 блок · 10 років гарантії на монтаж`,
              `${equipment.panelsCount} панелей · ${equipment.batteryUnits}× LiFePO4 блок · 10 лет гарантии на монтаж`,
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
