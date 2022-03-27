import _ from 'lodash'
import {
  ApplicationCommand,
  ApplicationCommandOptionType,
  Interaction,
  ApplicationCommandInteractionData,
  ApplicationCommandInteractionDataOption,
  InteractionHandler,
  InteractionResponse,
  InteractionResponseType
} from "@glenstack/cf-workers-discord-bot"
// @ts-ignore
import AsciiTable from 'ascii-table'
import { getSemantleGameToday } from '../semantle'

export const command: ApplicationCommand = {
  name: "g",
  description: "Make a semantle guess",
  options: [
    {
      name: "word",
      description: "The word to guess",
      type: ApplicationCommandOptionType.STRING,
      required: true
    },
  ],
}

function renderPercentile(percentile: number | undefined) {
  if (percentile === 1000) {
    return "FOUND!"
  } else if (percentile != null) {
    const blocks = Math.round((percentile / 1000) * 10)
    return `${percentile.toString().padStart(4, ' ')}/1000 ` + "🟩".repeat(blocks) + "⬛".repeat(10 - blocks)
  } else {
    return "(cold)"
  }
}

async function guessWord(user: { id: string, name: string }, channelId: string, word: string) {

  const game = await getSemantleGameToday(channelId)
  const res = await game.guess(user, word)

  if (res.code === 'unknown') {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Ich kenne das Wort **${word}** nicht,,`
      }
    }
  }

  const { guess, guesses } = res

  if (res.code === 'duplicate') {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `${guess.user.name} already guessed **${word}**!`
      }
    }
  }

  let output = ``

  if (res.code === 'found') {
    output += `${guess.user.name} wins! The secret word is **${guess.word}**.`
  } else {
    output += `${guess.user.name} guesses **${guess.word}**!`
  }

  const table = new AsciiTable()
  table
    .removeBorder()
    .setHeading("From", "#", "Guess", "Similarity", "Getting close?", "")

  table.addRow(guess.user.name, guess.guessNumber, guess.word, guess.similarity.toFixed(2), renderPercentile(guess.percentile))

  const top5 = guesses.filter(g => g !== guess).slice(0, 5)
  for (const g of top5) {
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

  if (guesses.length > 6) {
    lines.push("  ...")
  }

  output += "\n```\n" + lines.join("\n") + "\n```"

  if (res.code === 'found') {
    const time = Date.now() / 86400000
    const nextDay = Math.ceil(time)
    const timeUntilNext = (nextDay - time) * 86400000
    const hours = timeUntilNext / 1000 / 3600
    const leftoverMinutes = (hours - Math.floor(hours)) * 60
    const timeDesc = `${Math.floor(hours)}h${Math.floor(leftoverMinutes)}m`


    output += `\nYou found it in **${guess.guessNumber}** guesses.`
    output += `\nNext game will be ready in ${timeDesc}.`
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: output
    },
  }
}

export const handler: InteractionHandler = async (
  interaction: Interaction
): Promise<InteractionResponse> => {
  try {
    const options = (interaction.data as ApplicationCommandInteractionData)
      .options as ApplicationCommandInteractionDataOption[]

    const word = (options.find(
      (option) => option.name === "word"
    ) as ApplicationCommandInteractionDataOption).value

    const user = {
      id: interaction.member.user.id,
      name: interaction.member.nick || interaction.member.user.username,
    }

    return guessWord(user, interaction.channel_id, word)
  } catch (err: any) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: err.message,
      },
    }
  }
}
