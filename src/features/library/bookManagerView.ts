export type CreateActionKey = "chapter" | "volume";

export type CreateActionMenuItem = {
  key: CreateActionKey;
  label: string;
  icon: "document-text-outline" | "folder-outline";
};

export type BookManagerPlatform = "android" | "ios" | "web" | "windows" | "macos" | string;

export type BookManagerLayoutInput = {
  width: number;
  platform: BookManagerPlatform;
};

export type BookManagerLayout = {
  contentMaxWidth: number;
  shelfColumns: number;
  shelfCardWidth: `${number}%`;
  coverHeight: number;
  detailColumns: boolean;
};

const CREATE_ACTIONS: CreateActionMenuItem[] = [
  { key: "chapter", label: "新建章节", icon: "document-text-outline" },
  { key: "volume", label: "新建分卷", icon: "folder-outline" }
];

export function getCreateActionMenuItems(isOpen: boolean): CreateActionMenuItem[] {
  return isOpen ? CREATE_ACTIONS : [];
}

export function getBookManagerLayout(input: BookManagerLayoutInput): BookManagerLayout {
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 390;
  const isWeb = input.platform === "web";

  if (isWeb && width >= 1440) {
    return {
      contentMaxWidth: 1240,
      shelfColumns: 5,
      shelfCardWidth: "18.8%",
      coverHeight: 220,
      detailColumns: true
    };
  }

  if (isWeb && width >= 1024) {
    return {
      contentMaxWidth: 1120,
      shelfColumns: 4,
      shelfCardWidth: "23.5%",
      coverHeight: 210,
      detailColumns: true
    };
  }

  if (width >= 768) {
    return {
      contentMaxWidth: 860,
      shelfColumns: 3,
      shelfCardWidth: "31.8%",
      coverHeight: 190,
      detailColumns: false
    };
  }

  return {
    contentMaxWidth: 720,
    shelfColumns: 2,
    shelfCardWidth: "48%",
    coverHeight: 178,
    detailColumns: false
  };
}
