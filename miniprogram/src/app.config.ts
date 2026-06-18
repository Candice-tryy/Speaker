export default defineAppConfig({
  pages: ["pages/practice/index"],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#3FC196",
    navigationBarTitleText: "Speaking",
    navigationBarTextStyle: "white",
  },
  permission: {
    "scope.record": { desc: "用于录制你的口语跟读以进行发音评分" },
  },
});
