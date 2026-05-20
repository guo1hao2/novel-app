export type CreateActionKey = "chapter" | "volume";

export type CreateActionMenuItem = {
  key: CreateActionKey;
  label: string;
  icon: "document-text-outline" | "folder-outline";
};

const CREATE_ACTIONS: CreateActionMenuItem[] = [
  { key: "chapter", label: "新建章节", icon: "document-text-outline" },
  { key: "volume", label: "新建分卷", icon: "folder-outline" }
];

export function getCreateActionMenuItems(isOpen: boolean): CreateActionMenuItem[] {
  return isOpen ? CREATE_ACTIONS : [];
}
