import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCycleClock,
  sampleSolarCycleState,
  SYSTEM_MODES,
  SYSTEM_NODES,
} from '../src/lib/howItWorksNodes.ts';

test('SYSTEM_NODES covers solar panels, inverter, battery, loads, and grid with full bilingual explanations', () => {
  const ids = SYSTEM_NODES.map((n) => n.id);
  assert.deepEqual(ids, ['panels', 'inverter', 'battery', 'loads', 'grid']);

  for (const node of SYSTEM_NODES) {
    assert.ok(node.titleUk.trim().length > 0);
    assert.ok(node.titleRu.trim().length > 0);
    assert.ok(node.connectionPathUk.trim().length > 0);
    assert.ok(node.howConnectsUk.trim().length > 20);
    assert.ok(node.whyNeededUk.trim().length > 20);
    assert.ok(node.whatGivesUk.trim().length > 20);
  }
});

test('SYSTEM_MODES models realistic energy flow directions and isolates grid during blackout', () => {
  const day = SYSTEM_MODES.find((m) => m.id === 'day_solar');
  const evening = SYSTEM_MODES.find((m) => m.id === 'evening_battery');
  const blackout = SYSTEM_MODES.find((m) => m.id === 'blackout');
  const night = SYSTEM_MODES.find((m) => m.id === 'night_tariff');

  assert.ok(day && day.flows.pvToInv > 0 && day.flows.invToBat > 0 && day.flows.invToGrid > 0);
  assert.ok(evening && evening.flows.pvToInv === 0 && evening.flows.invToBat < 0 && evening.flows.invToLoads > 0);
  assert.ok(blackout && blackout.gridOnline === false && blackout.flows.invToGrid === 0 && blackout.flows.invToLoads > 0);
  assert.ok(night && night.flows.invToGrid < 0 && night.flows.invToBat > 0);
});

test('sampleSolarCycleState moves sun east-to-west and shifts sky lighting from bright day to deep blue night and back', () => {
  const sunrise = sampleSolarCycleState(0.0);
  const noon = sampleSolarCycleState(0.25);
  const sunset = sampleSolarCycleState(0.5);
  const midnight = sampleSolarCycleState(0.75);
  const nextSunrise = sampleSolarCycleState(1.0);

  // Sun sweeps East (-X) -> Zenith (Y peak, X~0) -> West (+X) -> below horizon at night
  assert.ok(sunrise.sunPos[0] < -5);
  assert.ok(Math.abs(noon.sunPos[0]) < 0.01 && noon.sunPos[1] > 5.5);
  assert.ok(sunset.sunPos[0] > 5);
  assert.ok(midnight.sunElevation < -0.9 && midnight.sunOpacity === 0 && midnight.moonOpacity > 0.9);
  assert.equal(formatCycleClock(0.25), '12:00');
  assert.equal(formatCycleClock(0.75), '00:00');

  // Night lighting shifts into darker blue tones while house lights & stars activate
  const blueChannel = (hex: number) => hex & 0xff;
  const redChannel = (hex: number) => (hex >> 16) & 0xff;
  assert.ok(blueChannel(midnight.skyHorizonHex) > redChannel(midnight.skyHorizonHex));
  assert.ok(midnight.keyIntensity < noon.keyIntensity);
  assert.ok(midnight.starOpacity > 0.8 && noon.starOpacity === 0);
  assert.ok(midnight.windowGlow > noon.windowGlow && midnight.streetLampGlow > noon.streetLampGlow);

  // Seamless periodic wrap back to sunrise
  assert.equal(sunrise.suggestedMode, 'day_solar');
  assert.equal(sunset.suggestedMode, 'evening_battery');
  assert.equal(midnight.suggestedMode, 'night_tariff');
  assert.equal(nextSunrise.skyHorizonHex, sunrise.skyHorizonHex);
});

test('HowItWorks component splits node breakdown into three separate cards', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'HowItWorks.tsx'),
    'utf-8',
  );
  const articleMatches = source.match(/<article\b/g) ?? [];
  assert.equal(articleMatches.length, 3);
  assert.match(source, /grid grid-cols-1 md:grid-cols-3 gap-4/);
});


