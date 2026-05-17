import { describe, expect, it } from "vitest";
import {
  buildCombinedGenreReplyMessages,
  buildFinalizeBookMessages,
  buildOnboardingReplyMessages,
  buildOptionRetryMessages,
  buildStyleSuggestionMessages,
  createInitialOnboardingConversation,
  formatOnboardingMaterials,
  getFallbackOptions,
  getNextOnboardingConversation,
  getStepQuestion,
  normalizeOptions,
  padOptionsWithFallback,
  parseCombinedGenreReply,
  parseFinalBookPlan,
  parseOnboardingReply,
  parseStyleSuggestions,
  summarizeOnboardingAnswers,
  type OnboardingReplyOption
} from "../src/features/ai/bookOnboarding";

describe("book onboarding helpers", () => {
  const styleSuggestions = {
    styles: [
      {
        name: "cold poetic",
        description: "restrained, precise, atmospheric",
        exampleSentence: "The lighthouse cut the rain apart like a late blade."
      },
      {
        name: "fast suspense",
        description: "dense clues and short sentences",
        exampleSentence: "At the third bell, another name vanished from the list."
      },
      {
        name: "sea fog fantasy",
        description: "realistic mystery with a light fantastic layer",
        exampleSentence: "When the tide withdrew, street lamps still glowed under the sea."
      }
    ],
    questions: {
      protagonist: "Who is the protagonist?",
      conflict: "What is the first conflict?",
      setting: "Where does it happen?",
      openingGoal: "What should chapter one achieve?"
    }
  };

  it("parses style suggestions from DeepSeek JSON", () => {
    const result = parseStyleSuggestions(JSON.stringify(styleSuggestions));

    expect(result.styles[0].name).toBe("cold poetic");
    expect(result.styles[0].exampleSentence).toContain("lighthouse");
    expect(result.questions.conflict).toBe("What is the first conflict?");
  });

  it("parses a finalized book plan and formats it into default materials", () => {
    const plan = parseFinalBookPlan(
      JSON.stringify({
        title: "Star Tide",
        summary: "A night watch keeper investigates a vanishing tide list.",
        worldbuilding: "A floating city runs on tidal power.",
        characters: "Lin Chao: an amnesiac lighthouse keeper.",
        plotOutline: "Chapter 1: Lin Chao finds the missing-name list.",
        chapterSummary: "Chapter one reveals the missing-name list."
      })
    );

    expect(plan.title).toBe("Star Tide");
    expect(formatOnboardingMaterials(plan)).toEqual({
      worldbuilding: "A floating city runs on tidal power.",
      characters: "Lin Chao: an amnesiac lighthouse keeper.",
      plotOutline: "Chapter 1: Lin Chao finds the missing-name list.",
      chapterSummary: "Chapter one reveals the missing-name list."
    });
  });

  it("builds JSON-mode prompts that explicitly ask for JSON", () => {
    const styleMessages = buildStyleSuggestionMessages({ genre: "mystery adventure", workingTitle: "Star Tide" });
    const finalMessages = buildFinalizeBookMessages({
      genre: "mystery adventure",
      workingTitle: "Star Tide",
      styleName: "cold poetic",
      styleDescription: "restrained, precise",
      customStyle: "",
      protagonist: "Lin Chao",
      conflict: "the tide list is erasing people",
      setting: "a near-future floating city",
      openingGoal: "find the first survivor"
    });

    expect(styleMessages.map((message) => message.content).join("\n")).toContain("json");
    expect(finalMessages.map((message) => message.content).join("\n")).toContain("json");
  });

  it("builds and parses AI reply options for each onboarding turn", () => {
    const initial = createInitialOnboardingConversation();
    const messages = buildOnboardingReplyMessages({
      conversation: initial,
      answer: "mystery adventure, working title Star Tide",
      styleSuggestions
    });

    expect(messages.map((message) => message.content).join("\n")).toContain("options");

    const reply = parseOnboardingReply(
      JSON.stringify({
        reply: "Great direction. Pick a style, or type your own.",
        options: [
          {
            label: "cold poetic",
            description: "restrained, precise, atmospheric",
            exampleSentence:
              "The lighthouse cut the rain apart like a late blade. Lin Chao spread the list on the desk and stopped at the third red dot."
          }
        ]
      })
    );

    expect(reply.reply).toContain("Pick a style");
    expect(reply.options[0]).toMatchObject({
      label: "cold poetic",
      description: expect.stringContaining("restrained"),
      exampleSentence: expect.stringContaining("third red dot")
    });
  });

  it("requires exactly 4 clickable options in onboarding prompts", () => {
    const initial = createInitialOnboardingConversation();
    const regularPrompt = buildOnboardingReplyMessages({
      conversation: initial,
      answer: "mystery adventure, working title Star Tide",
      styleSuggestions
    }).map((message) => message.content).join("\n");
    const genrePrompt = buildCombinedGenreReplyMessages({
      conversation: initial,
      answer: "mystery adventure, working title Star Tide"
    }).map((message) => message.content).join("\n");

    expect(regularPrompt).toContain("恰好 4");
    expect(regularPrompt).toContain("complete");
    expect(genrePrompt).toContain("恰好 4");
  });

  it("parser caps options at 4 even when AI returns more", () => {
    const reply = parseOnboardingReply(
      JSON.stringify({
        reply: "Pick one.",
        options: [
          { label: "A", description: "one", exampleSentence: "a" },
          { label: "B", description: "two", exampleSentence: "b" },
          { label: "C", description: "three", exampleSentence: "c" },
          { label: "D", description: "four", exampleSentence: "d" },
          { label: "E", description: "five", exampleSentence: "e" }
        ]
      })
    );

    expect(reply.options).toHaveLength(4);
    expect(reply.options.map((option) => option.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("normalizeOptions dedupes and truncates to 4", () => {
    const options: OnboardingReplyOption[] = [
      { label: "A", description: "one", exampleSentence: "a" },
      { label: "B", description: "two", exampleSentence: "b" },
      { label: "A", description: "duplicate", exampleSentence: "dup" },
      { label: "", description: "blank", exampleSentence: "blank" },
      { label: "C", description: "three", exampleSentence: "c" },
      { label: "D", description: "four", exampleSentence: "d" },
      { label: "E", description: "five", exampleSentence: "e" }
    ];

    const normalized = normalizeOptions(options);
    expect(normalized.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("normalizeOptions removes empty labels and dedupes case-insensitively", () => {
    const options: OnboardingReplyOption[] = [
      { label: "悬疑科幻", description: "one", exampleSentence: "a" },
      { label: "悬疑科幻", description: "duplicate", exampleSentence: "dup" },
      { label: "", description: "blank", exampleSentence: "blank" },
      { label: "都市奇幻", description: "two", exampleSentence: "b" }
    ];

    const normalized = normalizeOptions(options);
    expect(normalized).toHaveLength(2);
    expect(normalized.map((o) => o.label)).toEqual(["悬疑科幻", "都市奇幻"]);
  });

  it("buildOptionRetryMessages includes needed count and existing options", () => {
    const messages = buildOptionRetryMessages({
      step: "style",
      currentQuestion: "Pick a style.",
      userAnswer: "mystery adventure",
      collectedAnswers: { genre: "mystery", workingTitle: "", styleName: "", styleDescription: "", customStyle: "", protagonist: "", conflict: "", setting: "", openingGoal: "" },
      firstReply: "Pick a style.",
      firstOptions: [{ label: "A", description: "one", exampleSentence: "a" }],
      neededCount: 3
    });

    const content = messages.map((m) => m.content).join("\n");
    expect(content).toContain("3");
    expect(content).toContain("补充选项");
  });

  it("padOptionsWithFallback pads from local fallback when options < 4", () => {
    const options: OnboardingReplyOption[] = [
      { label: "Custom A", description: "custom", exampleSentence: "a" }
    ];
    const padded = padOptionsWithFallback(options, "genre");
    expect(padded).toHaveLength(4);
    expect(padded[0].label).toBe("Custom A");
  });

  it("padOptionsWithFallback skips fallback labels that already exist", () => {
    const fallbackForGenre = getFallbackOptions("genre");
    const existingLabel = fallbackForGenre[0].label;
    const options: OnboardingReplyOption[] = [
      { label: existingLabel, description: "already here", exampleSentence: "x" },
      { label: "Extra", description: "extra option", exampleSentence: "y" }
    ];
    const padded = padOptionsWithFallback(options, "genre");
    const labels = padded.map((o) => o.label);
    // Should not duplicate existingLabel
    const firstOccurrence = labels.indexOf(existingLabel);
    const lastOccurrence = labels.lastIndexOf(existingLabel);
    expect(firstOccurrence).toBe(lastOccurrence);
    expect(padded).toHaveLength(4);
  });

  it("padOptionsWithFallback returns options unchanged when already >= 4", () => {
    const options: OnboardingReplyOption[] = [
      { label: "A", description: "1", exampleSentence: "a" },
      { label: "B", description: "2", exampleSentence: "b" },
      { label: "C", description: "3", exampleSentence: "c" },
      { label: "D", description: "4", exampleSentence: "d" }
    ];
    const padded = padOptionsWithFallback(options, "genre");
    expect(padded).toHaveLength(4);
    expect(padded.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("padOptionsWithFallback returns [] for complete step", () => {
    const padded = padOptionsWithFallback([], "complete");
    expect(padded).toEqual([]);
  });

  it("getFallbackOptions returns options for non-complete steps", () => {
    const genreFallbacks = getFallbackOptions("genre");
    expect(genreFallbacks.length).toBeGreaterThanOrEqual(4);
    expect(genreFallbacks[0].label).toBeTruthy();
  });

  it("getFallbackOptions returns [] for complete step", () => {
    expect(getFallbackOptions("complete")).toEqual([]);
  });

  it("complete step allows empty options without refill", () => {
    const combined = parseCombinedGenreReply(
      JSON.stringify({
        reply: "Invalid answer, try again.",
        nextStep: "genre",
        options: [{ label: "Mystery", description: "clues", exampleSentence: "A clue appears." }],
        styles: [],
        questions: {}
      })
    );

    expect(combined.replyResult.options).toHaveLength(1);
  });

  it("advances new-book onboarding as an AI-led conversation", () => {
    const initial = createInitialOnboardingConversation();
    expect(initial.messages[0].role).toBe("assistant");
    expect(initial.quickReplies.length).toBeGreaterThan(0);

    const afterGenre = getNextOnboardingConversation(initial, "mystery adventure, working title Star Tide");
    expect(afterGenre.answers.genre).toBe("mystery adventure, working title Star Tide");
    expect(afterGenre.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: expect.stringContaining("风格")
    });

    const afterStyle = getNextOnboardingConversation(afterGenre, "cold poetic");
    const afterHero = getNextOnboardingConversation(afterStyle, "Lin Chao, an amnesiac lighthouse keeper");
    const afterConflict = getNextOnboardingConversation(afterHero, "the tide list is erasing people");
    const afterSetting = getNextOnboardingConversation(afterConflict, "a near-future floating city");
    const complete = getNextOnboardingConversation(afterSetting, "find the first survivor");

    expect(complete.isComplete).toBe(true);
    expect(summarizeOnboardingAnswers(complete.answers)).toMatchObject({
      genre: "mystery adventure, working title Star Tide",
      styleName: "cold poetic",
      protagonist: "Lin Chao, an amnesiac lighthouse keeper",
      openingGoal: "find the first survivor"
    });
  });
});