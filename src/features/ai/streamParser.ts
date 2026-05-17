/**
 * SSE (Server-Sent Events) stream parser for OpenAI-compatible APIs.
 *
 * Each event line starts with "data: " followed by JSON. The stream ends
 * with "data: [DONE]". JSON chunks follow the shape:
 * `{ choices: [{ delta: { content?: string } }] }`
 */

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
};

const TEXT_DECODER = new TextDecoder("utf-8");

/**
 * Parse an SSE stream from a ReadableStreamDefaultReader.
 *
 * Reads chunks as they arrive, extracts content tokens from each SSE event,
 * and drives the provided callbacks. The `onComplete` callback receives the
 * full assembled text once the stream ends with `[DONE]` or the reader closes.
 */
export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks
): void {
  let fullText = "";
  let buffer = "";

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Stream closed by the server — flush any remaining buffer
          fullText += extractContentFromBuffer(buffer);
          buffer = "";
          callbacks.onComplete(fullText);
          break;
        }

        buffer += TEXT_DECODER.decode(value, { stream: true });

        // Process complete lines from the buffer
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line) continue;

          if (line === "data: [DONE]") {
            callbacks.onComplete(fullText);
            return;
          }

          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            const token = extractContentToken(jsonStr);
            if (token) {
              fullText += token;
              callbacks.onToken(token);
            }
          }
        }
      }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();
}

/**
 * Extract the content string from a single SSE JSON payload.
 */
function extractContentToken(jsonStr: string): string | null {
  try {
    const parsed = JSON.parse(jsonStr);
    const content = parsed?.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : null;
  } catch {
    // Malformed JSON — skip silently
    return null;
  }
}

/**
 * Attempt to extract content from any partial data lines left in the buffer
 * when the stream closes without a clean `[DONE]`.
 */
function extractContentFromBuffer(buf: string): string {
  if (!buf.trim()) return "";
  let result = "";
  for (const line of buf.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
      const token = extractContentToken(trimmed.slice(6));
      if (token) result += token;
    }
  }
  return result;
}
