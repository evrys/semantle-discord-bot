/**
 * The core server that runs on a Cloudflare worker.
 */

import type { APIInteraction } from "discord-api-types/v10";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionResponseType,
  InteractionType,
} from "discord-api-types/v10";
import { verifyKey } from "discord-interactions";
import { AutoRouter } from "itty-router";
import { toString as lodashToString } from "lodash-es";
import { GUESS_COMMAND, IGIVEUP_COMMAND, STAT_COMMAND } from "./commands.ts";
import { guessCommand } from "./commands/guess.ts";
import { giveupCommand } from "./commands/igiveup.ts";
import { statCommand } from "./commands/stat.ts";

class JsonResponse extends Response {
  constructor(body: unknown, init?: ResponseInit) {
    const jsonBody = JSON.stringify(body);
    init = Object.assign({
      ...init,
      headers: {
        "content-type": "application/json;charset=UTF-8",
        ...init?.headers,
      },
    });
    super(jsonBody, init);
  }
}

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get("/", (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

async function handleDiscordCommandRequest(request: Request, env: Env) {
  const { isValid, interaction } = await verifyDiscordRequest(request, env);
  if (!isValid || !interaction) {
    return new Response("Bad request signature.", { status: 401 });
  }

  if (interaction.type === InteractionType.Ping) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.Pong,
    });
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case GUESS_COMMAND.name.toLowerCase(): {
        if (interaction.data.type !== ApplicationCommandType.ChatInput) {
          return new JsonResponse(
            {
              error: `Unexpected application command type ${interaction.data.type}`,
            },
            { status: 400 },
          );
        }

        const words = [];
        for (const opt of interaction.data.options || []) {
          if (
            opt.name === "word" &&
            opt.type === ApplicationCommandOptionType.String
          ) {
            words.push(opt.value);
          } else {
            return new JsonResponse(
              { error: `Unexpected option ${opt.name} of type ${opt.type}` },
              { status: 400 },
            );
          }
        }

        const word = words[0];
        if (!word || words.length !== 1) {
          return new JsonResponse(
            { error: `Expected one word, got ${words.length}` },
            { status: 400 },
          );
        }

        if (!interaction.member) {
          return new JsonResponse(
            { error: `No member in interaction` },
            { status: 400 },
          );
        }

        const user = {
          id: interaction.member.user.id,
          name: interaction.member.nick || interaction.member.user.username,
        };

        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: await guessCommand(
              user,
              interaction.channel.id,
              word,
              env.KV,
            ),
          },
        };
      }
      case STAT_COMMAND.name.toLowerCase(): {
        const result = await statCommand(interaction.channel.id, env.KV);
        return new JsonResponse({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: result,
          },
        });
      }
      case IGIVEUP_COMMAND.name.toLowerCase(): {
        if (interaction.data.type !== ApplicationCommandType.ChatInput) {
          return new JsonResponse(
            {
              error: `Unexpected application command type ${interaction.data.type}`,
            },
            { status: 400 },
          );
        }

        const confirm = (interaction.data.options || []).find(
          (option) => option.name === "confirm",
        );

        if (confirm && confirm.type !== ApplicationCommandOptionType.String) {
          return new JsonResponse(
            { error: `Unexpected option type ${confirm.type}` },
            { status: 400 },
          );
        }

        if (!confirm || confirm.value !== "confirm") {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content:
                "You really want to give up? Have to type `/igiveup confirm`",
            },
          };
        }

        if (!interaction.member) {
          return new JsonResponse(
            { error: `No member in interaction` },
            { status: 400 },
          );
        }

        const user = {
          id: interaction.member.user.id,
          name: interaction.member.nick || interaction.member.user.username,
        };

        const result = await giveupCommand(
          user,
          interaction.channel.id,
          env.KV,
        );

        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: result,
          },
        };
      }
      default:
        return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
    }
  }

  return new JsonResponse({ error: "Unknown Type" }, { status: 400 });
}

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post("/", async (request, env: Env) => {
  try {
    return await handleDiscordCommandRequest(request, env);
  } catch (err) {
    console.error(err);

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: lodashToString(err),
      },
    };
  }
});

router.all("*", () => new Response("Not Found", { status: 404 }));

async function verifyDiscordRequest(request: Request, env: Env) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body) as APIInteraction, isValid: true };
}

const server = {
  fetch: router.fetch,
};

export default server;
