import { defineConfig } from "@tarojs/cli";

export default defineConfig(async (merge) => {
  const baseConfig = {
    projectName: "speaker-miniprogram",
    date: "2026-6-19",
    // The UI is a 1:1 port of the web stylesheets whose design canvas is the
    // 340px-wide phone card — px values are copied verbatim from the web CSS
    // and pxtransform scales them so 340px == full screen width.
    designWidth: 340,
    deviceRatio: { 340: 750 / 340, 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
    sourceRoot: "src",
    outputRoot: "dist",
    plugins: [],
    defineConstants: {},
    copy: { patterns: [], options: {} },
    framework: "react",
    compiler: "webpack5" as const,
    cache: { enable: false },
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
        cssModules: { enable: false },
      },
    },
    h5: {},
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, { mini: {}, h5: {} });
  }
  return merge({}, baseConfig, { mini: {}, h5: {} });
});
