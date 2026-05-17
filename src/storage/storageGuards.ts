export function createSingleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  let completed = false;
  let completedValue: T;

  return async () => {
    if (completed) {
      return completedValue;
    }
    if (!inFlight) {
      inFlight = task().then(
        (value) => {
          completed = true;
          completedValue = value;
          return value;
        },
        (error) => {
          inFlight = null;
          throw error;
        }
      );
    }
    return inFlight;
  };
}

export function createWriteQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let queue = Promise.resolve();

  return async <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
