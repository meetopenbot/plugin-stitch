import { uiWidget } from "@meetopenbot/plugin-sdk";

export interface ScreenWidgetData {
  screenId: string;
  prompt: string;
  imageUrl?: string;
  htmlUrl?: string;
}

export const buildScreenWidget = (
  agentId: string,
  threadId: string | undefined,
  screen: ScreenWidgetData,
) => {
  const links: string[] = [];
  if (screen.htmlUrl) links.push(`[Download HTML](${screen.htmlUrl})`);
  if (screen.imageUrl) links.push(`[Open screenshot](${screen.imageUrl})`);

  return uiWidget({
    agentId,
    threadId,
    widget: {
      kind: "message",
      widgetId: `stitch_screen_${screen.screenId}`,
      title: "Screen generated",
      media: {
        type: "image",
        url: screen.imageUrl ?? "",
      },
      metadata: {
        type: "stitch_screen",
        screenId: screen.screenId,
        htmlUrl: screen.htmlUrl,
        imageUrl: screen.imageUrl,
      },
    },
  });
};

export const buildApiKeyWidget = (agentId: string, threadId: string | undefined, reason?: string) =>
  uiWidget({
    agentId,
    threadId,
    widget: {
      kind: "form",
      widgetId: `stitch_api_key_request_${Date.now()}`,
      title: "Stitch API Key Required",
      description: `Stitch could not authenticate${reason ? ` (${reason})` : ""}. Provide a Stitch API key to continue.`,
      fields: [
        {
          id: "apiKey",
          label: "API Key",
          type: "text",
          placeholder: "sk-...",
          required: true,
        },
      ],
      submitLabel: "Save API Key",
      metadata: {
        type: "api_key_request",
        source: "stitch",
      },
    },
  });
