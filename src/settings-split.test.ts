import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { GLOBAL_COLUMNS, MOVED_COLUMNS, PERSONAL_COLUMNS, formForRole, personalSchedule, planScheduleSave } from './settings-split';
import { defaultSchedule, parseSchedule, type Schedule } from './user-schedule';

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

describe('column classification', () => {
  it('every app_settings column is classified global', () => {
    assert.deepEqual(sorted(Object.keys(Prisma.AppSettingsScalarFieldEnum)), sorted(GLOBAL_COLUMNS));
  });

  it('every user_settings column is classified personal', () => {
    const fields = Object.keys(Prisma.UserSettingsScalarFieldEnum).filter((f) => f !== 'userId' && f !== 'updatedAt');
    assert.deepEqual(sorted(fields), sorted(PERSONAL_COLUMNS));
  });

  it('a moved column is no longer on app_settings', () => {
    const left = Object.keys(Prisma.AppSettingsScalarFieldEnum);
    for (const column of MOVED_COLUMNS) assert.ok(!left.includes(column), column);
  });

  it('the secrets and the install-wide switches are global', () => {
    for (const column of ['aiKeys', 'sourceKeys', 'fetchingEnabled', 'employerMode', 'setupCompletedAt'] as const) {
      assert.ok(GLOBAL_COLUMNS.includes(column), column);
    }
  });
});

describe('personalSchedule', () => {
  const global: Schedule = { ...defaultSchedule('Europe/Kyiv'), fetch: { every: '4h', from: 8, to: 20, days: [1, 2, 3, 4, 5] } };
  const mine: Schedule = { ...defaultSchedule('America/Chicago'), alerts: { mode: 'digest', from: 8, to: 22, days: [1, 2, 3], digestAt: [7, 19] } };

  it('takes the zone and alerts from the person and the fetch half from the install', () => {
    const got = personalSchedule(mine, global, 'UTC');
    assert.equal(got.timezone, 'America/Chicago');
    assert.equal(got.alerts.mode, 'digest');
    assert.deepEqual(got.alerts.digestAt, [7, 19]);
    assert.equal(got.fetch.every, '4h');
  });

  it('a person with nothing saved gets the defaults in the install zone', () => {
    const got = personalSchedule(null, global, 'UTC');
    assert.equal(got.timezone, 'Europe/Kyiv');
    assert.equal(got.alerts.mode, 'instant');
  });

  it('unreadable JSON is a person with nothing saved', () => {
    assert.equal(personalSchedule({ nonsense: true }, global, 'UTC').alerts.mode, 'instant');
  });

  it('a migrated install reads exactly as it did', () => {
    const before = parseSchedule(global, 'UTC');
    const after = personalSchedule(global, global, 'UTC');
    assert.deepEqual(after, before);
  });
});

describe('schedule save', () => {
  const current = defaultSchedule('Europe/Kyiv');
  const form: Schedule = { ...current, timezone: 'Asia/Tokyo', fetch: { every: 'day', from: 1, to: 2, days: [1] } };

  it('an administrator stores both halves', () => {
    const plan = planScheduleSave(formForRole(form, current, true), true);
    assert.equal(plan.global?.fetch.every, 'day');
    assert.equal(plan.personal.timezone, 'Asia/Tokyo');
  });

  it('a member keeps the install fetch half and stores only their own', () => {
    const plan = planScheduleSave(formForRole(form, current, false), false);
    assert.equal(plan.global, null);
    assert.equal(plan.personal.fetch.every, 'hour');
    assert.equal(plan.personal.timezone, 'Asia/Tokyo');
  });
});
