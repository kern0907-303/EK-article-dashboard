// 下拉面板要靠左還是靠右展開，才不會被外層容器切掉。純函式，方便測試。

export type PopoverAlign = "left" | "right";

/**
 * btnLeft / btnRight：觸發按鈕的左右邊（視窗座標）
 * boundsLeft / boundsRight：外層可見範圍（會裁切內容的容器，或整個視窗）
 * width：面板寬度
 * 優先靠右對齊（面板右緣對齊按鈕右緣、往左長）；放不下就靠左（面板左緣對齊按鈕左緣、往右長）；
 * 兩邊都放不下時，選被切掉比較少的一邊。
 */
export function pickAlign(
  btnLeft: number,
  btnRight: number,
  boundsLeft: number,
  boundsRight: number,
  width: number,
  margin = 8
): PopoverAlign {
  const rightAlignedLeftEdge = btnRight - width;
  const leftAlignedRightEdge = btnLeft + width;
  const fitsRight = rightAlignedLeftEdge >= boundsLeft + margin;
  const fitsLeft = leftAlignedRightEdge <= boundsRight - margin;
  if (fitsRight) return "right";
  if (fitsLeft) return "left";
  const cutRight = boundsLeft + margin - rightAlignedLeftEdge; // 靠右展開時左邊被切掉多少
  const cutLeft = leftAlignedRightEdge - (boundsRight - margin); // 靠左展開時右邊被切掉多少
  return cutRight <= cutLeft ? "right" : "left";
}

/** 找最近一層會裁切內容的祖先（overflow 不是 visible），找不到就用視窗 */
export function clippingBounds(el: HTMLElement | null): { left: number; right: number } {
  let node: HTMLElement | null = el?.parentElement || null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflow !== "visible") {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right };
    }
    node = node.parentElement;
  }
  return { left: 0, right: window.innerWidth };
}
