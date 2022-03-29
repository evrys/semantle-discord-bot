import _ from 'lodash'
import {
  ApplicationCommand,
  Interaction,
  InteractionHandler,
  InteractionResponse,
  InteractionResponseType
} from "@glenstack/cf-workers-discord-bot"
// @ts-ignore
import AsciiTable from 'ascii-table'

import { renderPercentile, renderDuration } from '../rendering'
import { SemantleGame } from '../game'

export const command: ApplicationCommand = {
  name: "stat",
  description: "Get current status of Semantle game"
}

async function statCommand(channelId: string): Promise<string> {
  const game = SemantleGame.todayForChannel(channelId)
  const guesses = await game.getGuesses()

  let output = `The current game started **${renderDuration(game.timeSinceStart)}** ago.`

  if (guesses.length === 0) {
    output += `\nThere haven't been any guesses yet!`
    return output
  }

  output += ` There have been **${guesses.length}** guesses so far.`

  const table = new AsciiTable()
  table
    .removeBorder()
    .setHeading("From", "#", "Guess", "Similarity", "Getting close?", "")

  // 15 is about as many as discord will let us show in a single message
  for (const g of guesses.slice(0, 15)) {
    table.addRow(g.user.name, g.guessNumber, g.word, g.similarity.toFixed(2), renderPercentile(g.percentile))
  }

  table.setHeadingAlignLeft()
  // Column alignment
  table.setAlignLeft(0)
  table.setAlignLeft(1)
  table.setAlignLeft(2)
  table.setAlignLeft(3)
  table.setAlignLeft(4)

  const lines = table.toString().split("\n") as string[]
  lines.splice(3, 0, "  " + "―".repeat(lines[0].length))

  if (guesses.length > 15) {
    lines.push("  ...")
  }

  output += "\n```\n" + lines.join("\n") + "\n```"

  return output
}

export const handler: InteractionHandler = async (
  interaction: Interaction
): Promise<InteractionResponse> => {
  try {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: await statCommand(interaction.channel_id),
      },
    }
  } catch (err: any) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: err.message,
      },
    }
  }
}
