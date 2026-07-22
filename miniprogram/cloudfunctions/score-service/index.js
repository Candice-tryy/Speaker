const cloud = require("wx-server-sdk");
const crypto = require("node:crypto");
const https = require("node:https");
const WebSocket = require("ws");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ISE_HOST = "ise-api.xfyun.cn";
const ISE_PATH = "/v2/open-ise";
const IAT_HOST = "iat-api.xfyun.cn";
const IAT_PATH = "/v2/iat";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-chat";
const BYTES_PER_SECOND = 16000 * 2;
const ASR_SEGMENT_BYTES = BYTES_PER_SECOND * 55;

function env(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : "");
}

function rejectedScore(advice, transcript = "") {
  return {
    transcript,
    overall: 0,
    fluencyCoherence: 0,
    lexicalResource: 0,
    grammar: 0,
    pronunciation: 0,
    advice,
    evidence: [],
    source: { asr: "iflytek", scorer: "mock" },
    rejected: true,
  };
}

function scoreRetry(advice) {
  return { band: 0, pronunciation: 0, fluency: 0, advice, source: "iflytek", rejected: true };
}

function mockResult(mode, recited) {
  const band = recited ? 6.5 : 6.0;
  const advice = recited
    ? "稳了！语速和连读都不错，保持这个节奏。"
    : mode === "mock"
      ? "意思到位，再多用一个高级搭配会更亮眼。"
      : '如果只改一件事：把句尾的 /t/ 收清楚，比如 "straight"。';
  return { band, pronunciation: band, fluency: band, advice, source: "mock" };
}

function buildAuthUrl(host, path, creds) {
  const date = new Date().toUTCString();
  const origin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", creds.apiSecret).update(origin).digest("base64");
  const authOrigin = `api_key="${creds.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authOrigin).toString("base64");
  const qs = new URLSearchParams({ authorization, date, host });
  return `wss://${host}${path}?${qs.toString()}`;
}

function attr(xml, name) {
  const match = xml.match(new RegExp(`${name}="([\\d.]+)"`));
  return match ? Number.parseFloat(match[1]) : undefined;
}

function parseIseScores(xml) {
  return {
    total: attr(xml, "total_score"),
    accuracy: attr(xml, "accuracy_score"),
    fluency: attr(xml, "fluency_score"),
    standard: attr(xml, "standard_score"),
    integrity: attr(xml, "integrity_score"),
    rejected: /is_rejected="true"/.test(xml),
  };
}

function toBand(score) {
  if (score == null || Number.isNaN(score)) return undefined;
  return Math.max(0, Math.min(9, Math.round((score / 5) * 9 * 2) / 2));
}

function mapIseToBand(scores) {
  const pronunciation = toBand(scores.standard) ?? toBand(scores.accuracy) ?? toBand(scores.total) ?? 6;
  const fluency = toBand(scores.fluency) ?? toBand(scores.total) ?? 6;
  const band = toBand(scores.total) ?? Math.round(((pronunciation + fluency) / 2) * 2) / 2;
  return { band, pronunciation, fluency };
}

