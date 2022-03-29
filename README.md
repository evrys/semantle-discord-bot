# Semantle Discord Bot

A Discord bot for playing [Semantle](https://semantle.novalis.org/) together with friends. To add it to your server, [click here](https://discord.com/api/oauth2/authorize?client_id=955033743347814430&permissions=2048&scope=applications.commands%20bot).

Semantle is a semantic word game made by [David Turner](https://novalis.org/), where you try to find a secret word by guessing words that are progressively closer in meaning. I got the idea for playing it on Discord from [Trif's Wordle bot](https://github.com/Trif4/Sakuya).

This bot runs on Cloudflare Workers and simply responds to incoming slash commands, so it should be reasonably stable/scalable. No promises though! It calls through to David's server to get the word similarity data (with some caching), so if the original semantle site goes down the bot will also stop working.

The word list is the same as the Semantle website, but shuffled (so it gets a different word to the official one each day).

## Usage

### Slash Commands

#### `/guess`

Guess a word in today's semantle game

| Option  | Description        |
| ------- | ------------------ |
| `word`  | The word to guess  |

#### `/stat`

Show the status of the game and the top 15 guesses so far

#### `/igiveup`

Type `/igiveup confirm` if you can't get it and want to know the answer

| Option    | Description                                     |
| --------- | ----------------------------------------------- |
| `confirm` | Confirm that you wanna be spoiled on the answer |
