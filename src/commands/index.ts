import {
  ApplicationCommand,
  InteractionHandler,
} from "@glenstack/cf-workers-discord-bot";
import { command as guessCommand, handler as guessHandler } from "./guess";
import { command as giveupCommand, handler as giveupHandler } from "./giveup";

export const commands: [ApplicationCommand, InteractionHandler][] = [
  [guessCommand, guessHandler],
  [giveupCommand, giveupHandler]
];
