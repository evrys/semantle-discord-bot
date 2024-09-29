import { SemantleGame } from '../game'

export async function giveupCommand(user: { id: string, name: string }, channelId: string, kvs: KVNamespace) {
  const game = SemantleGame.todayForChannel(channelId, kvs)
  const guesses = await game.getGuesses()

  const time = Date.now() / 86400000
  const nextDay = Math.ceil(time)
  const timeUntilNext = (nextDay - time) * 86400000
  const hours = timeUntilNext / 1000 / 3600
  const leftoverMinutes = (hours - Math.floor(hours)) * 60
  const timeDesc = `${Math.floor(hours)}h${Math.floor(leftoverMinutes)}m`

  let output = `${user.name} gave up! The secret word was **${game.secret}**.`
  output += `\nYou tried **${guesses.length}** guesses.`
  output += `\nNext game will be ready in ${timeDesc}.`

  return output
}