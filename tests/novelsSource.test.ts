import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("novels management source", () => {
  it("does not create books from the management tab", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/novels.tsx"), "utf8");

    expect(source).not.toContain("app.addBook");
    expect(source).not.toContain("新建书本");
    expect(source).toContain("书架");
  });

  it("uses responsive bookshelf layout helpers instead of fixed cover width", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/novels.tsx"), "utf8");

    expect(source).toContain("getBookManagerLayout");
    expect(source).toContain("useWindowDimensions");
    expect(source).toContain("layout.shelfCardWidth");
    expect(source).not.toContain('const BOOK_COVER_WIDTH = "46.5%"');
  });
});

describe("settings source", () => {
  it("contains a night mode switch and clean Chinese copy", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

    expect(source).toContain("夜晚模式");
    expect(source).not.toContain("璁剧疆");
    expect(source).not.toContain("澶辫触");
  });
});

describe("tab screen headers", () => {
  it("does not render the old top explainer headers in tab screens", () => {
    for (const file of ["chat.tsx", "novels.tsx", "settings.tsx"]) {
      const source = readFileSync(join(process.cwd(), `app/(tabs)/${file}`), "utf8");

      expect(source).not.toContain("<Header");
      expect(source).not.toContain("先选择写作模式");
      expect(source).not.toContain("再进入对应聊天流程");
    }
  });

  it("uses the shared top bar on tab screens", () => {
    for (const file of ["chat.tsx", "novels.tsx", "settings.tsx"]) {
      const source = readFileSync(join(process.cwd(), `app/(tabs)/${file}`), "utf8");

      expect(source).toContain("TopBar");
    }
  });
});

describe("chat source", () => {
  it("keeps book creation in the chat tab and uses route params for mode jumps", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/chat.tsx"), "utf8");

    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("router.push");
    expect(source).toContain("mode=createBook");
    expect(source).toContain("mode=continue");
    expect(source).toContain("app.addBook");
  });

  it("uses a chat-style surface instead of the old form wizard", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/chat.tsx"), "utf8");

    expect(source).toContain("ChatBubble");
    expect(source).toContain("ChatComposer");
    expect(source).toContain("ThoughtPanel");
    expect(source).toContain("ReplyOptionList");
    expect(source).toContain("AnimatedPressable");
    expect(source).toContain("Animated.Value");
    expect(source).toContain("optionSelectGlow");
    expect(source).toContain("resetCreateBookChat");
    expect(source).toContain('accessibilityLabel="重置新建书本"');
    expect(source).toContain("confirmOptionButton");
    expect(source).toContain("confirmOptionText");
    expect(source).toContain("AssistantMessageBlock");
    expect(source).toContain("lastAssistantMessageIndex");
    expect(source).toContain("attachedOptions");
    expect(source).toContain("thinkingSteps");
    expect(source).toContain("pendingOption");
    expect(source).toContain("confirmDraft");
    expect(source).toContain("确认选择");
    expect(source).toContain("footer={chatFooter}");
    expect(source).toContain("useLocalSearchParams");
    expect(source).toContain("IconButton");
    expect(source).toContain("createInitialOnboardingConversation");
    expect(source).not.toContain("optionHint");
    expect(source).not.toContain("QuestionStep");
    expect(source).not.toContain("progressBox");
    expect(source).not.toContain("insertDraft");
    expect(source).not.toContain("copyDraft");
  });

  it("hides the bottom tab bar while jumped into chat flows", () => {
    const layoutSource = readFileSync(join(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "src/navigation/tabBarStyle.ts"), "utf8");

    expect(layoutSource).toContain('routeMode === "createBook" || routeMode === "continue"');
    expect(layoutSource).toContain("hideTabBar ? null");
    expect(styleSource).toContain('display: "none"');
  });
});

describe("settings API save status source", () => {
  it("shows a reliable API save status", () => {
    const source = readFileSync(join(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

    expect(source).toContain("savingProvider");
    expect(source).toContain("loading={savingProvider}");
    expect(source).toContain("API 配置已保存，API Key 已安全保存。");
    expect(source).toContain("保存 API 配置失败。");
  });
});
