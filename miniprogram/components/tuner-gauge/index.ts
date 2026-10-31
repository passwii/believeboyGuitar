Component({
  properties: {
    cents: { type: Number, value: 0 },
    direction: { type: String, value: "等待声音" },
    stable: { type: Boolean, value: false },
  },
  data: {
    needlePercent: 0.5,
    directionText: "等待声音",
  },
  observers: {
    cents(cents: number) {
      const clamped = Math.max(-50, Math.min(50, cents));
      this.setData({ needlePercent: (clamped + 50) / 100 });
    },
    direction(direction: string) {
      this.setData({ directionText: direction });
    },
  },
});
