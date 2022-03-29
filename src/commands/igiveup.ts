import _ from 'lodash'
import {
  ApplicationCommand,
  ApplicationCommandOptionType,
  Interaction,
  ApplicationCommandInteractionData,
  ApplicationCommandInteractionDataOption,
  InteractionHandler,
  InteractionResponse,
  InteractionResponseType,
} from "@glenstack/cf-workers-discord-bot"
import { secretWords } from "../secretWords"

export const command: ApplicationCommand = {
  name: "igiveup",
  description: "Give up on today's semantle",
  options: [
    {
      name: "confirm",
      description: "Type confirm to verify",
      type: ApplicationCommandOptionType.STRING,
      required: true
    },
  ],
}

type Guess = {
  user: { id: string, name: string },
  guessNumber: number
  word: string
  similarity: number
  percentile?: number
}

async function getGuessesFromChannel(channelId: string, secret: string): Promise<Guess[]> {
  let guesses = await KV.get(`guesses/${channelId}/${secret}`, 'json') as Guess[] | null
  return guesses || []
}

async function giveUp(user: { id: string, name: string }, channelId: string) {
  const today = Math.floor(Date.now() / 86400000)
  const initialDay = 19021
  const puzzleNumber = (today - initialDay) % secretWords.length
  const secret = secretWords[puzzleNumber].toLowerCase()

  const guesses = await getGuessesFromChannel(channelId, secret)

  const time = Date.now() / 86400000
  const nextDay = Math.ceil(time)
  const timeUntilNext = (nextDay - time) * 86400000
  const hours = timeUntilNext / 1000 / 3600
  const leftoverMinutes = (hours - Math.floor(hours)) * 60
  const timeDesc = `${Math.floor(hours)}h${Math.floor(leftoverMinutes)}m`

  let output = `${user.name} gave up! The secret word was **${secret}**.`
  output += `\nYou tried **${guesses.length}** guesses.`
  output += `\nNext game will be ready in ${timeDesc}.`


  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: output,
    },
  }
}

export const handler: InteractionHandler = async (
  interaction: Interaction
): Promise<InteractionResponse> => {
  try {
    const options = (interaction.data as ApplicationCommandInteractionData)
      .options as ApplicationCommandInteractionDataOption[]

    const confirm = (options.find(
      (option) => option.name === "confirm"
    ) as ApplicationCommandInteractionDataOption).value

    if (confirm !== "confirm") {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "You really want to give up? Have to type `/giveup confirm`",
        },
      }
    }

    const user = {
      id: interaction.member.user.id,
      name: interaction.member.nick || interaction.member.user.username,
    }

    return giveUp(user, interaction.channel_id)
  } catch (err: any) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: err.message,
      },
    }
  }
}
