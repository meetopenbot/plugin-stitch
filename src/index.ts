import {
  agentOutput,
  definePlugin,
  shouldHandleInvoke,
  uiWidget,
  type AgentInvokeEvent,
  type PluginHandlerContext,
  type UIWidgetResponseEvent,
} from "@meetopenbot/plugin-sdk";
import {
  Stitch,
  StitchToolClient,
  StitchError,
  type Project,
  type Screen,
} from "@google/stitch-sdk";
import {
  deriveProjectTitle,
  persistProjectId,
  readPersistedProjectId,
} from "./state";
import { buildApiKeyWidget, buildScreenWidget } from "./ui";

const STITCH_API_KEY_ENV_VAR = "STITCH_API_KEY";

const plugin = definePlugin({
  name: "Stitch",
  description: "Stitch agent for UI generation",
  configSchema: {
    type: "object",
    properties: {
      apiKey: { type: "string", format: "password" },
    },
  },
  factory: (context) => (builder) => {
    const getApiKey = () =>
      (context.config.apiKey as string) || process.env[STITCH_API_KEY_ENV_VAR];

    builder.on("agent:invoke", async function* (event: AgentInvokeEvent, ctx: PluginHandlerContext) {
      if (!shouldHandleInvoke(event, context.agentId)) return;

      const { content } = event.data;
      const threadId = event.meta?.threadId ?? ctx.state.threadId;
      const apiKey = getApiKey();

      if (!apiKey) {
        yield buildApiKeyWidget(context.agentId, threadId);
        return;
      }

      const prompt = (content ?? "").trim();
      if (!prompt) {
        yield agentOutput({
          agentId: context.agentId,
          content: "Describe the UI screen you'd like Stitch to generate.",
          threadId,
        });
        return;
      }

      const client = new StitchToolClient({ apiKey });
      const stitch = new Stitch(client);

      try {
        const existingProjectId = readPersistedProjectId(ctx.state);

        let project: Project;
        if (existingProjectId) {
          project = stitch.project(existingProjectId);
        } else {
          project = await stitch.createProject(deriveProjectTitle(prompt));
          await persistProjectId(ctx.state.channelId, context.storage, project.id);
        }

        const screen: Screen = await project.generate(prompt);

        const [imageUrl, htmlUrl] = await Promise.all([
          screen.getImage().catch(() => undefined),
          screen.getHtml().catch(() => undefined),
        ]);

        yield buildScreenWidget(context.agentId, threadId, {
          screenId: screen.id,
          prompt,
          imageUrl,
          htmlUrl,
        });

        yield agentOutput({
          agentId: context.agentId,
          content: `Generated a screen in project \`${project.id}\`. Here's the screen: ${imageUrl ? `[Open screenshot](${imageUrl})` : ""} ${htmlUrl ? `[Download HTML](${htmlUrl})` : ""}`,
          threadId,
        });
      } catch (error: any) {
        if (error instanceof StitchError && error.code === "AUTH_FAILED") {
          yield buildApiKeyWidget(context.agentId, threadId, error.message);
          return;
        }

        const message = error instanceof StitchError ? error.message : String(error?.message ?? error);
        yield agentOutput({
          agentId: context.agentId,
          content: `Error: ${message}`,
          threadId,
        });
      } finally {
        await client.close().catch(() => { });
      }
    });

    builder.on("client:ui:widget:response", async function* (event: UIWidgetResponseEvent) {
      const { metadata, values, widgetId } = event.data;
      if (metadata?.type !== "api_key_request" || !values?.apiKey) return;

      await context.storage.createVariable({
        key: STITCH_API_KEY_ENV_VAR,
        value: values.apiKey as string,
        secret: true,
      });

      yield uiWidget({
        agentId: context.agentId,
        widget: {
          widgetId,
          kind: "message",
          title: "Stitch API Key Saved",
          body: "Stitch API key saved. Please retry your request.",
          state: "submitted",
          actions: [{ id: "ok", label: "Got it", variant: "primary" }],
        },
      });
    });
  },
});

export default plugin;
