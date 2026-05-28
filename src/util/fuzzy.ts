import { select } from "@inquirer/prompts";

export async function chooseFromList<T>(
  items: T[],
  message: string,
  formatter: (item: T) => string,
): Promise<T> {
  if (items.length === 0) throw new Error("No items to choose from.");
  const choice = await select({
    message,
    choices: items.map((item, idx) => ({
      name: formatter(item),
      value: idx,
    })),
    pageSize: Math.min(15, items.length),
  });
  return items[choice];
}
