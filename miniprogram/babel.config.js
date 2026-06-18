// babel-preset-taro 更多设置：https://docs.taro.zone/docs/next/babel-config
module.exports = {
  presets: [
    [
      "taro",
      {
        framework: "react",
        ts: true,
        compiler: "webpack5",
        reactJsxRuntime: "automatic",
      },
    ],
  ],
};
