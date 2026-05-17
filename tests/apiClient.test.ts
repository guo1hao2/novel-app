import { describe, expect, it, vi } from "vitest";
import { requestChatCompletion, requestChatCompletionStream } from "../src/features/ai/apiClient";

describe("requestChatCompletion", () => {
  it("calls the OpenAI-compatible chat completions endpoint with bearer auth", async () => {
    const calls: unknown[] = [];
    const fetcher = async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "追逐戏从雨巷开始。" } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const content = await requestChatCompletion({
      provider: {
        baseUrl: "https://api.deepseek.com/",
        model: "deepseek-v4-pro",
        temperature: 0.7,
        maxTokens: 800
      },
      apiKey: "test-key",
      messages: [{ role: "user", content: "续写" }],
      fetcher
    });

    const [url, options] = calls[0] as Parameters<typeof fetch>;

    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(options?.body as string).model).toBe("deepseek-v4-pro");
    expect(content).toBe("追逐戏从雨巷开始。");
  });

  it("throws a concise error when the provider rejects the request", async () => {
    const fetcher = async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 });

    await expect(
      requestChatCompletion({
        provider: {
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-v4-pro",
          temperature: 0.7,
          maxTokens: 800
        },
        apiKey: "bad-key",
        messages: [{ role: "user", content: "续写" }],
        fetcher
      })
    ).rejects.toThrow("API 请求失败 401：bad key");
  });
  it("can request JSON object responses from compatible providers", async () => {
    const calls: unknown[] = [];
    const fetcher = async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    await requestChatCompletion({
      provider: {
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        temperature: 0.7,
        maxTokens: 800
      },
      apiKey: "test-key",
      messages: [{ role: "user", content: "Return json." }],
      responseFormat: { type: "json_object" },
      fetcher
    });

    const [, options] = calls[0] as Parameters<typeof fetch>;
    expect(JSON.parse(options?.body as string).response_format).toEqual({ type: "json_object" });
  });

  it("clamps max_tokens for non-streaming requests before sending them", async () => {
    const calls: unknown[] = [];
    const fetcher = async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    await requestChatCompletion({
      provider: {
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        temperature: 0.7,
        maxTokens: 1000000
      },
      apiKey: "test-key",
      messages: [{ role: "user", content: "continue" }],
      fetcher
    });

    const [, options] = calls[0] as Parameters<typeof fetch>;
    expect(JSON.parse(options?.body as string).max_tokens).toBe(393216);
  });

  it("clamps max_tokens for streaming requests before sending them", async () => {
    const calls: unknown[] = [];
    const fetcher = async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    requestChatCompletionStream(
      {
        provider: {
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-v4-pro",
          temperature: 0.7,
          maxTokens: 0
        },
        apiKey: "test-key",
        messages: [{ role: "user", content: "continue" }],
        fetcher
      },
      {
        onToken() {},
        onComplete() {},
        onError() {}
      }
    );
    await Promise.resolve();

    const [, options] = calls[0] as Parameters<typeof fetch>;
    expect(JSON.parse(options?.body as string).max_tokens).toBe(1);
  });

  it("uses the DeepSeek official maximum when max_tokens is invalid", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] })
    })) as unknown as typeof fetch;

    await requestChatCompletion({
      provider: {
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        temperature: 0.7,
        maxTokens: Number.NaN
      },
      apiKey: "test-key",
      messages: [{ role: "user", content: "continue" }],
      fetcher
    });

    const [, options] = vi.mocked(fetcher).mock.calls[0];
    expect(JSON.parse(options?.body as string).max_tokens).toBe(393216);
  });
});
