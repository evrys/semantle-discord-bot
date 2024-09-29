import { SemantleGame } from '../game'
import { renderDuration, renderPercentile } from '../rendering'

export async function guessCommand(user: { id: string, name: string }, channelId: string, word: string, kvs: KVNamespace): Promise<string> {
  const game = SemantleGame.todayForChannel(channelId, kvs)
  const res = await game.guess(user, word)

  if (res.code === 'unknown') {
    return `I don't know the word **${word}**...`
  }

  const { guess } = res

  let output = `${user.name} guesses **${guess.word}**!`

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