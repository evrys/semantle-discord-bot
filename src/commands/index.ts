import {
  ApplicationCommand,
  InteractionHandler,
} from "@glenstack/cf-workers-discord-bot"
import { command as guessCommand, handler as guessHandler } from "./guess"
import { command as statCommand, handler as statHandler } from "./stat"
import { command as giveupCommand, handler as giveupHandler } from "./igiveup"

export const commands: [ApplicationCommand, InteractionHandler][] = [
  [guessCommand, guessHandler],
  [statCommand, statHandler],
  [giveupCommand, giveupHandler]
]
