import * as THREE from 'three';
import {
  getVisualBatteryModules,
  getVisualPanelCount,
  type Solar3DBatteryTier,
  type Solar3DComponentId,
  type Solar3DPowerTier,
  type Solar3DTelemetry,
} from '../../../lib/solar3dModel.ts';
import {
  createContactShadowTexture,
  createGroundGridTexture,
  createInverterLcdHandle,
  createSolarCellTexture,
  updateInverterLcdCanvas,
  type InverterLcdHandle,
} from './solarTextures.ts';

export type FlowChannelId = 'pv' | 'bat' | 'load' | 'grid';

interface FlowTrack {
  id: FlowChannelId;
  curve: THREE.CatmullRomCurve3;
  tubeMat: THREE.MeshStandardMaterial;
  pulses: THREE.Mesh[];
  pulseMat: THREE.MeshBasicMaterial;
  phase: number;
}

export interface SolarSceneController {
  root: THREE.Group;
  roofGroup: THREE.Group;
  interactables: THREE.Object3D[];
  lcdHandle: InverterLcdHandle;
  applyConfig: (tierKw: Solar3DPowerTier, batteryKwh: Solar3DBatteryTier, telemetry: Solar3DTelemetry) => void;
  updateFrame: (
    dt: number,
    telemetry: Solar3DTelemetry,
    cutawayOpen: boolean,
    selectedId: Solar3DComponentId | null,
    hoveredId: Solar3DComponentId | null,
  ) => void;
  dispose: () => void;
}

const _tmpVec = new THREE.Vector3();

function tagComponent(obj: THREE.Object3D, id: Solar3DComponentId): void {
  obj.userData.componentId = id;
  obj.traverse((child) => {
    child.userData.componentId = id;
  });
}

export function resolveComponentIdFromObject(obj: THREE.Object3D | null): Solar3DComponentId | null {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (typeof curr.userData?.componentId === 'string') {
      return curr.userData.componentId as Solar3DComponentId;
    }
    curr = curr.parent;
  }
  return null;
}

