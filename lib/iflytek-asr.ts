import crypto from "node:crypto";

const HOST = "iat-api.xfyun.cn";
const PATH = "/v2/iat";

export interface AsrCreds {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export interface TranscribeArgs {
  creds: AsrCreds;
  pcm: Buffer; // 16kHz, 16-bit, mono, little-endian PCM
  language?: "en_us" | "zh_cn";
}

interface IatMessage {
  code: number;
  message?: string;
  data?: {
    status: number;
    result?: {
      pgs?: "apd" | "rpl";
      rg?: [number, number];
      ws?: Array<{ cw?: Array<{ w?: string }> }>;
    };
  };
}

function buildAuthUrl({ apiKey, apiSecret }: AsrCreds): string {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const qs = new URLSearchParams({ authorization, date, host: HOST });
  return `wss://${HOST}${PATH}?${qs.toString()}`;
}

function resultText(result: NonNullable<NonNullable<IatMessage["data"]>["result"]>, language: "en_us" | "zh_cn"): string {
  return (result.ws ?? [])
    .map((item) => item.cw?.[0]?.w ?? "")
    .join(language === "en_us" ? " " : "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function transcribeSpeech({ creds, pcm, language = "en_us" }: TranscribeArgs): Promise<string> {
  const url = buildAuthUrl(creds);

  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const pieces: string[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {}
      reject(new Error("ASR timeout"));
    }, 30000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {}
      fn();
    };

    ws.onopen = () => {
      const CHUNK = 1280; // ~40ms of 16k/16-bit mono audio
      let offset = 0;
      const total = pcm.length;

      const sendNext = () => {
        if (settled) return;
        const end = Math.min(offset + CHUNK, total);
        const slice = pcm.subarray(offset, end);
        const isFirst = offset === 0;
        const isLast = end >= total;
        offset = end;

        try {
          ws.send(
            JSON.stringify({
              ...(isFirst
                ? {
                    common: { app_id: creds.appId },
                    business: {
                      language,
                      domain: "iat",
                      accent: language === "zh_cn" ? "mandarin" : undefined,
                      dwa: "wpgs",
                      ptt: 1,
                    },
                  }
                : {}),
              data: {
                status: isFirst ? 0 : isLast ? 2 : 1,
                format: "audio/L16;rate=16000",
                encoding: "raw",
                audio: slice.toString("base64"),
              },
            })
          );
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error(String(err))));
          return;
        }

        if (!isLast) setTimeout(sendNext, 40);
      };

      if (total === 0) {
        finish(() => reject(new Error("empty audio")));
        return;
      }
      sendNext();
    };

    ws.onmessage = (event) => {
      let msg: IatMessage;
      try {
        const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data as ArrayBuffer).toString("utf8");
        msg = JSON.parse(raw);
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error("ASR parse error")));
        return;
      }

      if (msg.code !== 0) {
        finish(() => reject(new Error(`ASR error ${msg.code}: ${msg.message ?? "unknown"}`)));
        return;
      }

      const result = msg.data?.result;
      if (result) {
        const text = resultText(result, language);
        if (text) {
          if (result.pgs === "rpl" && result.rg) {
            pieces.splice(result.rg[0] - 1, result.rg[1] - result.rg[0] + 1, text);
          } else {
            pieces.push(text);
          }
        }
      }

      if (msg.data?.status === 2) {
        finish(() => resolve(pieces.join(" ").replace(/\s+/g, " ").trim()));
      }
    };

    ws.onerror = () => {
      finish(() => reject(new Error("ASR websocket error")));
    };
  });
}
