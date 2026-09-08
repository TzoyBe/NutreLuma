/** Serialize SDK identity changes with store operations; discard stale account results. */
export function createRevenueCatIdentity() {
  let generation = 0;
  let identifiedUser: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }

  function isReady(userId: string | null | undefined): boolean {
    return Boolean(userId && identifiedUser === userId);
  }

  return {
    isReady,
    identify<T>(userId: string | null | undefined, operation: () => Promise<T>) {
      const version = ++generation;
      identifiedUser = null;
      return enqueue(async () => {
        if (version !== generation) return undefined;
        const result = await operation();
        if (version !== generation || !userId) return undefined;
        identifiedUser = userId;
        return result;
      });
    },
    run<T>(userId: string | null | undefined, operation: (isCurrent: () => boolean) => Promise<T>) {
      if (!isReady(userId)) return Promise.resolve(undefined);
      const version = generation;
      return enqueue(async () => {
        const isCurrent = () => version === generation && isReady(userId);
        if (!isCurrent()) return undefined;
        const result = await operation(isCurrent);
        return isCurrent() ? result : undefined;
      });
    },
  };
}
