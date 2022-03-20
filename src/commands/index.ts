import {
  ApplicationCommand,
  InteractionHandler,
} from "@glenstack/cf-workers-discord-bot";
import { command as guessCommand, handler as guessHandler } from "./guess";

export const commands: [ApplicationCommand, InteractionHandler][] = [
  [guessCommand, guessHandler],
];
