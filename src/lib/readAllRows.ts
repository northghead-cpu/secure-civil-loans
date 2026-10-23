/** Never substitute an empty dataset for a failed or truncated request. */
export async function readAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("No data returned");
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}