function resultText(result, language) {
  return (result.ws || [])
    .map((item) => item.cw?.[0]?.w || "")
    .join(language === "en_us" ? " " : "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function assessReading({ creds, refText, pcm, category = "read_chapter", ent = "en_vip" }) {
  const url = buildAuthUrl(ISE_HOST, ISE_PATH, creds);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let resultB64 = "";
    let settled = false;
    const timeout = setTimeout(() => finish(() => reject(new Error("ISE timeout"))), 30000);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws.close(); } catch {}
      fn();
    };
    ws.on("open", () => {
      ws.send(JSON.stringify({
        common: { app_id: creds.appId },
        business: {
          sub: "ise",
          ent,
          category,
          cmd: "ssb",
          text: "\ufeff" + refText,
          tte: "utf-8",
          rstcd: "utf8",
          group: "adult",
          aue: "raw",
          auf: "audio/L16;rate=16000",
          ttp_skip: true,
        },
        data: { status: 0, data: "" },
      }));
      const CHUNK = 1280;
      let offset = 0;
      const sendNext = () => {
        if (settled) return;
        const end = Math.min(offset + CHUNK, pcm.length);
        const slice = pcm.subarray(offset, end);
        const isFirst = offset === 0;
        const isLast = end >= pcm.length;
        offset = end;
        ws.send(JSON.stringify({
          business: { cmd: "auw", aus: isFirst ? 1 : isLast ? 4 : 2 },
          data: { status: isLast ? 2 : 1, encoding: "raw", data: slice.toString("base64") },
        }));
        if (!isLast) setTimeout(sendNext, 10);
      };
      if (!pcm.length) finish(() => reject(new Error("empty audio")));
      else sendNext();
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"));
      } catch (err) {
        finish(() => reject(err));
        return;
      }
      if (msg.code !== 0) {
        finish(() => reject(new Error(`ISE error ${msg.code}: ${msg.message || "unknown"}`)));
        return;
      }
      if (msg.data?.data) resultB64 += msg.data.data;
      if (msg.data?.status === 2) {
        finish(() => resolve(parseIseScores(Buffer.from(resultB64, "base64").toString("utf8"))));
      }
    });
    ws.on("error", () => finish(() => reject(new Error("ISE websocket error"))));
  });
}

async function transcribeSpeech({ creds, pcm, language = "en_us" }) {
  const texts = [];
  for (let start = 0; start < pcm.length; start += ASR_SEGMENT_BYTES) {
    const segment = pcm.subarray(start, Math.min(start + ASR_SEGMENT_BYTES, pcm.length));
    texts.push(await transcribeSegment({ creds, pcm: segment, language }));
  }
  return texts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function transcribeSegment({ creds, pcm, language = "en_us" }) {
  const url = buildAuthUrl(IAT_HOST, IAT_PATH, creds);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pieces = [];
    let settled = false;
    const streamMs = Math.ceil(pcm.length / 1280) * 8;
    const timeout = setTimeout(() => finish(() => reject(new Error("ASR timeout"))), streamMs + 20000);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws.close(); } catch {}
      fn();
    };
    ws.on("open", () => {
      const CHUNK = 1280;
      let offset = 0;
      const sendNext = () => {
        if (settled) return;
        const end = Math.min(offset + CHUNK, pcm.length);
        const slice = pcm.subarray(offset, end);
        const isFirst = offset === 0;
        const isLast = end >= pcm.length;
        offset = end;
        ws.send(JSON.stringify({
          ...(isFirst ? {
            common: { app_id: creds.appId },
            business: {
              language,
              domain: "iat",
              accent: language === "zh_cn" ? "mandarin" : undefined,
              ptt: 1,
              vad_eos: 10000,
            },
          } : {}),
          data: {
            status: isFirst ? 0 : isLast ? 2 : 1,
            format: "audio/L16;rate=16000",
            encoding: "raw",
            audio: slice.toString("base64"),
          },
        }));
        if (!isLast) setTimeout(sendNext, 8);
      };
      if (!pcm.length) finish(() => reject(new Error("empty audio")));
      else sendNext();
    });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"));
      } catch (err) {
        finish(() => reject(err));
        return;
      }
      if (msg.code !== 0) {
        finish(() => reject(new Error(`ASR error ${msg.code}: ${msg.message || "unknown"}`)));
        return;
      }
      const result = msg.data?.result;
      if (result) {
        const text = resultText(result, language);
        if (text) pieces.push(text);
      }
      if (msg.data?.status === 2) {
        finish(() => resolve(pieces.join(" ").replace(/\s+/g, " ").trim()));
      }
    });
    ws.on("error", () => finish(() => reject(new Error("ASR websocket error"))));
  });
}

