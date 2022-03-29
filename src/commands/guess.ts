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
import { SemantleGame } from '../game'
import { renderDuration, renderPercentile } from '../rendering'

export const command: ApplicationCommand = {
  name: "guess",
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

async function guessCommand(user: { id: string, name: string }, channelId: string, word: string): Promise<string> {
  const game = SemantleGame.todayForChannel(channelId)
  const res = await game.guess(user, word)

  if (res.code === 'unknown') {
    return `I don't know the word **${word}**...`
  }

  const { guess } = res

  let output = `${guess.user.name} guesses **${guess.word}**!`

  if (res.code === 'duplicate') {
    output += `\n${guess.user.name} already guessed **${word}**! Similarity: **${guess.similarity.toFixed(2)}** ${renderPercentile(guess.percentile)}`
    return output
  }

  if (res.code === 'found') {
    output += ` ${guess.user.name} wins! The secret word is **${guess.word}**.`
  } else {
    output += ` Similarity: **${guess.similarity.toFixed(2)}** ${renderPercentile(guess.percentile)}`
  }

  if (res.code === 'found') {
    output += `\nYou found it in **${guess.guessNumber}** guesses.`
    output += `\nNext game will be ready in ${renderDuration(game.timeUntilNext)}.`
  }

  return output
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

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: await guessCommand(user, interaction.channel_id, word)
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
