import { openDB, type IDBPDatabase } from 'idb';
import { finalStateOf, type HandRecord } from '../engine/replay';
import { isDecisionSnapshot, type DecisionSnapshot } from '../lab/analysis';
import { isValidTrainingProgress, type TrainingProgress } from '../training/progress';

export const MAX_SAVED_HANDS = 1000;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_CHIPS = 1_000_000_000;
const DB_NAME = 'holdem-lab-private-v1';
const STORE = 'app';
const KEY = 'snapshot';

export interface LabSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  speed: 'slow' | 'normal' | 'fast';
  coachEnabled: boolean;
  soundEnabled: boolean;
  preset: 'tight' | 'standard' | 'loose';
}
export interface SavedLabHand {
  record: HandRecord;
  completedAt: number;
  net: number;
  decisions?: DecisionSnapshot[];
}
export interface LabData {
  schemaVersion: 1;
  savedAt: number;
  session: HandRecord | null;
  sessionDecisions: DecisionSnapshot[];
  /** Most recent 1000 complete hands; cumulative totals are independent. */
  hands: SavedLabHand[];
  totals: { handsPlayed: number; netChips: number };
  training: TrainingProgress;
  settings: LabSettings;
}
export class PersistenceError extends Error {
  readonly code: 'quota' | 'unavailable' | 'invalid';
  constructor(code: PersistenceError['code'], message: string) {
    super(message); this.name = 'PersistenceError'; this.code = code;
  }
}
export function createEmptyData(): LabData {
  return {
    schemaVersion: 1, savedAt: Date.now(), session: null, sessionDecisions: [], hands: [],
    totals: { handsPlayed: 0, netChips: 0 }, training: {},
    settings: { difficulty: 'medium', speed: 'normal', coachEnabled: true, soundEnabled: false, preset: 'standard' },
  };
}
function invalid(message = '备份格式或内容无效，未覆盖现有记录。'): never {
  throw new PersistenceError('invalid', message);
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function text(value: unknown, max = 100): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
function decisions(value: unknown): value is DecisionSnapshot[] {
  return Array.isArray(value) && value.length <= 500 && value.every((entry) => isDecisionSnapshot(entry) && entry.heroSeat === 0 && entry.bb === 10 && entry.players.length === 6) && new Set(value.map((entry) => entry.decisionId)).size === value.length;
}
function handRecord(value: unknown): value is HandRecord {
  if (!object(value) || !keys(value, ['handId', 'config', 'seed', 'actions']) || !text(value.handId) || !integer(value.seed, 0, 0xffffffff) || !Array.isArray(value.actions) || value.actions.length > 500) return false;
  const config = value.config;
  if (!object(config) || !keys(config, ['smallBlind', 'bigBlind', 'buttonIndex', 'seats']) || config.smallBlind !== 5 || config.bigBlind !== 10 || !Array.isArray(config.seats) || config.seats.length !== 6 || !integer(config.buttonIndex, 0, 5)) return false;
  if (!config.seats.every((seat) => object(seat) && keys(seat, ['id', 'name', 'stack', 'isHero', 'personalityId']) && text(seat.id, 80) && text(seat.name, 80) && integer(seat.stack, 1, MAX_CHIPS) && typeof seat.isHero === 'boolean' && (seat.personalityId === undefined || oneOf(seat.personalityId, ['shark', 'rock', 'maniac', 'fish', 'nit'])))) return false;
  if (new Set(config.seats.map((seat) => seat.id)).size !== config.seats.length || config.seats.filter((seat) => seat.isHero).length !== 1 || !config.seats[0].isHero) return false;
  if (!value.actions.every((action) => object(action) && keys(action, ['type', 'amount']) && oneOf(action.type, ['fold', 'check', 'call', 'raise']) && (action.type === 'raise' ? integer(action.amount, 1, MAX_CHIPS) : action.amount === undefined))) return false;
  return true;
}
// Autosave checks unchanged historical hands without replaying the whole history each click.
// The key includes every input byte, so mutating a record invalidates its cached result.
const replayCache = new Map<string, { complete: boolean; net: number }>();
function checkedReplay(record: HandRecord): { complete: boolean; net: number } {
  const key = JSON.stringify(record);
  const prior = replayCache.get(key);
  if (prior) return prior;
  const final = finalStateOf(record);
  const hero = final.players.find((player) => player.isHero)!;
  const result = { complete: final.phase === 'complete', net: hero.stack - hero.startingStack };
  if (replayCache.size >= MAX_SAVED_HANDS * 2) replayCache.delete(replayCache.keys().next().value!);
  replayCache.set(key, result);
  return result;
}

/** Validate the whole snapshot before any storage mutation. Unknown keys are rejected. */
export function validateLabData(value: unknown): LabData {
  if (!object(value) || !keys(value, ['schemaVersion', 'savedAt', 'session', 'sessionDecisions', 'hands', 'totals', 'training', 'settings']) || value.schemaVersion !== 1) invalid('此备份版本不受支持，未覆盖现有记录。');
  if (!integer(value.savedAt) || !(value.session === null || handRecord(value.session)) || !decisions(value.sessionDecisions) || !Array.isArray(value.hands) || value.hands.length > MAX_SAVED_HANDS || !object(value.totals) || !keys(value.totals, ['handsPlayed', 'netChips']) || !integer(value.totals.handsPlayed) || !integer(value.totals.netChips, -Number.MAX_SAFE_INTEGER) || value.totals.handsPlayed < value.hands.length || !isValidTrainingProgress(value.training)) invalid();
  const settings = value.settings;
  if (!object(settings) || !keys(settings, ['difficulty', 'speed', 'coachEnabled', 'soundEnabled', 'preset']) || !oneOf(settings.difficulty, ['easy', 'medium', 'hard']) || !oneOf(settings.speed, ['slow', 'normal', 'fast']) || typeof settings.coachEnabled !== 'boolean' || typeof settings.soundEnabled !== 'boolean' || !oneOf(settings.preset, ['tight', 'standard', 'loose'])) invalid();
  const ids = new Set<string>();
  for (const hand of value.hands) {
    if (!object(hand) || !keys(hand, ['record', 'completedAt', 'net', 'decisions']) || !handRecord(hand.record) || !integer(hand.completedAt) || !integer(hand.net, -MAX_CHIPS, MAX_CHIPS * 6) || (hand.decisions !== undefined && !decisions(hand.decisions)) || ids.has(hand.record.handId)) invalid();
    ids.add(hand.record.handId);
    try {
      const final = checkedReplay(hand.record);
      if (!final.complete || final.net !== hand.net) invalid();
    } catch { invalid('备份中有无法重放或结算不一致的手牌，未覆盖现有记录。'); }
  }
  if (value.session) {
    try { checkedReplay(value.session); }
    catch { invalid('备份中的当前手牌无法重放，未覆盖现有记录。'); }
  } else if (value.sessionDecisions.length !== 0) invalid();
  return JSON.parse(JSON.stringify(value)) as LabData;
}
export function parseBackup(json: string): LabData {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) invalid('备份超过 10 MB，未导入。');
  let value: unknown;
  try { value = JSON.parse(json); } catch { invalid('无法读取此 JSON 备份，未覆盖现有记录。'); }
  return validateLabData(value);
}
export function exportBackup(data: LabData): string {
  const json = JSON.stringify(validateLabData(data));
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) invalid('备份超过 10 MB，请先减少保留手牌。');
  return json;
}
export interface PreparedBackup {
  json: string;
  /** Omitted from this export only; no local records are deleted. Ask the user before downloading. */
  omittedHands: number;
  includedHands: number;
}
/** Prepare an export with an explicit omission count; never silently discard local history. */
export function prepareBackup(data: LabData, maxBytes = MAX_BACKUP_BYTES): PreparedBackup {
  if (!integer(maxBytes, 1, MAX_BACKUP_BYTES)) invalid('备份容量参数无效。');
  const snapshot = validateLabData(data);
  const encoder = new TextEncoder();
  const baseBytes = encoder.encode(JSON.stringify({ ...snapshot, hands: [] })).byteLength;
  if (baseBytes > maxBytes) invalid('当前牌局、训练和设置超过备份容量；无法仅通过省略旧手牌完成导出。原记录未更改。');
  const handBytes = snapshot.hands.map((hand) => encoder.encode(JSON.stringify(hand)).byteLength);
  let includedHands = snapshot.hands.length;
  let bytes = baseBytes + handBytes.reduce((sum, size) => sum + size, 0) + Math.max(0, includedHands - 1);
  const omitted = new Set<number>();
  // Retain the longest subset of the most recent hands, independent of input order.
  const oldestFirst = snapshot.hands.map((hand, index) => ({ time: hand.completedAt, index }))
    .sort((a, b) => a.time - b.time || b.index - a.index);
  for (const hand of oldestFirst) {
    if (bytes <= maxBytes) break;
    bytes -= handBytes[hand.index] + (includedHands > 1 ? 1 : 0);
    omitted.add(hand.index);
    includedHands--;
  }
  snapshot.hands = snapshot.hands.filter((_, index) => !omitted.has(index));
  const json = JSON.stringify(snapshot);
  if (encoder.encode(json).byteLength > maxBytes) invalid('备份容量计算失败，原记录未更改。');
  return { json, omittedHands: omitted.size, includedHands };
}
/** Idempotent completion accounting: trimming history never trims lifetime totals. */
export function recordResult(data: LabData, record: HandRecord, net: number, snapshots: DecisionSnapshot[] = []): LabData {
  if (data.hands.some((hand) => hand.record.handId === record.handId)) return data;
  return {
    ...data, savedAt: Date.now(),
    hands: [...data.hands, { record, net, completedAt: Date.now(), decisions: snapshots }].slice(-MAX_SAVED_HANDS),
    totals: { handsPlayed: data.totals.handsPlayed + 1, netChips: data.totals.netChips + net },
  };
}

