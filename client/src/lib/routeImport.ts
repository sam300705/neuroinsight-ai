/** One bounded retry for transient route-chunk fetch failures; never reload the page. */
export async function retryRouteImport<T>(load: () => Promise<T>): Promise<T> {
  try { return await load(); } catch (error) {
    if (!(error instanceof Error) || !/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(error.message)) throw error;
    await new Promise(resolve => setTimeout(resolve, 300));
    return load();
  }
}
