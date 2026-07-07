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
    defineConstants: {
      // The env ID ships inside the package and the bank collections are
      // read-only, so defaulting it here is safe — it keeps a bare
      // `npm run build:weapp` from silently compiling the cloud path away.
      // CLOUD_ENV_ID overrides it; "none" disables cloud (PowerShell deletes
      // env vars assigned "", so an empty string can't express "off").
      __CLOUD_ENV_ID__: JSON.stringify(
        process.env.CLOUD_ENV_ID === "none" ? "" : process.env.CLOUD_ENV_ID || "cloud1-d9g4ihxcx7878af8c"
      ),
      __USE_LOCAL_BANK_API__: JSON.stringify(process.env.USE_LOCAL_BANK_API === "1"),
    },
    copy: {
      patterns: [
        { from: "src/assets/question-bank.generated.json", to: "dist/assets/question-bank.generated.json" },
      ],
      options: {},
    },
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
