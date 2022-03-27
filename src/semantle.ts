import _ from "lodash"
import { secretWords } from "./secretWords"


function mag(a: number[]) {
  return Math.sqrt(a.reduce(function (sum, val) {
    return sum + val * val
  }, 0))
}

function dot(f1: number[], f2: number[]) {
  return f1.reduce(function (sum, a, idx) {
    return sum + a * f2[idx]
  }, 0)
}

function getCosSim(f1: number[], f2: number[]) {
  return dot(f1, f2) / (mag(f1) * mag(f2))
}

/**
 * Retrieve similiarity data between a secret and a guess word
 * from the semantle server. Successful responses are cached
 * indefinitely in KV store.
 */
export async function getModel(secret: string, word: string) {
  let model = await KV.get(`model2/${secret}/${word}`, 'json') as { percentile?: number, vec: number[] } | null

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

export function getSecretWordToday(): string {
  const today = Math.floor(Date.now() / 86400000)
  const initialDay = 19021
  const puzzleNumber = (today - initialDay) % secretWords.length
  return secretWords[puzzleNumber].toLowerCase()
}

export async function getSemantleGameToday(channelId: string) {
  const secret = getSecretWordToday()
  return new SemantleGame(secret, channelId)
}

export type RecordedGuess = {
  user: { id: string, name: string },
  guessNumber: number
  word: string
  similarity: number
  percentile?: number
}

export type GuessResult = {
  code: 'unknown'
} | {
  code: 'found' | 'warm' | 'cold' | 'duplicate'
  guess: RecordedGuess
  guesses: RecordedGuess[]
}

export class SemantleGame {
  constructor(readonly channelId: string, readonly secret: string) { }

  async getGuesses() {
    const { channelId, secret } = this
    return (await KV.get(`guesses/${channelId}/${secret}`, 'json') as RecordedGuess[] | null) || []
  }

  async guess(user: { id: string, name: string }, word: string): Promise<GuessResult> {
    const { channelId, secret } = this
    word = word.replace(/\ /gi, "_")

    let [secretModel, guessModel, guesses] = await Promise.all([
      getModel(secret, secret),
      getModel(secret, word),
      this.getGuesses()
    ])

    if (!guessModel) {
      return {
        code: 'unknown'
      }
    }

    const duplicateGuess = guesses.find(g => g.word === word)
    if (duplicateGuess) {
      return {
        code: 'duplicate',
        guess: duplicateGuess,
        guesses
      }
    }

    // Recording a new guess
    const { percentile } = guessModel
    const similarity = getCosSim(guessModel.vec, secretModel!.vec) * 100.0

    const guess = {
      user,
      guessNumber: guesses.length + 1,
      word,
      similarity,
      percentile
    }

    guesses.push(guess)
    guesses = _.sortBy(guesses, g => -g.similarity)
    await KV.put(`guesses/${channelId}/${secret}`, JSON.stringify(guesses))

    let code: GuessResult['code'] = 'cold'
    if (percentile === 1000) {
      code = 'found'
    } else if (percentile !== undefined) {
      code = 'warm'
    }

    return {
      code, guess, guesses
    }
  }
}