import { vi } from "vitest";

export const mockDatabase = {
  closeAsync: vi.fn(),
  execAsync: vi.fn(),
  getAllAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  runAsync: vi.fn(),
  withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
    await task();
  })
};

export const openDatabaseAsync = vi.fn(async () => mockDatabase);
export const deleteDatabaseAsync = vi.fn();

export function resetExpoSqliteMock() {
  mockDatabase.closeAsync.mockReset();
  mockDatabase.execAsync.mockReset();
  mockDatabase.getAllAsync.mockReset();
  mockDatabase.getFirstAsync.mockReset();
  mockDatabase.runAsync.mockReset();
  mockDatabase.withTransactionAsync.mockReset();
  mockDatabase.withTransactionAsync.mockImplementation(async (task: () => Promise<void>) => {
    await task();
  });
  openDatabaseAsync.mockClear();
  deleteDatabaseAsync.mockClear();
}