function httpsJson(url, payload, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...headers },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`LLM ${res.statusCode}: ${text}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function clampBand(value, fallback = 6) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(9, Math.round(n * 2) / 2));
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in LLM response");
  return JSON.parse(raw.slice(start, end + 1));
}

function templateAdvice(scores) {
  const dims = [
    ["发音", scores.standard ?? scores.accuracy, "把重音和元音读得更饱满一点"],
    ["流利度", scores.fluency, "减少停顿，让句子之间更连贯"],
    ["完整度", scores.integrity, "尽量把整段读完整，别漏词"],
  ].filter((item) => item[1] != null);
  if (!dims.length) return "再跟读一遍，注意发音清晰、语速平稳。";
  dims.sort((a, b) => a[1] - b[1]);
  return `如果只改一件事：${dims[0][0]}还有提升空间，${dims[0][2]}。`;
}

async function generateAdvice(refText, scores) {
  const key = env("DEEPSEEK_API_KEY", "LLM_API_KEY");
  if (!key) return templateAdvice(scores);
  try {
    const data = await httpsJson(`${LLM_BASE_URL}/chat/completions`, {
      model: LLM_MODEL,
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "你是雅思口语跟读教练。根据发音测评引擎给出的分数，只给一条最关键的改进建议。用中文，40字以内，以“如果只改一件事：”开头。只评发音和流利度。",
        },
        {
          role: "user",
          content: `参考原文：${refText}\n测评分数(0-5)：standard=${scores.standard ?? "NA"}，accuracy=${scores.accuracy ?? "NA"}，fluency=${scores.fluency ?? "NA"}，integrity=${scores.integrity ?? "NA"}，total=${scores.total ?? "NA"}。`,
        },
      ],
    }, { Authorization: `Bearer ${key}` });
    return data?.choices?.[0]?.message?.content?.trim() || templateAdvice(scores);
  } catch (err) {
    console.error("LLM advice failed:", err);
    return templateAdvice(scores);
  }
}

async function scoreSpeakingWithRubric(args) {
  const key = env("DEEPSEEK_API_KEY", "LLM_API_KEY");
  if (!key) return rejectedScore("还没有配置 DeepSeek Key，暂时无法进行真实模拟评分。", args.transcript);
  const durationSec = args.durationMs ? Math.max(1, Math.round(args.durationMs / 1000)) : "unknown";
  const prompt =
    `Part: ${args.part}\nQuestion: ${args.question}\nAnswer transcript: ${args.transcript}\nAnswer duration seconds: ${durationSec}\n\n` +
    "Score this IELTS Speaking answer. Return strict JSON only with keys: overall, fluencyCoherence, lexicalResource, grammar, pronunciation, evidence, advice. " +
    "Scores must be IELTS bands from 0 to 9 in 0.5 steps. evidence must be 2-4 short Chinese strings. advice must be one warm Chinese sentence starting with 如果只改一件事：";
  try {
    const data = await httpsJson(`${LLM_BASE_URL}/chat/completions`, {
      model: LLM_MODEL,
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a strict IELTS Speaking examiner. Use the public IELTS speaking rubric. You are scoring from ASR transcript, so do not overclaim exact pronunciation. Use Chinese for evidence and advice. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }, { Authorization: `Bearer ${key}` });
    const parsed = extractJson(data?.choices?.[0]?.message?.content || "{}");
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.map(String).slice(0, 4) : [];
    return {
      transcript: args.transcript,
      overall: clampBand(parsed.overall),
      fluencyCoherence: clampBand(parsed.fluencyCoherence),
      lexicalResource: clampBand(parsed.lexicalResource),
      grammar: clampBand(parsed.grammar),
      pronunciation: clampBand(parsed.pronunciation),
      advice: typeof parsed.advice === "string" && parsed.advice.trim() ? parsed.advice.trim() : "如果只改一件事：回答再展开一个具体例子，让观点更有支撑。",
      evidence,
      source: { asr: "iflytek", scorer: "deepseek" },
    };
  } catch (err) {
    console.error("Speaking rubric failed:", err);
    return rejectedScore("模拟评分服务暂时不可用，请稍后再试。", args.transcript);
  }
}

async function getAudioBuffer(event) {
  if (event.audioFileID) {
    const res = await cloud.downloadFile({ fileID: event.audioFileID });
    return res.fileContent;
  }
  if (typeof event.audio === "string" && event.audio) return Buffer.from(event.audio, "base64");
  return Buffer.alloc(0);
}

async function cleanupAudioFile(event) {
  if (!event.audioFileID) return;
  try {
    await cloud.deleteFile({ fileList: [event.audioFileID] });
  } catch (err) {
    console.warn("delete temp audio failed:", err);
  }
}

async function handleScoreAudio(event) {
  const mode = event.mode === "mock" ? "mock" : "follow";
  const recited = Boolean(event.recited);
  const refText = typeof event.refText === "string" ? event.refText : "";
  const appId = env("XFYUN_APP_ID");
  const apiKey = env("XFYUN_API_KEY");
  const apiSecret = env("XFYUN_API_SECRET");
  const haveISE = Boolean(appId && apiKey && apiSecret);
  const pcm = await getAudioBuffer(event);
  try {
    if (mode === "follow" && haveISE && refText) {
      if (!pcm.length) return scoreRetry("没录到声音，请点一下开始录音，读完整段后再提交。");
      const scores = await assessReading({ creds: { appId, apiKey, apiSecret }, refText, pcm });
      if (scores.rejected || scores.total == null) {
        return scoreRetry("没听清你的发音，请靠近麦克风，读完整段后再提交。");
      }
      const mapped = mapIseToBand(scores);
      const advice = await generateAdvice(refText, scores);
      return { ...mapped, advice, source: "iflytek" };
    }
    return mockResult(mode, recited);
  } catch (err) {
    console.error("score-audio failed:", err);
    return scoreRetry("评分服务暂时异常，请重试一次。");
  } finally {
    await cleanupAudioFile(event);
  }
}

async function handleScoreSpeaking(event) {
  const part = typeof event.part === "string" ? event.part : "Part 1";
  const question = typeof event.question === "string" ? event.question : "";
  const durationMs = typeof event.durationMs === "number" ? event.durationMs : undefined;
  const appId = env("XFYUN_ASR_APP_ID", "XFYUN_APP_ID");
  const apiKey = env("XFYUN_ASR_API_KEY", "XFYUN_API_KEY");
  const apiSecret = env("XFYUN_ASR_API_SECRET", "XFYUN_API_SECRET");
  const haveAsr = Boolean(appId && apiKey && apiSecret);
  const pcm = await getAudioBuffer(event);
  try {
    if (!haveAsr) return rejectedScore("还没有配置讯飞 ASR Key，暂时无法进行真实模拟评分。");
    if (!pcm.length) return rejectedScore("没有录到声音，请点一下开始录音，完整回答后再提交。");
    const transcript = await transcribeSpeech({ creds: { appId, apiKey, apiSecret }, pcm });
    if (!transcript) return rejectedScore("没有听清你的回答，请重新录一遍。");
    if (transcript.split(/\s+/).filter(Boolean).length < 3) {
      return rejectedScore("回答太短了，请至少说完整一句话。", transcript);
    }
    return await scoreSpeakingWithRubric({ part, question, transcript, durationMs });
  } catch (err) {
    console.error("score-speaking failed:", err);
    return rejectedScore("语音转写暂时失败，请靠近麦克风再试一次。");
  } finally {
    await cleanupAudioFile(event);
  }
}

exports.main = async (event) => {
  if (event?.action === "score-audio") return handleScoreAudio(event);
  if (event?.action === "score-speaking") return handleScoreSpeaking(event);
  return { rejected: true, advice: "未知评分动作，请更新小程序后重试。" };
};
