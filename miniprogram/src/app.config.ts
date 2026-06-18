export default defineAppConfig({
  pages: ["pages/map/index", "pages/practice/index", "pages/profile/index"],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#3FC196",
    navigationBarTitleText: "Speaking",
    navigationBarTextStyle: "white",
  },
  tabBar: {
    color: "#9aa3a8",
    selectedColor: "#1E7A66",
    backgroundColor: "#ffffff",
    borderStyle: "white",
    list: [
      { pagePath: "pages/map/index", text: "登山" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
  permission: {
    "scope.record": { desc: "用于录制你的口语跟读以进行发音评分" },
  },
});
