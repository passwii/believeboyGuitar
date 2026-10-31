import {
  bpmToDialAngle,
  clampBpm,
  dialPointToBpm,
  tempoName,
} from "../../generated/guitar-core";

Component({
  properties: {
    value: { type: Number, value: 90 },
  },
  data: {
    tempoName: tempoName(90),
  },
  observers: {
    value(next: number) {
      this.setData({ tempoName: tempoName(next) });
      this.draw();
    },
  },
  lifetimes: {
    ready() {
      this.prepareCanvas();
    },
  },
  methods: {
    prepareCanvas() {
      this.createSelectorQuery()
        .select("#dial")
        .fields({ node: true, size: true })
        .exec((result: any[]) => {
          const item = result[0];
          if (!item?.node) return;
          const dpr = wx.getSystemInfoSync().pixelRatio;
          item.node.width = item.width * dpr;
          item.node.height = item.height * dpr;
          const context = item.node.getContext("2d");
          context.scale(dpr, dpr);
          (this as any).dial = {
            canvas: item.node,
            context,
            width: item.width,
            height: item.height,
          };
          this.draw();
        });
    },
    draw() {
      const dial = (this as any).dial;
      if (!dial) return;
      const { context: ctx, width, height } = dial;
      const value = clampBpm(this.data.value);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 18;
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#c9d1c8";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
      ctx.stroke();
      const angle = ((bpmToDialAngle(value) - 90) * Math.PI) / 180;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      ctx.fillStyle = "#267b55";
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    },
    measure(callback: (rect: any) => void) {
      this.createSelectorQuery()
        .select(".dial-shell")
        .boundingClientRect((rect: any) => callback(rect))
        .exec();
    },
    updateFromTouch(event: any) {
      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      if (!touch) return;
      this.measure((rect: any) => {
        if (!rect) return;
        const dx = touch.clientX - (rect.left + rect.width / 2);
        const dy = touch.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy);
        if (distance < (Math.min(rect.width, rect.height) * 0.45) / 2) return;
        const boundedValue = clampBpm(dialPointToBpm(dx, dy));
        this.triggerEvent("change", { value: boundedValue });
      });
    },
    onTouchStart(event: any) {
      this.updateFromTouch(event);
    },
    onTouchMove(event: any) {
      this.updateFromTouch(event);
    },
    onTouchEnd(event: any) {
      this.updateFromTouch(event);
    },
  },
});
