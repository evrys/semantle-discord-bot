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
  GuildMember,
} from "@glenstack/cf-workers-discord-bot";
import { secretWords } from "../secretWords"
// @ts-ignore
import AsciiTable from 'ascii-table'

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
};

function mag(a: number[]) {
  return Math.sqrt(a.reduce(function(sum, val) {
      return sum + val * val;
  }, 0));
}

function dot(f1: number[], f2: number[]) {
  return f1.reduce(function(sum, a, idx) {
      return sum + a*f2[idx];
  }, 0);
}

function getCosSim(f1: number[], f2: number[]) {
  return dot(f1,f2)/(mag(f1)*mag(f2));
}

/**
 * Retrieve similiarity data between a secret and a guess word
 * from the semantle server. Successful responses are cached
 * indefinitely in KV store.
 */
async function getModel(secret: string, word: string) {
  let model = await KV.get(`model2/${secret}/${word}`, 'json') as { percentile?: number, vec: number[] }|null

  if (!model) {
    const response = await fetch(`https://semantle.novalis.org/model2/${secret}/${word}`)

    if (response.status !== 200) {
      throw new Error(`Semantle Error: ${response.status} ${response.statusText} ${await response.text()}`)
    }

    const text = await response.text()
    if (text === "") {
      model = null
    } else {
      model = JSON.parse(text) as { "vec": number[] }
    }

    await KV.put(`model2/${secret}/${word}`, JSON.stringify(model))
  }

  return model
}

type Guess = {
  user: { id: string, name: string },
  guessNumber: number
  word: string
  similarity: number
  percentile?: number
}

async function getGuessesFromChannel(channelId: string, secret: string): Promise<Guess[]> {
  let guesses = await KV.get(`guesses/${channelId}/${secret}`, 'json') as Guess[]|null
  return guesses || []
}

function renderPercentile(percentile: number|undefined) {
  if (percentile === 1000) {
    return "FOUND!"
  } else if (percentile != null) {
    const blocks = Math.round((percentile / 1000)*10)
    return `${percentile.toString().padStart(4, ' ')}/1000 ` + "🟩".repeat(blocks) + "⬛".repeat(10 - blocks)
  } else {
    return "(cold)"
  }
}

async function guessWord(user: { id: string, name: string }, channelId: string, word: string) {
  word = word.replace(/\ /gi, "_")

  const today = Math.floor(Date.now() / 86400000);
  const initialDay = 19021;
  const puzzleNumber = (today - initialDay) % secretWords.length;
  const secret = secretWords[puzzleNumber].toLowerCase()

  let [secretModel, guessModel, guesses] = await Promise.all([
    getModel(secret, secret),
    getModel(secret, word),
    getGuessesFromChannel(channelId, secret)
  ])

  if (!guessModel) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Ich kenne das Wort '${word}' nicht,,`
      }
    }
  }

  const { percentile } = guessModel
  const similarity = getCosSim(guessModel.vec, secretModel!.vec) * 100.0;

  let guess = guesses.find(g => g.word === word)
  if (!guess) {
    guess = {
      user,
      guessNumber: guesses.length + 1,
      word,
      similarity,
      percentile
    }
    guesses.push(guess)  
    guesses = _.sortBy(guesses, g => -g.similarity)
    await KV.put(`guesses/${channelId}/${secret}`, JSON.stringify(guesses))
  }

  const top5 = guesses.filter(g => g !== guess).slice(0, 5)

  const table = new AsciiTable()
  table
    .removeBorder()
    .setHeading("#", "Guess", "Similarity", "Getting close?", "")

  table.addRow(guess.guessNumber, guess.word, guess.similarity.toFixed(2), renderPercentile(guess.percentile))
  for (const g of top5) {
    table.addRow(g.guessNumber, g.word, g.similarity.toFixed(2), renderPercentile(g.percentile))
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

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "```\n" + lines.join("\n") + "\n```"
    },
  };
}

export const handler: InteractionHandler = async (
  interaction: Interaction
): Promise<InteractionResponse> => {
    try {
      const options = (interaction.data as ApplicationCommandInteractionData)
      .options as ApplicationCommandInteractionDataOption[];

      const word = (options.find(
        (option) => option.name === "word"
      ) as ApplicationCommandInteractionDataOption).value;
      
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
      };
    }
};
