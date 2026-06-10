import type { OpenBotState, Storage } from "@meetopenbot/plugin-sdk";

export interface PersistedStitchState {
  stitchProjectId?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const normalizeProjectId = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  return value.startsWith("projects/") ? value.slice(9) : value;
};

export const readPersistedProjectId = (state: OpenBotState): string | undefined => {
  const record = asRecord(state.channelDetails?.state) as PersistedStitchState;
  return typeof record.stitchProjectId === "string" ? record.stitchProjectId : undefined;
};

export const persistProjectId = async (
  channelId: string | undefined,
  storage: Storage,
  projectId: string,
): Promise<void> => {
  if (!channelId) return;
  await storage.patchChannelState({
    channelId,
    state: { stitchProjectId: projectId },
  });
};

/** Derive a short, human-readable project title from the user's prompt. */
export const deriveProjectTitle = (prompt: string): string => {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Stitch Project";
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
};
