/// <reference types="@tarojs/taro" />

declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.css";
declare module "*.scss";

declare const process: {
  env: {
    NODE_ENV: "development" | "production";
    [key: string]: string | undefined;
  };
};

declare const __CLOUD_ENV_ID__: string;
declare const __USE_LOCAL_BANK_API__: boolean;
declare const __API_BASE_URL__: string;
