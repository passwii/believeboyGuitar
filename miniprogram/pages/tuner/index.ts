import { createRecorderPcm } from "../../adapters/recorder-pcm";
import type { StringId } from "../../generated/guitar-core";
import {
  createTunerController,
  type TunerController,
} from "./controller";

const controller: TunerController = createTunerController();
const runtime = {
  recorder: null as ReturnType<typeof createRecorderPcm> | null,
  generation: 0,
};

function requestRecordPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getSetting({
      success: (settings) => {
        if (settings.authSetting["scope.record"] === true) {
          resolve(true);
          return;
        }
        wx.authorize({
          scope: "scope.record",
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

Page({
  data: controller.getState(),

  onLoad() {
    runtime.generation += 1;
    this.setData(controller.reset());
  },

  onHide() {
    this.stopTuning();
  },

  onUnload() {
    this.stopTuning();
  },

  toggleTuning() {
    if (this.data.listening || this.data.state === "starting") {
      this.stopTuning();
      return;
    }
    void this.startTuning();
  },

  async startTuning() {
    if (this.data.listening || this.data.state === "starting") return;
    const generation = ++runtime.generation;
    this.setData(controller.start());

    const permitted = await requestRecordPermission();
    if (generation !== runtime.generation) return;
    this.setData(controller.setPermissionResult(permitted));
    if (!permitted) {
      wx.showModal({
        title: "需要麦克风权限",
        content: "请在设置中允许使用麦克风，再回来开始调音。",
        confirmText: "去设置",
        success: (result) => {
          if (result.confirm && generation === runtime.generation) this.openSettings();
        },
      });
      return;
    }

    let recorder: ReturnType<typeof createRecorderPcm> | null = null;
    recorder = createRecorderPcm({
      frameSize: 8,
      onFrame: (samples, sampleRate) => {
        this.setData(controller.handleFrame(samples, sampleRate));
      },
      onError: () => {
        if (generation !== runtime.generation) return;
        if (runtime.recorder === recorder) runtime.recorder = null;
        recorder?.dispose();
        this.setData(controller.recorderFailed());
      },
      onState: (state) => {
        if (generation !== runtime.generation) return;
        if (state === "listening") {
          this.setData(controller.recorderStarted());
        } else if (state === "stopped" && this.data.state === "starting") {
          this.setData(controller.recorderFailed("录音启动失败，请重试"));
        }
      },
    });
    runtime.recorder = recorder;

    try {
      await recorder.start();
      if (generation !== runtime.generation) recorder.dispose();
    } catch {
      if (generation !== runtime.generation) return;
      recorder.dispose();
      runtime.recorder = null;
      this.setData(controller.recorderFailed());
    }
  },

  openSettings() {
    wx.openSetting({
      success: (settings) => {
        this.setData(
          controller.permissionSettingsUpdated(
            settings.authSetting["scope.record"] === true,
          ),
        );
      },
    });
  },

  stopTuning() {
    runtime.generation += 1;
    runtime.recorder?.dispose();
    runtime.recorder = null;
    this.setData(controller.stop());
  },

  cyclePreset() {
    this.setData(controller.cyclePreset());
  },

  resetMode() {
    this.setData(controller.resetMode());
  },

  selectString(event: WechatMiniprogram.TouchEvent) {
    this.setData(
      controller.selectString(String(event.currentTarget.dataset.id) as StringId),
    );
  },
});
