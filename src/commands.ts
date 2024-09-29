/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

import { ApplicationCommandOptionType } from "discord-api-types/v10"

export const GUESS_COMMAND = {
  name: "guess",
  description: "Make a semantle guess",
  options: [
    {
      name: "word",
      description: "The word to guess",
      type: ApplicationCommandOptionType.String,
      required: true
    },
  ],
}

export const STAT_COMMAND = {
  name: "stat",
  description: "Get current status of Semantle game"
}

export const IGIVEUP_COMMAND = {
  name: "igiveup",
  description: "Give up on today's semantle",
  options: [
    {
      name: "confirm",
      description: "Type confirm to verify",
      type: ApplicationCommandOptionType.String,
      required: true
    },
  ],
}