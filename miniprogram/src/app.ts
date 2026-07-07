import { PropsWithChildren } from "react";
import Taro from "@tarojs/taro";
import "./app.scss";

function App({ children }: PropsWithChildren<unknown>) {
  const cloud = (Taro as any).cloud;
  if (__CLOUD_ENV_ID__ && cloud && !cloud.__speakerInited) {
    cloud.init({ env: __CLOUD_ENV_ID__, traceUser: true });
    cloud.__speakerInited = true;
  }
  return children;
}

export default App;
