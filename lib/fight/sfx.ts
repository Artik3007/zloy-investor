/**
 * Звук без файлов: Web Audio генерирует гонг, свист, удар и уворот.
 * По умолчанию выключен, включается кнопкой в HUD после жеста пользователя.
 */

export type SfxName = 'gong' | 'whoosh' | 'impact' | 'dodge';

const STORAGE_KEY = 'zi:sound:v1';

let ctx: AudioContext | null = null;
let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();

/** Состояние звука в localStorage под try/catch (приватный режим Safari). */
function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    enabled = false;
  }
}

export function isSoundEnabled(): boolean {
  ensureLoaded();
  return enabled;
}

/** Для useSyncExternalStore: на сервере звук всегда выключен. */
export function soundServerSnapshot(): boolean {
  return false;
}

export function subscribeSound(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setSoundEnabled(next: boolean): void {
  loaded = true;
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Молча: звук просто не запомнится.
  }
  if (next) void ensureContext();
  for (const listener of listeners) listener();
}

async function ensureContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function envelope(ac: AudioContext, gain: GainNode, peak: number, decay: number): void {
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Два затухающих синуса — узнаваемый гонг. */
function playGong(ac: AudioContext): void {
  for (const freq of [196, 293.7]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    envelope(ac, gain, 0.28, 1.8);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 1.9);
  }
}

/** Отфильтрованный шум — свист кулака. */
function playWhoosh(ac: AudioContext): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.3);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2400, ac.currentTime + 0.22);
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  envelope(ac, gain, 0.22, 0.28);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + 0.3);
}

/** Низкий «бум» плюс шумовой щелчок — попадание. */
function playImpact(ac: AudioContext): void {
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, ac.currentTime + 0.25);
  envelope(ac, oscGain, 0.5, 0.35);
  osc.connect(oscGain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.4);

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.12);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  const gain = ac.createGain();
  envelope(ac, gain, 0.3, 0.12);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + 0.14);
}

/** Короткий высокий свиш — уворот. */
function playDodge(ac: AudioContext): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.18);
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2600;
  const gain = ac.createGain();
  envelope(ac, gain, 0.18, 0.16);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + 0.2);
}

export async function playSfx(name: SfxName): Promise<void> {
  if (!isSoundEnabled()) return;
  const ac = await ensureContext();
  if (!ac) return;

  try {
    switch (name) {
      case 'gong':
        playGong(ac);
        return;
      case 'whoosh':
        playWhoosh(ac);
        return;
      case 'impact':
        playImpact(ac);
        return;
      case 'dodge':
        playDodge(ac);
        return;
      default: {
        const never: never = name;
        return never;
      }
    }
  } catch {
    // Звук — украшение: любая ошибка не должна ломать бой.
  }
}
