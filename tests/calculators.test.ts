import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  calculateBatteryLifecycle,
  calculateSolarConstructor,
  calculateSolarPayback,
  DEFAULT_BUSINESS_TARIFF_UAH,
  DEFAULT_RESIDENTIAL_TARIFF_UAH,
  matchConstructorEquipment,
  ODESA_ANNUAL_YIELD_PER_KW,
} from '../src/lib/calculators.ts';
import type { Product } from '../src/types.ts';

function loadCatalogProducts(): Product[] {
  const raw = JSON.parse(fs.readFileSync(new URL('../server/seed/catalog.json', import.meta.url), 'utf8'));
  return raw.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    title: String(item.title),
    sku: String(item.sku ?? item.id),
    cat: String(item.cat) as Product['cat'],
    rawCats: Array.isArray(item.rawCats) ? item.rawCats.map(String) : [],
    brand: String(item.brand ?? ''),
    isKit: Boolean(item.isKit || item.cat === 'kits'),
    price: Number(item.price ?? 0),
    oldPrice: Number(item.oldPrice ?? 0),
    inStock: item.inStock !== false,
    statusLabel: String(item.statusLabel ?? ''),
    img: String(item.img ?? ''),
    specs: Array.isArray(item.specs) ? (item.specs as [string, string][]) : [],
    description: String(item.description ?? ''),
    sourceUrl: String(item.sourceUrl ?? ''),
  }));
}

const CATALOG = loadCatalogProducts();

test('payback calculator matches real 6 kW solar kit for 600 kWh/mo home hybrid and gives realistic 6-8 yr payback', () => {
  const res = calculateSolarPayback({
    monthlyKwh: 600,
    tariffType: 'home',
    systemMode: 'hybrid',
    tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH,
    usdUahRate: 42,
    products: CATALOG,
  });

  assert.equal(res.recommendedKw, 6);
  assert.equal(res.estimatedAnnualGenKwh, 6 * ODESA_ANNUAL_YIELD_PER_KW);
  assert.equal(res.usedCatalogKitPrice, true);
  assert.ok(res.primaryKit && res.primaryKit.price >= 4500);
  assert.ok(res.paybackYears && res.paybackYears >= 5.5 && res.paybackYears <= 8.5);
});

test('payback calculator for 5000 kWh/mo business on-grid uses turnkey commercial CAPEX (not bare inverter price)', () => {
  const res = calculateSolarPayback({
    monthlyKwh: 5000,
    tariffType: 'business',
    systemMode: 'ongrid',
    tariffUah: DEFAULT_BUSINESS_TARIFF_UAH,
    usdUahRate: 42,
    products: CATALOG,
  });

  assert.equal(res.recommendedKw, 50);
  assert.equal(res.usedCatalogKitPrice, false);
  assert.equal(res.indicativeCapexUah, Math.round(50 * 510 * 42));
  assert.ok(res.paybackYears && res.paybackYears >= 1.8 && res.paybackYears <= 2.8);
});

test('constructor calculator honors pump surge, conserves 24h energy curve totals, and caps savings by consumption', () => {
  const loads = [
    { id: 'fridge', watts: 140, surgeMult: 3.0, qty: 1, hoursPerDay: 8, critical: true },
    { id: 'it_lights', watts: 220, surgeMult: 1.1, qty: 1, hoursPerDay: 8, critical: true },
    { id: 'pump', watts: 1100, surgeMult: 2.8, qty: 1, hoursPerDay: 1.5, critical: false },
  ];

  const smallPv = calculateSolarConstructor({
    loads,
    simultaneity: 0.65,
    autonomyHours: 8,
    phases: 1,
    solarKw: 5,
    season: 'spring_autumn',
    tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH,
    preset: 'apartment',
  });

  const oversizedPv = calculateSolarConstructor({
    loads,
    simultaneity: 0.65,
    autonomyHours: 8,
    phases: 1,
    solarKw: 60,
    season: 'spring_autumn',
    tariffUah: DEFAULT_RESIDENTIAL_TARIFF_UAH,
    preset: 'apartment',
  });

  // Peak surge must reflect full incremental pump starting power (~1.98 kW above steady state)
  assert.ok(smallPv.peakSurgeKw >= smallPv.workingKw + 1.9);

  // 24h curve bars must sum cleanly to daily totals
  const pvSum = smallPv.hourlySim.reduce((s, h) => s + h.pvKw, 0);
  const loadSum = smallPv.hourlySim.reduce((s, h) => s + h.loadKw, 0);
  assert.ok(Math.abs(pvSum - smallPv.dailySolarGenKwh) < 0.3);
  assert.ok(Math.abs(loadSum - smallPv.dailyConsumptionKwh) < 0.3);

  // Oversized 60 kW array on tiny ~4.5 kWh/day load must NOT exceed annual electricity bill savings
  const maxAnnualBillUah = (smallPv.dailyConsumptionKwh * 365 * DEFAULT_RESIDENTIAL_TARIFF_UAH) / 12;
  assert.ok(oversizedPv.monthlySavingsUah <= maxAnnualBillUah + 50);
});

test('constructor equipment matcher respects 1-phase vs 3-phase and real panel wattage', () => {
  const eq1 = matchConstructorEquipment({
    products: CATALOG,
    recommendedInverterKw: 6,
    recommendedBatteryKwh: 5,
    phases: 1,
    solarKw: 6,
  });

  assert.ok(eq1.inverter);
  assert.ok(/1\s*фаз|sg\d+lp1|x1-/i.test(`${eq1.inverter.title} ${eq1.inverter.specs.flat().join(' ')}`));
  assert.ok(eq1.battery && !/bms|pdu/i.test(eq1.battery.title));
  assert.ok(eq1.panel && eq1.panelWatts >= 435 && eq1.panelsCount === Math.ceil(6000 / eq1.panelWatts));

  const eq3 = matchConstructorEquipment({
    products: CATALOG,
    recommendedInverterKw: 15,
    recommendedBatteryKwh: 15,
    phases: 3,
    solarKw: 15,
  });
  assert.ok(eq3.inverter);
  assert.ok(/3\s*фаз|sg\d+[lh]p3|x3-|h3-/i.test(`${eq3.inverter.title} ${eq3.inverter.specs.flat().join(' ')}`));
});

test('battery lifecycle calculator caps calendar life realistically for both LiFePO4 and AGM', () => {
  const rareOutages = calculateBatteryLifecycle(50, 10);
  assert.equal(rareOutages.lfpYears, 15);
  assert.equal(rareOutages.agmYears, 4.5);
  assert.equal(rareOutages.agmReplacements10y, 3);
  assert.ok(rareOutages.lfpCostPerKwhCents < rareOutages.agmCostPerKwhCents);

  const dailySolar = calculateBatteryLifecycle(350, 10);
  assert.equal(dailySolar.lfpYears, 15);
  assert.equal(dailySolar.agmYears, 1.3);
  assert.ok(dailySolar.agmTotal10yUsd > dailySolar.lfpTotal10yUsd * 4);
});