let database: Promise<IDBPDatabase> | undefined;
function db(): Promise<IDBPDatabase> {
  if (!database) {
    database = openDB(DB_NAME, 1, { upgrade(value) { value.createObjectStore(STORE); } }).catch((error: unknown) => {
      database = undefined; throw error;
    });
  }
  return database;
}
function storageError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  return new PersistenceError(quota ? 'quota' : 'unavailable', quota ? '设备存储空间不足，本次进度未能保存。可先导出备份，再清理空间。' : '浏览器存储不可用，本次进度未能保存。可先导出备份，并检查浏览器的存储设置。');
}
export async function loadLabData(): Promise<LabData | null> {
  try {
    const value: unknown = await (await db()).get(STORE, KEY);
    return value === undefined ? null : validateLabData(value);
  } catch (error) { throw storageError(error); }
}
let writes = Promise.resolve();
/** Serializing writes prevents an older snapshot overtaking a newer one. */
export function saveLabData(data: LabData): Promise<void> {
  let snapshot: LabData;
  try { snapshot = validateLabData(data); } catch (error) { return Promise.reject(storageError(error)); }
  const write = writes.then(async () => {
    try { await (await db()).put(STORE, snapshot, KEY); }
    catch (error) { throw storageError(error); }
  });
  writes = write.catch(() => undefined);
  return write;
}
export function clearLabData(): Promise<void> {
  const write = writes.then(async () => {
    try { await (await db()).clear(STORE); }
    catch (error) { throw storageError(error); }
  });
  writes = write.catch(() => undefined);
  return write;
}
