import type { ChatCompletionMessage } from "./promptBuilder";
import { parseSSEStream, type StreamCallbacks } from "./streamParser";
import { normalizeMaxTokens } from "../settings/maxTokens";

type ProviderRuntimeConfig = {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

type RequestChatCompletionInput = {
  provider: ProviderRuntimeConfig;
  apiKey: string;
  messages: ChatCompletionMessage[];
  responseFormat?: { type: "json_object" };
  fetcher?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function requestChatCompletion(input: RequestChatCompletionInput): Promise<string> {
  if (!input.apiKey.trim()) {
    throw new Error("请先在设置页配置 API Key。");
  }

  const fetchImpl = input.fetcher ?? fetch;
  const response = await fetchImpl(`${input.provider.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.provider.model,
      messages: input.messages,
      temperature: input.provider.temperature,
      max_tokens: normalizeMaxTokens(input.provider.maxTokens),
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      stream: false
    })
  });

  const json = (await safeJson(response)) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(`API 请求失败 ${response.status}：${json.error?.message ?? response.statusText}`);
  }

  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("API 返回为空，请调整提示词或稍后重试。");
  }

  return content;
}

/**
 * Streaming variant of requestChatCompletion.
 *
 * Sends the same request body with `stream: true` and processes Server-Sent
 * Events via parseSSEStream. Returns an AbortController so the caller can
 * cancel mid-stream. If the response is not a readable stream (e.g. the
 * server ignored the stream flag), falls back to reading the full JSON body.
 */
export function requestChatCompletionStream(
  input: RequestChatCompletionInput,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();

  if (!input.apiKey.trim()) {
    callbacks.onError(new Error("请先在设置页配置 API Key。"));
    return controller;
  }

  const fetchImpl = input.fetcher ?? fetch;

  (async () => {
    try {
      const response = await fetchImpl(
        `${input.provider.baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: input.provider.model,
            messages: input.messages,
            temperature: input.provider.temperature,
            max_tokens: normalizeMaxTokens(input.provider.maxTokens),
            stream: true
          }),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        const json = (await safeJson(response)) as ChatCompletionResponse;
        throw new Error(
          `API 请求失败 ${response.status}：${json.error?.message ?? response.statusText}`
        );
      }

      const body = response.body;
      if (!body || !body.getReader) {
        // Streaming not supported by the fetch implementation (e.g. older
        // React Native environments) — fall back to full response parsing.
        const json = (await safeJson(response)) as ChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content?.trim();
        if (content) {
          callbacks.onToken(content);
          callbacks.onComplete(content);
        } else {
          callbacks.onError(new Error("API 返回为空，请调整提示词或稍后重试。"));
        }
        return;
      }

      const reader = body.getReader();
      parseSSEStream(reader, callbacks);
    } catch (err) {
      if (controller.signal.aborted) return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
