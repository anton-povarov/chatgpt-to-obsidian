export function singleFlightCollector<T>(collect: () => Promise<T>): () => Promise<T> {
  let activeCollection: Promise<T> | undefined;

  return () => {
    if (activeCollection) {
      return activeCollection;
    }

    const collection = collect();
    activeCollection = collection;
    void collection.then(clearActiveCollection, clearActiveCollection);
    return collection;

    function clearActiveCollection(): void {
      if (activeCollection === collection) {
        activeCollection = undefined;
      }
    }
  };
}
