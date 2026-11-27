import assert from 'node:assert/strict';
import test from 'node:test';
import { crmDealCreateSchema, dealPatchSchema, normalizePhoneInput } from '../server/validation.ts';

test('crmDealCreateSchema accepts manual lead with custom stage, assignee, and budget', () => {
  const parsed = crmDealCreateSchema.safeParse({
    type: 'lead',
    stage: 'proposal',
    customerName: 'Ігор Мельник',
    phone: '+380 67 412 88 19',
    customerEmail: 'ihor@example.com',
    city: 'Одеса',
    channel: 'Телефон',
    topic: 'Гібридна СЕС 10 кВт під ключ',
    taskType: 'Сонячна електростанція (СЕС)',
    loads: ['Газовий котел', 'Холодильник', 'Wi-Fi / Інтернет'],
    assignee: 'Олександр (інженер)',
    totalUsd: 5400,
    notes: 'Погоджено виїзд інженера на обʼєкт',
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.type, 'lead');
    assert.equal(parsed.data.stage, 'proposal');
    assert.equal(parsed.data.totalUsd, 5400);
    assert.equal(parsed.data.customerEmail, 'ihor@example.com');
    assert.equal(parsed.data.loads.length, 3);
    assert.equal(normalizePhoneInput(parsed.data.phone), '+380674128819');
  }
});

test('crmDealCreateSchema accepts manual order with catalog items', () => {
  const parsed = crmDealCreateSchema.safeParse({
    type: 'order',
    stage: 'fulfillment',
    customerName: 'ТОВ «Південь-Сервіс»',
    phone: '0509341502',
    items: [
      { productId: 'deye-sun-6k-sg06lp1-eu-bm2', qty: 2 },
      { productId: 'lifepo4-deye-se-g51-pro-b', qty: 1 },
    ],
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.items.length, 2);
    assert.equal(parsed.data.stage, 'fulfillment');
    assert.equal(normalizePhoneInput(parsed.data.phone), '+380509341502');
  }
});

test('crmDealCreateSchema rejects lead without topic/taskType and order without items/topic', () => {
  const emptyLead = crmDealCreateSchema.safeParse({
    type: 'lead',
    customerName: 'Андрій',
    phone: '+380501112233',
  });
  assert.equal(emptyLead.success, false);

  const emptyOrder = crmDealCreateSchema.safeParse({
    type: 'order',
    customerName: 'Андрій',
    phone: '+380501112233',
    items: [],
    topic: '',
  });
  assert.equal(emptyOrder.success, false);

  const archivedStage = crmDealCreateSchema.safeParse({
    type: 'lead',
    stage: 'archived',
    customerName: 'Андрій',
    phone: '+380501112233',
    topic: 'Тест',
  });
  assert.equal(archivedStage.success, false);
});

test('dealPatchSchema validates full editable deal & order fields', () => {
  const parsed = dealPatchSchema.safeParse({
    type: 'order',
    customerName: 'Ігор Мельник',
    phone: '+380674128819',
    customerEmail: 'MELNYK@EXAMPLE.COM',
    city: 'Одеса, Таїрова',
    channel: 'Telegram',
    topic: 'Гібридна СЕС 8 кВт + 2x АКБ',
    taskType: 'Резервне живлення (квартира / дім)',
    loads: ['Газовий котел', 'Холодильник'],
    items: [{ productId: 'deye-sun-6k-sg06lp1-eu-bm2', qty: 1 }],
    totalUsd: 4200,
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.customerEmail, 'melnyk@example.com');
    assert.equal(parsed.data.loads?.length, 2);
    assert.equal(parsed.data.items?.[0].qty, 1);
  }

  const badEmail = dealPatchSchema.safeParse({
    customerEmail: 'not-an-email',
  });
  assert.equal(badEmail.success, false);
});

