/**
 * 锁屏 / 切到别的 app 之后继续出声的浏览器侧声明（BLF-1443）。
 *
 * 节拍器用 Web Audio 合成声音。Safari 16.4 起提供 `navigator.audioSession`：
 * 把 type 设成 `"playback"`，系统就把这段音频当「媒体播放」对待——锁屏后
 * 不被立刻挂起，侧边的静音开关也不会把它静音。Chrome / Firefox 没有这个
 * API，它们本来就按页面是否在发声决定后台行为，不需要额外声明。
 *
 * 只是「声明意图」，不保证成功：来电、低电量、系统回收都可能中断音频。
 * 回到前台时 `Metronome` 会重新 `resume()` 音频时钟，必要时退回暂停态。
 */

export type AudioSessionNavigatorLike = {
  audioSession?: { type: string };
};

/** 返回值表示是否真的写进去了（旧浏览器没有 audioSession） */
export function preferPlaybackAudioSession(
  navigatorLike: AudioSessionNavigatorLike | undefined,
): boolean {
  const session = navigatorLike?.audioSession;
  if (!session) return false;
  try {
    session.type = "playback";
    return true;
  } catch {
    // 某些嵌入环境里 audioSession 是只读的
    return false;
  }
}
