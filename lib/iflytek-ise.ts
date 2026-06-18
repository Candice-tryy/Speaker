import crypto from "node:crypto";
import type { IseScores } from "./types";

// Server-side client for 讯飞 ISE (Intelligent Speech Evaluation), used to score
// 跟读 (read-aloud) pronunciation + fluency against a reference text. ISE returns
// deterministic engine scores, which is exactly what the PRD's "打分一致性" goal
// needs — the LLM never judges pronunciation, only phrases the advice.
//
// Protocol: wss://ise-api.xfyun.cn/v2/open-ise
//   - HMAC-SHA256 auth in query params
//   - ssb frame carries the BOM-prefixed reference text + params
//   - auw frames stream 16k/16-bit/mono PCM (aus 1=first, 2=mid, 4=last)
//   - result returns as base64 XML with total_score / fluency_score / standard_score

const HOST = "ise-api.xfyun.cn";
const PATH = "/v2/open-ise";

export interface IseCreds {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

function buildAuthUrl({ apiKey, apiSecret }: IseCreds): string {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const qs = new URLSearchParams({ authorization, date, host: HOST });
  return `wss://${HOST}${PATH}?${qs.toString()}`;
}

function attr(xml: string, name: string): number | undefined {
  const m = xml.match(new RegExp(`${name}="([\\d.]+)"`));
  return m ? parseFloat(m[1]) : undefined;
}

function parseScores(xml: string): IseScores {
  return {
    total: attr(xml, "total_score"),
    accuracy: attr(xml, "accuracy_score"),
    fluency: attr(xml, "fluency_score"),
    standard: attr(xml, "standard_score"),
    integrity: attr(xml, "integrity_score"),
    rejected: /is_rejected="true"/.test(xml),
  };
}

interface IseMessage {
  code: number;
  message?: string;
  data?: { status: number; data?: string };
}

export interface AssessArgs {
  creds: IseCreds;
  refText: string;
  pcm: Buffer; // 16kHz, 16-bit, mono, little-endian PCM
  category?: string; // read_word | read_sentence | read_chapter
  ent?: string; // en_vip (English) | cn_vip (Chinese)
}

export function assessReading({
  creds,
  refText,
  pcm,
  category = "read_chapter",
  ent = "en_vip",
}: AssessArgs): Promise<IseScores> {
  const url = buildAuthUrl(creds);

  return new Promise<IseScores>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    let resultB64 = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {}
      reject(new Error("ISE timeout"));
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
      ws.send(
        JSON.stringify({
          common: { app_id: creds.appId },
          business: {
            sub: "ise",
            ent,
            category,
            cmd: "ssb",
            text: "﻿" + refText,
            tte: "utf-8",
            rstcd: "utf8",
            group: "adult",
            aue: "raw",
            auf: "audio/L16;rate=16000",
            ttp_skip: true,
          },
          data: { status: 0, data: "" },
        })
      );

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
              business: { cmd: "auw", aus: isFirst ? 1 : isLast ? 4 : 2 },
              data: { status: isLast ? 2 : 1, encoding: "raw", data: slice.toString("base64") },
            })
          );
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error(String(err))));
          return;
        }
        if (!isLast) setTimeout(sendNext, 10);
      };

      if (total === 0) {
        finish(() => reject(new Error("empty audio")));
        return;
      }
      sendNext();
    };

    ws.onmessage = (event) => {
      let msg: IseMessage;
      try {
        const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data as ArrayBuffer).toString("utf8");
        msg = JSON.parse(raw);
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error("ISE parse error")));
        return;
      }
      if (msg.code !== 0) {
        finish(() => reject(new Error(`ISE error ${msg.code}: ${msg.message ?? "unknown"}`)));
        return;
      }
      if (msg.data?.data) resultB64 += msg.data.data;
      if (msg.data?.status === 2) {
        const xml = Buffer.from(resultB64, "base64").toString("utf8");
        console.log("[ISE] raw xml:\n" + xml);
        finish(() => resolve(parseScores(xml)));
      }
    };

    ws.onerror = () => {
      finish(() => reject(new Error("ISE websocket error")));
    };
  });
}