export function buildSolar3DScene(
  scene: THREE.Scene,
  anisotropy: number,
  enableShadows: boolean,
): SolarSceneController {
  const disposables: Array<{ dispose: () => void }> = [];
  const trackDisposable = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const root = new THREE.Group();
  scene.add(root);

  // Textures
  const solarTex = trackDisposable(createSolarCellTexture(anisotropy));
  const groundTex = trackDisposable(createGroundGridTexture(anisotropy));
  const shadowTex = trackDisposable(createContactShadowTexture());
  const lcdHandle = createInverterLcdHandle(anisotropy);
  trackDisposable(lcdHandle.texture);

  // Shared PBR materials
  const matPlaster = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xf2eee6,
      roughness: 0.86,
      metalness: 0.04,
    }),
  );
  const matPlinth = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.78,
      metalness: 0.14,
    }),
  );
  const matDeck = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xa67c52,
      roughness: 0.74,
      metalness: 0.05,
    }),
  );
  const matAnthracite = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.65,
    }),
  );
  const matAlum = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.34,
      metalness: 0.82,
    }),
  );
  const matRoofMetal = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x243447,
      roughness: 0.42,
      metalness: 0.55,
    }),
  );
  const matWindowGlow = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.15,
      roughness: 0.12,
      metalness: 0.25,
    }),
  );
  const matFloorInterior = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xdbe3ec,
      roughness: 0.8,
      metalness: 0.05,
    }),
  );

  // --- 1. Ground Base & Yard ---
  const groundGeo = trackDisposable(new THREE.BoxGeometry(12.2, 0.22, 9.6));
  const groundMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  const groundSlab = new THREE.Mesh(groundGeo, groundMat);
  groundSlab.position.set(0.4, -0.11, 0);
  groundSlab.receiveShadow = enableShadows;
  root.add(groundSlab);

  const grassGeo = trackDisposable(new THREE.BoxGeometry(4.2, 0.04, 7.6));
  const grassMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x4f7d58,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );
  const lawn = new THREE.Mesh(grassGeo, grassMat);
  lawn.position.set(-4.0, 0.01, 0.1);
  lawn.receiveShadow = enableShadows;
  root.add(lawn);

  // Soft contact shadow plane
  const contactGeo = trackDisposable(new THREE.PlaneGeometry(10.5, 8.2));
  const contactMat = trackDisposable(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  const contactShadow = new THREE.Mesh(contactGeo, contactMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0.2, 0.005, 0.1);
  root.add(contactShadow);

  // Stylized courtyard shrubs / trees
  const shrubTrunkGeo = trackDisposable(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 10));
  const shrubCrownGeo = trackDisposable(new THREE.DodecahedronGeometry(0.42, 1));
  const shrubCrownMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0x3b6e4c, roughness: 0.88, metalness: 0.0 }),
  );
  const shrubPositions: Array<[number, number, number]> = [
    [-4.8, 0.25, -2.5],
    [-5.1, 0.25, -1.6],
    [-4.7, 0.25, 2.2],
  ];
  for (const [sx, sy, sz] of shrubPositions) {
    const trunk = new THREE.Mesh(shrubTrunkGeo, matDeck);
    trunk.position.set(sx, sy, sz);
    trunk.castShadow = enableShadows;
    root.add(trunk);

    const crown = new THREE.Mesh(shrubCrownGeo, shrubCrownMat);
    crown.position.set(sx, sy + 0.45, sz);
    crown.castShadow = enableShadows;
    root.add(crown);
  }

  // --- 2. House Volume + Technical Niche ---
  const houseGroup = new THREE.Group();
  root.add(houseGroup);

  const plinthGeo = trackDisposable(new THREE.BoxGeometry(6.8, 0.24, 4.4));
  const plinth = new THREE.Mesh(plinthGeo, matPlinth);
  plinth.position.set(-0.2, 0.12, 0);
  plinth.receiveShadow = enableShadows;
  plinth.castShadow = enableShadows;
  houseGroup.add(plinth);

  // Wooden front terrace
  const terraceGeo = trackDisposable(new THREE.BoxGeometry(3.6, 0.12, 1.3));
  const terrace = new THREE.Mesh(terraceGeo, matDeck);
  terrace.position.set(-1.3, 0.06, 2.75);
  terrace.receiveShadow = enableShadows;
  houseGroup.add(terrace);

  // Interior floor slab visible when roof lifts
  const interiorFloorGeo = trackDisposable(new THREE.BoxGeometry(6.4, 0.04, 4.0));
  const interiorFloor = new THREE.Mesh(interiorFloorGeo, matFloorInterior);
  interiorFloor.position.set(-0.2, 0.25, 0);
  interiorFloor.receiveShadow = enableShadows;
  houseGroup.add(interiorFloor);

  // Left Living Zone walls (x: -3.5 .. 0.9)
  const backLivingGeo = trackDisposable(new THREE.BoxGeometry(4.4, 2.45, 0.22));
  const backLivingWall = new THREE.Mesh(backLivingGeo, matPlaster);
  backLivingWall.position.set(-1.3, 1.46, -1.99);
  backLivingWall.castShadow = enableShadows;
  backLivingWall.receiveShadow = enableShadows;
  houseGroup.add(backLivingWall);

  const leftWallGeo = trackDisposable(new THREE.BoxGeometry(0.22, 2.45, 4.2));
  const leftWall = new THREE.Mesh(leftWallGeo, matPlaster);
  leftWall.position.set(-3.39, 1.46, 0);
  leftWall.castShadow = enableShadows;
  leftWall.receiveShadow = enableShadows;
  houseGroup.add(leftWall);

  const frontLivingWallGeo = trackDisposable(new THREE.BoxGeometry(4.4, 2.45, 0.22));
  const frontLivingWall = new THREE.Mesh(frontLivingWallGeo, matPlaster);
  frontLivingWall.position.set(-1.3, 1.46, 1.99);
  frontLivingWall.castShadow = enableShadows;
  frontLivingWall.receiveShadow = enableShadows;
  houseGroup.add(frontLivingWall);

  // Partition wall between living zone and technical equipment hub (with glass door cutout look)
  const partitionGeo = trackDisposable(new THREE.BoxGeometry(0.18, 2.45, 4.0));
  const partitionWall = new THREE.Mesh(partitionGeo, matPlaster);
  partitionWall.position.set(0.85, 1.46, 0);
  partitionWall.castShadow = enableShadows;
  partitionWall.receiveShadow = enableShadows;
  houseGroup.add(partitionWall);

  // Technical hub back wall (x: 0.94 .. 3.1) - open front & right-glazing for unobstructed inspection
  const techBackGeo = trackDisposable(new THREE.BoxGeometry(2.26, 2.45, 0.24));
  const techBackWall = new THREE.Mesh(techBackGeo, matPlinth);
  techBackWall.position.set(1.98, 1.46, -1.98);
  techBackWall.castShadow = enableShadows;
  techBackWall.receiveShadow = enableShadows;
  houseGroup.add(techBackWall);

  // Corner steel column for tech hub
  const colGeo = trackDisposable(new THREE.BoxGeometry(0.16, 2.45, 0.16));
  const frontRightCol = new THREE.Mesh(colGeo, matAnthracite);
  frontRightCol.position.set(3.04, 1.46, 1.98);
  frontRightCol.castShadow = enableShadows;
  houseGroup.add(frontRightCol);

  const backRightCol = new THREE.Mesh(colGeo, matAnthracite);
  backRightCol.position.set(3.04, 1.46, -1.98);
  backRightCol.castShadow = enableShadows;
  houseGroup.add(backRightCol);

  // Front windows & entrance door on living zone
  const winFrameGeo = trackDisposable(new THREE.BoxGeometry(1.45, 1.25, 0.08));
  const winGlassGeo = trackDisposable(new THREE.BoxGeometry(1.3, 1.1, 0.04));

  const frontWindowFrame = new THREE.Mesh(winFrameGeo, matAnthracite);
  frontWindowFrame.position.set(-2.15, 1.48, 2.1);
  houseGroup.add(frontWindowFrame);

  const frontWindowGlass = new THREE.Mesh(winGlassGeo, matWindowGlow);
  frontWindowGlass.position.set(-2.15, 1.48, 2.13);
  houseGroup.add(frontWindowGlass);

  // Side window
  const sideWinFrame = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.08, 1.2, 1.6)),
    matAnthracite,
  );
  sideWinFrame.position.set(-3.5, 1.5, 0);
  houseGroup.add(sideWinFrame);

  const sideWinGlass = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.04, 1.05, 1.45)),
    matWindowGlow,
  );
  sideWinGlass.position.set(-3.53, 1.5, 0);
  houseGroup.add(sideWinGlass);

  // Entrance Door
  const doorFrame = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.95, 2.05, 0.09)),
    matAnthracite,
  );
  doorFrame.position.set(-0.35, 1.27, 2.1);
  houseGroup.add(doorFrame);

  const doorPanel = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.82, 1.92, 0.05)),
    matDeck,
  );
  doorPanel.position.set(-0.35, 1.26, 2.13);
  houseGroup.add(doorPanel);

  // Interior room warm light (glows in night/blackout when cutaway or through windows)
  const interiorLight = new THREE.PointLight(0xffb84d, 0.35, 7, 1.8);
  interiorLight.position.set(-1.3, 2.15, 0);
  houseGroup.add(interiorLight);

  // --- 3. Elevatable Pitched Roof + Dynamic Solar Panel Array ---
  const roofGroup = new THREE.Group();
  roofGroup.position.set(-0.2, 2.68, 0);
  root.add(roofGroup);

  const roofSlopeAngle = 0.44; // ~25 deg south tilt
  const roofWidth = 7.25;
  const slopeLength = 2.65;

  // Front (South) slope slab
  const southSlopeGeo = trackDisposable(new THREE.BoxGeometry(roofWidth, 0.12, slopeLength));
  const southSlope = new THREE.Mesh(southSlopeGeo, matRoofMetal);
  southSlope.position.set(0, 0.56, 1.12);
  southSlope.rotation.x = roofSlopeAngle;
  southSlope.castShadow = enableShadows;
  southSlope.receiveShadow = enableShadows;
  roofGroup.add(southSlope);

  // Rear (North) slope slab
  const northSlope = new THREE.Mesh(southSlopeGeo, matRoofMetal);
  northSlope.position.set(0, 0.56, -1.12);
  northSlope.rotation.x = -roofSlopeAngle;
  northSlope.castShadow = enableShadows;
  northSlope.receiveShadow = enableShadows;
  roofGroup.add(northSlope);

  // Ridge beam cap
  const ridgeCapGeo = trackDisposable(new THREE.BoxGeometry(roofWidth + 0.08, 0.14, 0.24));
  const ridgeCap = new THREE.Mesh(ridgeCapGeo, matAnthracite);
  ridgeCap.position.set(0, 1.15, 0);
  roofGroup.add(ridgeCap);

  // Gable triangular fills via ExtrudeGeometry
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.22, 0);
  gableShape.lineTo(2.22, 0);
  gableShape.lineTo(0, 1.06);
  gableShape.closePath();

  const gableGeo = trackDisposable(
    new THREE.ExtrudeGeometry(gableShape, { depth: 0.14, bevelEnabled: false }),
  );
  const leftGable = new THREE.Mesh(gableGeo, matPlaster);
  leftGable.rotation.y = Math.PI / 2;
  leftGable.position.set(-3.3, 0.02, 0);
  roofGroup.add(leftGable);

  const rightGable = new THREE.Mesh(gableGeo, matPlaster);
  rightGable.rotation.y = Math.PI / 2;
  rightGable.position.set(3.18, 0.02, 0);
  roofGroup.add(rightGable);

  // Solar Panels Group attached to South Slope
  const panelsGroup = new THREE.Group();
  panelsGroup.position.set(0, 0.64, 1.12);
  panelsGroup.rotation.x = roofSlopeAngle;
  roofGroup.add(panelsGroup);

  // 4 horizontal aluminum mounting rails
  const railGeo = trackDisposable(new THREE.BoxGeometry(6.75, 0.035, 0.04));
  for (const rz of [-0.95, -0.32, 0.32, 0.95]) {
    const rail = new THREE.Mesh(railGeo, matAlum);
    rail.position.set(0, 0.025, rz);
    panelsGroup.add(rail);
  }

  // Up to 20 solar modules (2 rows x 10 cols) with clearcoat silicon surface + aluminum frame
  const panelFrameGeo = trackDisposable(new THREE.BoxGeometry(0.62, 0.032, 1.04));
  const panelCellGeo = trackDisposable(new THREE.PlaneGeometry(0.58, 0.98));
  const matPanelCell = trackDisposable(
    new THREE.MeshPhysicalMaterial({
      map: solarTex,
      roughness: 0.22,
      metalness: 0.18,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
      emissive: 0x0b2956,
      emissiveIntensity: 0.08,
    }),
  );

  const panelMeshes: THREE.Group[] = [];
  const cols = 10;
  const rows = 2;
  const colSpacing = 0.66;
  const rowSpacing = 1.12;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const modGroup = new THREE.Group();
      const px = (c - (cols - 1) / 2) * colSpacing;
      const pz = (r - (rows - 1) / 2) * rowSpacing;
      modGroup.position.set(px, 0.055, pz);

      const frame = new THREE.Mesh(panelFrameGeo, matAnthracite);
      frame.castShadow = enableShadows;
      modGroup.add(frame);

      const cell = new THREE.Mesh(panelCellGeo, matPanelCell);
      cell.rotation.x = -Math.PI / 2;
      cell.position.y = 0.017;
      modGroup.add(cell);

      panelsGroup.add(modGroup);
      panelMeshes.push(modGroup);
    }
  }
  tagComponent(panelsGroup, 'panels');

  // --- 4. Hybrid Inverter (Technical Hub Wall) ---
  const inverterGroup = new THREE.Group();
  inverterGroup.position.set(1.62, 1.62, -1.78);
  houseGroup.add(inverterGroup);

  const invBodyMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xeaf0f6,
      roughness: 0.36,
      metalness: 0.22,
      emissive: 0x000000,
    }),
  );
  const invChassis = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.62, 0.82, 0.22)),
    invBodyMat,
  );
  invChassis.castShadow = enableShadows;
  inverterGroup.add(invChassis);

  // Dark upper heatsink cover & cooling fins
  const invTopCap = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.64, 0.16, 0.24)),
    matAnthracite,
  );
  invTopCap.position.set(0, 0.42, 0);
  inverterGroup.add(invTopCap);

  const finGeo = trackDisposable(new THREE.BoxGeometry(0.02, 0.65, 0.06));
  for (let f = -3; f <= 3; f++) {
    const fin = new THREE.Mesh(finGeo, matAlum);
    fin.position.set(f * 0.075, 0.05, -0.11);
    inverterGroup.add(fin);
  }

  // Live CanvasTexture OLED screen on inverter front face
  const lcdMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      map: lcdHandle.texture,
      emissiveMap: lcdHandle.texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.68,
      roughness: 0.18,
      metalness: 0.05,
    }),
  );
  const lcdPlane = new THREE.Mesh(
    trackDisposable(new THREE.PlaneGeometry(0.46, 0.34)),
    lcdMat,
  );
  lcdPlane.position.set(0, 0.08, 0.114);
  inverterGroup.add(lcdPlane);

  // Status LED strip under screen
  const invLedMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    }),
  );
  const invLedBar = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.44, 0.032, 0.025)),
    invLedMat,
  );
  invLedBar.position.set(0, -0.18, 0.115);
  inverterGroup.add(invLedBar);

  // Bottom DC/AC gland connectors
  const glandGeo = trackDisposable(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10));
  for (let g = -2; g <= 2; g++) {
    const gland = new THREE.Mesh(glandGeo, matAnthracite);
    gland.position.set(g * 0.09, -0.45, 0);
    inverterGroup.add(gland);
  }
  tagComponent(inverterGroup, 'inverter');

  // --- 5. Modular LiFePO4 Battery Stack ---
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(1.62, 0.24, -1.72);
  houseGroup.add(batteryGroup);

  const batBase = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.76, 0.07, 0.42)),
    matAnthracite,
  );
  batBase.position.set(0, 0.035, 0);
  batBase.castShadow = enableShadows;
  batteryGroup.add(batBase);

  const batModMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.38,
      metalness: 0.25,
    }),
  );
  const batLedMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    }),
  );

  const batteryModules: THREE.Group[] = [];
  const modBodyGeo = trackDisposable(new THREE.BoxGeometry(0.7, 0.2, 0.36));
  const modFaceGeo = trackDisposable(new THREE.BoxGeometry(0.54, 0.12, 0.025));
  const modLedGeo = trackDisposable(new THREE.BoxGeometry(0.24, 0.022, 0.03));

  for (let b = 0; b < 4; b++) {
    const mod = new THREE.Group();
    mod.position.set(0, 0.18 + b * 0.22, 0);

    const body = new THREE.Mesh(modBodyGeo, batModMat);
    body.castShadow = enableShadows;
    mod.add(body);

    const bezel = new THREE.Mesh(modFaceGeo, matAnthracite);
    bezel.position.set(0, 0, 0.18);
    mod.add(bezel);

    const led = new THREE.Mesh(modLedGeo, batLedMat);
    led.position.set(0, 0.01, 0.195);
    mod.add(led);

    batteryGroup.add(mod);
    batteryModules.push(mod);
  }
  tagComponent(batteryGroup, 'battery');

  // --- 6. AC Protection & ATS Shield ---
  const atsGroup = new THREE.Group();
  atsGroup.position.set(2.55, 1.56, -1.79);
  houseGroup.add(atsGroup);

  const atsBoxMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xdce4ee,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );
  const atsCabinet = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.48, 0.66, 0.18)),
    atsBoxMat,
  );
  atsCabinet.castShadow = enableShadows;
  atsGroup.add(atsCabinet);

  const atsWindow = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.36, 0.44, 0.03)),
    matAnthracite,
  );
  atsWindow.position.set(0, 0.02, 0.09);
  atsGroup.add(atsWindow);

  // Miniature DIN breakers inside shield
  const breakerGeo = trackDisposable(new THREE.BoxGeometry(0.055, 0.1, 0.04));
  const breakerMatAmber = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }),
  );
  const breakerMatBlue = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }),
  );
  for (let i = 0; i < 4; i++) {
    const br = new THREE.Mesh(breakerGeo, i < 2 ? breakerMatBlue : breakerMatAmber);
    br.position.set(-0.105 + i * 0.07, 0.05, 0.11);
    atsGroup.add(br);
  }

  const atsLedMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.3,
    }),
  );
  const atsLed = new THREE.Mesh(
    trackDisposable(new THREE.SphereGeometry(0.026, 12, 12)),
    atsLedMat,
  );
  atsLed.position.set(0, -0.22, 0.1);
  atsGroup.add(atsLed);
  tagComponent(atsGroup, 'ats');

  // --- 7. Smart Grid Pillar & Bidirectional Meter ---
  const gridGroup = new THREE.Group();
  gridGroup.position.set(4.55, 0, 1.35);
  root.add(gridGroup);

  const gridPlinth = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.68, 0.14, 0.68)),
    matPlinth,
  );
  gridPlinth.position.set(0, 0.07, 0);
  gridPlinth.receiveShadow = enableShadows;
  gridGroup.add(gridPlinth);

  const gridPillar = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.42, 1.48, 0.34)),
    matAnthracite,
  );
  gridPillar.position.set(0, 0.88, 0);
  gridPillar.castShadow = enableShadows;
  gridGroup.add(gridPillar);

  const meterGlass = new THREE.Mesh(
    trackDisposable(new THREE.BoxGeometry(0.24, 0.28, 0.03)),
    trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x164e63,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      }),
    ),
  );
  meterGlass.position.set(0, 1.12, 0.175);
  gridGroup.add(meterGlass);

  const gridBeaconMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.4,
      roughness: 0.25,
    }),
  );
  const gridBeacon = new THREE.Mesh(
    trackDisposable(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 16)),
    gridBeaconMat,
  );
  gridBeacon.position.set(0, 1.67, 0);
  gridGroup.add(gridBeacon);
  tagComponent(gridGroup, 'grid');

  // --- 8. Selection / Hover Highlight Ring ---
  const ringGeo = trackDisposable(new THREE.RingGeometry(0.55, 0.68, 36));
  const ringMat = trackDisposable(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  const highlightRing = new THREE.Mesh(ringGeo, ringMat);
  highlightRing.rotation.x = -Math.PI / 2;
  highlightRing.visible = false;
  root.add(highlightRing);

  // --- 9. Cable Conduits (TubeGeometry) & Energy Flow Pulses ---
  const flowTracks: FlowTrack[] = [];
  const pulseGeo = trackDisposable(new THREE.SphereGeometry(0.048, 12, 12));

  const createTrack = (
    id: FlowChannelId,
    points: THREE.Vector3[],
    pipeColor: number,
    pulseColor: number,
    pulseCount: number,
  ): FlowTrack => {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = trackDisposable(new THREE.TubeGeometry(curve, 36, 0.024, 8, false));
    const tubeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: pipeColor,
        emissive: pulseColor,
        emissiveIntensity: 0.18,
        roughness: 0.45,
        metalness: 0.4,
      }),
    );
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    root.add(tube);

    const pulseMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: pulseColor,
      }),
    );
    const pulses: THREE.Mesh[] = [];
    for (let i = 0; i < pulseCount; i++) {
      const m = new THREE.Mesh(pulseGeo, pulseMat);
      m.visible = false;
      root.add(m);
      pulses.push(m);
    }

    return { id, curve, tubeMat, pulses, pulseMat, phase: 0 };
  };

  // PV -> Inverter
  flowTracks.push(
    createTrack(
      'pv',
      [
        new THREE.Vector3(1.1, 2.95, 0.5),
        new THREE.Vector3(1.38, 2.75, -1.2),
        new THREE.Vector3(1.52, 2.15, -1.78),
        new THREE.Vector3(1.52, 1.98, -1.78),
      ],
      0x78350f,
      0xfbbf24,
      6,
    ),
  );

  // Inverter <-> Battery
  flowTracks.push(
    createTrack(
      'bat',
      [
        new THREE.Vector3(1.62, 1.2, -1.76),
        new THREE.Vector3(1.62, 1.04, -1.68),
        new THREE.Vector3(1.62, 0.85, -1.68),
      ],
      0x065f46,
      0x34d399,
      4,
    ),
  );

  // Inverter -> ATS Shield -> House Load
  flowTracks.push(
    createTrack(
      'load',
      [
        new THREE.Vector3(1.88, 1.56, -1.78),
        new THREE.Vector3(2.22, 1.56, -1.78),
        new THREE.Vector3(2.55, 1.56, -1.78),
        new THREE.Vector3(2.55, 2.25, -1.78),
        new THREE.Vector3(0.85, 2.25, -1.78),
        new THREE.Vector3(-0.3, 2.2, -1.2),
      ],
      0x0c4a6e,
      0x38bdf8,
      7,
    ),
  );

  // Grid Pillar <-> ATS Shield
  flowTracks.push(
    createTrack(
      'grid',
      [
        new THREE.Vector3(4.55, 0.2, 1.35),
        new THREE.Vector3(4.55, 0.08, -0.35),
        new THREE.Vector3(3.2, 0.08, -1.6),
        new THREE.Vector3(2.68, 0.35, -1.78),
        new THREE.Vector3(2.68, 1.28, -1.78),
      ],
      0x312e81,
      0xa78bfa,
      7,
    ),
  );

  const interactables: THREE.Object3D[] = [
    panelsGroup,
    inverterGroup,
    batteryGroup,
    atsGroup,
    gridGroup,
  ];

  const componentAnchors: Record<Solar3DComponentId, { pos: [number, number, number]; radius: number }> = {
    panels: { pos: [-0.2, 3.88, 1.25], radius: 2.1 },
    inverter: { pos: [1.62, 1.18, -1.65], radius: 0.65 },
    battery: { pos: [1.62, 0.28, -1.62], radius: 0.72 },
    ats: { pos: [2.55, 1.18, -1.65], radius: 0.56 },
    grid: { pos: [4.55, 0.06, 1.35], radius: 0.72 },
  };

  let lastLcdKey = '';

  const applyConfig = (
    tierKw: Solar3DPowerTier,
    batteryKwh: Solar3DBatteryTier,
    telemetry: Solar3DTelemetry,
  ) => {
    const visiblePanels = getVisualPanelCount(tierKw);
    for (let i = 0; i < panelMeshes.length; i++) {
      panelMeshes[i].visible = i < visiblePanels;
    }

    const visibleBatteries = getVisualBatteryModules(batteryKwh);
    for (let b = 0; b < batteryModules.length; b++) {
      batteryModules[b].visible = b < visibleBatteries;
    }

    const lcdKey = `${telemetry.mode}|${telemetry.pvKw}|${telemetry.loadKw}|${telemetry.batterySocPct}|${telemetry.batteryFlowKw}|${telemetry.gridFlowKw}|${telemetry.autonomyHours}`;
    if (lcdKey !== lastLcdKey) {
      lastLcdKey = lcdKey;
      updateInverterLcdCanvas(lcdHandle, telemetry);
    }
  };

  const updateFrame = (
    dt: number,
    telemetry: Solar3DTelemetry,
    cutawayOpen: boolean,
    selectedId: Solar3DComponentId | null,
    hoveredId: Solar3DComponentId | null,
  ) => {
    // Smooth roof elevation for cutaway interior view
    const targetRoofY = cutawayOpen ? 4.25 : 2.68;
    roofGroup.position.y = THREE.MathUtils.damp(roofGroup.position.y, targetRoofY, 7, dt);

    // Night / Blackout warm interior lighting inside windows
    const isDarkOrBackup = telemetry.mode === 'night' || telemetry.mode === 'blackout' || telemetry.sunElevation < 0.25;
    const targetWinGlow = telemetry.mode === 'night' ? 0.95 : telemetry.mode === 'blackout' ? 0.78 : isDarkOrBackup ? 0.55 : 0.1;
    matWindowGlow.emissiveIntensity = THREE.MathUtils.damp(matWindowGlow.emissiveIntensity, targetWinGlow, 5, dt);
    interiorLight.intensity = THREE.MathUtils.damp(interiorLight.intensity, isDarkOrBackup ? 1.5 : 0.25, 5, dt);

    // Panel specular solar energy subtle glow
    const targetPanelEmissive = telemetry.pvKw > 0.2 ? 0.12 + Math.min(0.25, telemetry.pvKw / 40) : 0.03;
    matPanelCell.emissiveIntensity = THREE.MathUtils.damp(matPanelCell.emissiveIntensity, targetPanelEmissive, 5, dt);

    // Inverter & Grid status LEDs
    if (telemetry.mode === 'blackout') {
      invLedMat.color.setHex(0xf59e0b);
      invLedMat.emissive.setHex(0xf59e0b);
      gridBeaconMat.color.setHex(0xef4444);
      gridBeaconMat.emissive.setHex(0xef4444);
      gridBeaconMat.emissiveIntensity = 0.45;
      atsLedMat.color.setHex(0xf59e0b);
      atsLedMat.emissive.setHex(0xf59e0b);
    } else if (telemetry.mode === 'night') {
      invLedMat.color.setHex(0x38bdf8);
      invLedMat.emissive.setHex(0x38bdf8);
      gridBeaconMat.color.setHex(0x22c55e);
      gridBeaconMat.emissive.setHex(0x22c55e);
      gridBeaconMat.emissiveIntensity = 1.2;
      atsLedMat.color.setHex(0x38bdf8);
      atsLedMat.emissive.setHex(0x38bdf8);
    } else {
      invLedMat.color.setHex(0x10b981);
      invLedMat.emissive.setHex(0x10b981);
      gridBeaconMat.color.setHex(0x22c55e);
      gridBeaconMat.emissive.setHex(0x22c55e);
      gridBeaconMat.emissiveIntensity = 1.35;
      atsLedMat.color.setHex(0x38bdf8);
      atsLedMat.emissive.setHex(0x38bdf8);
    }

    // Highlight ring on active/hovered component
    const activeTarget = hoveredId ?? selectedId;
    if (activeTarget) {
      const anchor = componentAnchors[activeTarget];
      highlightRing.visible = true;
      const roofOffset = activeTarget === 'panels' ? roofGroup.position.y - 2.68 : 0;
      highlightRing.position.set(anchor.pos[0], anchor.pos[1] + roofOffset, anchor.pos[2]);
      highlightRing.scale.setScalar(anchor.radius);
      ringMat.color.setHex(hoveredId && hoveredId !== selectedId ? 0x38bdf8 : 0xf59e0b);
    } else {
      highlightRing.visible = false;
    }

    // Animate energy pulses along TubeGeometry tracks
    for (const track of flowTracks) {
      let speed = 0; // signed speed
      if (track.id === 'pv') {
        speed = telemetry.pvKw > 0.1 ? 0.22 + Math.min(0.65, telemetry.pvKw * 0.05) : 0;
      } else if (track.id === 'bat') {
        if (Math.abs(telemetry.batteryFlowKw) >= 0.05) {
          // + charge: inverter -> bat (forward 0->1); - discharge: bat -> inverter (reverse 1->0)
          const mag = 0.25 + Math.min(0.55, Math.abs(telemetry.batteryFlowKw) * 0.06);
          speed = telemetry.batteryFlowKw >= 0 ? mag : -mag;
          track.pulseMat.color.setHex(telemetry.batteryFlowKw >= 0 ? 0x34d399 : 0xfbbf24);
          track.tubeMat.emissive.setHex(telemetry.batteryFlowKw >= 0 ? 0x34d399 : 0xfbbf24);
        }
      } else if (track.id === 'load') {
        speed = telemetry.loadKw > 0.1 ? 0.24 + Math.min(0.55, telemetry.loadKw * 0.07) : 0;
      } else if (track.id === 'grid') {
        if (telemetry.gridOnline && Math.abs(telemetry.gridFlowKw) >= 0.05) {
          const mag = 0.2 + Math.min(0.55, Math.abs(telemetry.gridFlowKw) * 0.05);
          // + import: grid pillar -> ATS (forward); - export: ATS -> grid pillar (reverse)
          speed = telemetry.gridFlowKw >= 0 ? mag : -mag;
          track.pulseMat.color.setHex(telemetry.gridFlowKw >= 0 ? 0xa78bfa : 0x34d399);
          track.tubeMat.emissive.setHex(telemetry.gridFlowKw >= 0 ? 0xa78bfa : 0x34d399);
        }
      }

      const active = Math.abs(speed) > 0.001;
      track.tubeMat.emissiveIntensity = active ? 0.32 : 0.04;

      if (active) {
        track.phase = (track.phase + dt * speed + 10) % 1;
      }

      const count = track.pulses.length;
      for (let i = 0; i < count; i++) {
        const mesh = track.pulses[i];
        mesh.visible = active;
        if (active) {
          const t = (track.phase + i / count) % 1;
          track.curve.getPointAt(t, _tmpVec);
          mesh.position.copy(_tmpVec);
        }
      }
    }
  };

  const dispose = () => {
    for (const d of disposables) {
      d.dispose();
    }
  };

  return {
    root,
    roofGroup,
    interactables,
    lcdHandle,
    applyConfig,
    updateFrame,
    dispose,
  };
}
