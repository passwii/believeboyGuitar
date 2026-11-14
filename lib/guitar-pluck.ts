/**
 * 指尖拨弦试听（Stage 3）。
 *
 * 指板与 TAB 谱面的点击只做「点一下听到这个音」，不引入采样、也不与练习
 * 节拍器的 AudioContext 混用。一个短促的锯齿波经低通滤波后快速衰减，
 * 听感接近拨片触弦；音频时钟仍由浏览器管理，不参与任何视觉计时。
 */

type PluckContext = AudioContext & {
  webkitAudioContext?: never;
};

function createContext(): PluckContext | null {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!AudioContextCtor) return null;
  try {
    return new AudioContextCtor() as PluckContext;
  } catch {
    return null;
  }
}

let context: PluckContext | null = null;

function ensureContext(): PluckContext | null {
  if (!context) context = createContext();
  if (!context) return null;
  if (context.state === "suspended") void context.resume();
  return context;
}

/**
 * 按 MIDI 音高合成一次拨弦。
 *
 * 只在用户手势里调用；返回 false 表示浏览器没有 Web Audio，
 * 调用方可据此给出「当前设备不支持试听」的提示。
 */
export function playGuitarPluck(midi: number, duration = 0.55): boolean {
  const audio = ensureContext();
  if (!audio) return false;

  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(frequency, now);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(9000, frequency * 6), now);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(180, frequency * 0.7),
    now + duration,
  );
  filter.Q.value = 3;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.05);
  return true;
}
