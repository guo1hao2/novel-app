import { describe, expect, it } from "vitest";

import { getBookManagerLayout, getCreateActionMenuItems } from "../src/features/library/bookManagerView";

describe("book manager view helpers", () => {
  it("only shows chapter and volume create actions after the floating add button opens", () => {
    expect(getCreateActionMenuItems(false)).toEqual([]);
    expect(getCreateActionMenuItems(true)).toEqual([
      { key: "chapter", label: "新建章节", icon: "document-text-outline" },
      { key: "volume", label: "新建分卷", icon: "folder-outline" }
    ]);
  });

  it("keeps phone layouts compact with two shelf columns and single-column detail", () => {
    expect(getBookManagerLayout({ width: 390, platform: "ios" })).toMatchObject({
      contentMaxWidth: 720,
      shelfColumns: 2,
      shelfCardWidth: "48%",
      coverHeight: 178,
      detailColumns: false
    });
  });

  it("uses a wider tablet layout without switching to the web desktop shell", () => {
    expect(getBookManagerLayout({ width: 820, platform: "ios" })).toMatchObject({
      contentMaxWidth: 860,
      shelfColumns: 3,
      shelfCardWidth: "31.8%",
      coverHeight: 190,
      detailColumns: false
    });
  });

  it("enhances web layouts with desktop width, denser shelf columns, and two-column detail", () => {
    expect(getBookManagerLayout({ width: 1280, platform: "web" })).toMatchObject({
      contentMaxWidth: 1120,
      shelfColumns: 4,
      shelfCardWidth: "23.5%",
      coverHeight: 210,
      detailColumns: true
    });

    expect(getBookManagerLayout({ width: 1600, platform: "web" })).toMatchObject({
      contentMaxWidth: 1240,
      shelfColumns: 5,
      shelfCardWidth: "18.8%",
      coverHeight: 220,
      detailColumns: true
    });
  });
});
