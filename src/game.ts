import { sortBy } from "lodash-es";
import { secretWords } from "./secretWords.ts";

type SemantleSimilarityData = {
  similarity: number;
  initialSimilarity: number;
  percentile: number | null;
  closestSimiliarity: number;
};

type SemantleResponseType =
  | SemantleSimilarityData
  | {
      error: string;
    };

export type RecordedGuess = {
  user: { id: string; name: string };
  guessNumber: number;
  word: string;
  similarity: number;
  percentile: number | null;
};

export type GuessResult =
  | {
      code: "unknown";
    }
  | {
      code: "found" | "warm" | "cold" | "duplicate";
      guess: RecordedGuess;
      guesses: RecordedGuess[];
    };

export class SemantleGame {
  static get secretWordToday() {
    const today = Math.floor(Date.now() / 86400000);
    const initialDay = 19021;
    const puzzleNumber = (today - initialDay) % secretWords.length;
    const secretWord = secretWords[puzzleNumber];
    if (!secretWord) {
      throw new Error(`No secret word for puzzle number ${puzzleNumber}`);
    }
    return secretWord.toLowerCase();
  }

  static todayForChannel(channelId: string, kvs: KVNamespace) {
    return new SemantleGame(channelId, SemantleGame.secretWordToday, kvs);
  }

  timeSinceStart: number;
  timeUntilNext: number;

  constructor(
    readonly channelId: string,
    readonly secret: string,
    readonly kvs: KVNamespace,
  ) {
    const now = Date.now();
    const nowInDays = now / 86400000;
    this.timeSinceStart = (nowInDays - Math.floor(nowInDays)) * 86400000;
    this.timeUntilNext = (Math.ceil(nowInDays) - nowInDays) * 86400000;
  }

  async getGuesses() {
    const { channelId, secret } = this;
    return (
      ((await this.kvs.get(`guesses/${channelId}/${secret}`, "json")) as
        | RecordedGuess[]
        | null) || []
    );
  }

  /**
   * Retrieve similiarity data between a secret and a guess word
   * from the semantle server. Successful responses are cached
   * indefinitely in KV store.
   */
  async getSimilarityData(secret: string, word: string) {
    let data = (await this.kvs.get(
      `similarity/${word}/${secret}`,
      "json",
    )) as SemantleSimilarityData | null;

    if (!data) {
      const response = await fetch(
        `https://server.semantle.com/similarity/${word}/${secret}/en`,
      );

      if (response.status !== 200 && response.status !== 404) {
        throw new Error(
          `Semantle Error: ${response.status} ${response.statusText} ${await response.text()}`,
        );
      }

      const result = (await response.json()) as SemantleResponseType;

      if ("error" in result) {
        if (result.error === "Word not found") {
          return null;
        } else {
          throw new Error(`Semantle Error: ${result.error}`);
        }
      }

      data = result;
      await this.kvs.put(`similarity/${secret}/${word}`, JSON.stringify(data));
    }

    return data;
  }

  async guess(
    user: { id: string; name: string },
    word: string,
  ): Promise<GuessResult> {
    const { channelId, secret } = this;
    word = word.replace(/ /gi, "_");

    let [similarityData, guesses] = await Promise.all([
      this.getSimilarityData(secret, word),
      this.getGuesses(),
    ]);

    if (!similarityData) {
      return {
        code: "unknown",
      };
    }

    const duplicateGuess = guesses.find((g) => g.word === word);
    if (duplicateGuess) {
      return {
        code: "duplicate",
        guess: duplicateGuess,
        guesses,
      };
    }

    // Recording a new guess
    const { similarity, percentile } = similarityData;

    const guess = {
      user,
      guessNumber: guesses.length + 1,
      word,
      similarity,
      percentile,
    };

    guesses.push(guess);
    guesses = sortBy(guesses, (g) => -g.similarity);
    await this.kvs.put(
      `guesses/${channelId}/${secret}`,
      JSON.stringify(guesses),
    );

    let code: GuessResult["code"] = "cold";
    if (percentile === 1000) {
      code = "found";
    } else if (percentile !== undefined) {
      code = "warm";
    }

    return {
      code,
      guess,
      guesses,
    };
  }
}
