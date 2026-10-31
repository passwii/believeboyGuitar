Component({
  properties: {
    beats: { type: Number, value: 4 },
    accents: { type: Array, value: [] },
    active: { type: Number, value: 0 },
    running: { type: Boolean, value: false },
  },
  data: {
    beatItems: [0, 1, 2, 3],
  },
  observers: {
    beats(count: number) {
      const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      this.setData({
        beatItems: Array.from({ length: total }, (_, index) => index),
      });
    },
  },
});
