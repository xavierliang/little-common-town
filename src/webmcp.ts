import { metrics, type TownState } from "./sim";

/** Optional, read-only browser tool; unsupported browsers retain the normal UI. */
export function registerTownReader(readTown: () => TownState): () => void {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool(
          tool: {
            name: string;
            title: string;
            description: string;
            inputSchema: object;
            annotations: {
              readOnlyHint: boolean;
              untrustedContentHint: boolean;
            };
            execute(input: unknown): unknown;
          },
          options: { signal: AbortSignal },
        ): void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "read_town_snapshot",
          title: "Read town snapshot",
          description:
            "Read the current simulation day, active policies and aggregate economic facts without advancing time or changing the town.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute(input) {
            if (
              !input ||
              typeof input !== "object" ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error("Expected an empty object");
            const town = readTown();
            return {
              seed: town.seed,
              policy: { ...town.policy },
              metrics: metrics(town),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => lifecycle.abort());
  } catch {
    lifecycle.abort();
  }
  return () => lifecycle.abort();
}
