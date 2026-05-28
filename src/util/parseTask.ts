/**
 * Extract an Asana task GID from a URL or accept a bare GID.
 *
 * Supports:
 *   https://app.asana.com/0/<project_gid>/<task_gid>
 *   https://app.asana.com/0/<project_gid>/<task_gid>/f
 *   https://app.asana.com/1/<workspace>/project/<p>/task/<task_gid>
 *   https://app.asana.com/1/<workspace>/inbox/<...>?focus_task=<task_gid>
 *   bare numeric GID
 */
export function parseTaskRef(input: string): string {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Not a valid Asana task URL or GID: ${input}`);
  }
  const focus = url.searchParams.get("focus_task");
  if (focus && /^\d+$/.test(focus)) return focus;
  const parts = url.pathname.split("/").filter(Boolean);
  const taskIdx = parts.indexOf("task");
  if (taskIdx >= 0 && parts[taskIdx + 1] && /^\d+$/.test(parts[taskIdx + 1])) {
    return parts[taskIdx + 1];
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) return parts[i];
  }
  throw new Error(`Could not extract a task GID from: ${input}`);
}
