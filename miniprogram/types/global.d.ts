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
