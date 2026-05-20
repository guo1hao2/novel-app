import { describe, expect, it } from "vitest";

import { getCreateActionMenuItems } from "../src/features/library/bookManagerView";

describe("book manager view helpers", () => {
  it("only shows chapter and volume create actions after the floating add button opens", () => {
    expect(getCreateActionMenuItems(false)).toEqual([]);
    expect(getCreateActionMenuItems(true)).toEqual([
      { key: "chapter", label: "新建章节", icon: "document-text-outline" },
      { key: "volume", label: "新建分卷", icon: "folder-outline" }
    ]);
  });
});
