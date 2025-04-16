// Cloudflare Workers (TypeScript) - translate-api-worker
// エンドポイント: POST /translate
// 仕様: { texts: string[], source: string, target: string }
// レスポンス: { translations: string[] }

export interface Env {}

const LIBRETRANSLATE_URL = "https://libretranslate.de/translate"; // バックエンドLibreTranslate
const REQUEST_TIMEOUT = 20000; // ms

async function translateOne(
  text: string,
  source: string,
  target: string
): Promise<string> {
  if (!text) return "";
  try {
    const resp = await fetch(LIBRETRANSLATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text"
      }),
      // Cloudflare Workers の fetch は自動でタイムアウトしないため、AbortController推奨
      signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT) : undefined
    });
    if (!resp.ok) {
      // デバッグ: レスポンス異常
      console.log(`[DEBUG] LibreTranslate error: ${resp.status} ${resp.statusText}`);
      return "";
    }
    const data = await resp.json();
    return typeof data.translatedText === "string" ? data.translatedText : "";
  } catch (e) {
    // デバッグ: 例外発生
    console.log(`[DEBUG] LibreTranslate fetch error: ${(e as Error).message}`);
    return "";
  }
}

async function translateBulk(
  texts: string[],
  source: string,
  target: string
): Promise<string[]> {
  // 100件上限
  if (texts.length > 100) {
    throw new Error("Too many texts: max 100");
  }
  // 並列実行、順序維持
  return await Promise.all(
    texts.map((t) => translateOne(t, source, target))
  );
}

async function handleTranslate(request: Request): Promise<Response> {
  try {
    const reqBody = await request.json();
    const texts: unknown = reqBody.texts;
    const source: unknown = reqBody.source;
    const target: unknown = reqBody.target;

    // 入力バリデーション
    if (
      !Array.isArray(texts) ||
      typeof source !== "string" ||
      typeof target !== "string"
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (texts.length > 100) {
      return new Response(
        JSON.stringify({ error: "Too many texts (max 100)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 空要素（null/undefined）も空文字返す
    const safeTexts = texts.map((v) => (typeof v === "string" ? v : ""));

    const translations = await translateBulk(safeTexts, source, target);

    return new Response(
      JSON.stringify({ translations }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    // デバッグ: 例外発生
    console.log(`[DEBUG] API handler error: ${(e as Error).message}`);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      // CORS preflight
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (url.pathname === "/translate" && request.method === "POST") {
      const resp = await handleTranslate(request);
      // CORSヘッダ付与
      resp.headers.set("Access-Control-Allow-Origin", "*");
      return resp;
    }
    return new Response("Not Found", { status: 404 });
  }
};