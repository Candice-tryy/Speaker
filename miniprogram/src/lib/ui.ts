import Taro from "@tarojs/taro";

// With navigationStyle: "custom" the page extends under the status bar and the
// WeChat capsule button. These insets (px) let pages lay out around them:
// `top` aligns with the capsule, `bottom` is the first safe y below it,
// `right` is how much horizontal space the capsule claims from the right edge
// (for rows that share the capsule's line).
export function chromeInsets(): { top: number; bottom: number; statusBar: number; right: number } {
  try {
    const info = Taro.getSystemInfoSync();
    const statusBar = info.statusBarHeight || 20;
    const menu = Taro.getMenuButtonBoundingClientRect?.();
    if (menu && menu.bottom > 0) {
      const width = info.windowWidth || info.screenWidth || 375;
      return { top: menu.top, bottom: menu.bottom, statusBar, right: Math.max(0, width - menu.left) };
    }
    return { top: statusBar + 4, bottom: statusBar + 36, statusBar, right: 96 };
  } catch {
    return { top: 24, bottom: 56, statusBar: 20, right: 96 };
  }
}

// Convert design px (340-wide design, same scale pxtransform applies to the
// stylesheets) into real device px for inline styles.
export function designToPx(n: number): number {
  try {
    const info = Taro.getSystemInfoSync();
    return (n * (info.windowWidth || info.screenWidth || 375)) / 340;
  } catch {
    return n;
  }
}

// Top offset (real px) that vertically centers a row on the capsule button.
// `rowDesignHeight` is the row's tallest element in design px (340-wide design,
// pxtransform scales it by windowWidth/340 at runtime).
export function capsuleCenteredTop(rowDesignHeight: number): number {
  try {
    const info = Taro.getSystemInfoSync();
    const menu = Taro.getMenuButtonBoundingClientRect?.();
    if (menu && menu.bottom > menu.top) {
      const rowPx = (rowDesignHeight * (info.windowWidth || info.screenWidth || 375)) / 340;
      const capsuleCenter = (menu.top + menu.bottom) / 2;
      return Math.max(info.statusBarHeight || 0, capsuleCenter - rowPx / 2);
    }
  } catch {
    /* fall through */
  }
  return chromeInsets().top;
}
