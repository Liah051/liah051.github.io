---
author: Dialiah
pubDatetime: 2026-03-03T01:00:00Z
title: Discord Botの作り方 (discord.js)
featured: true
draft: false
tags:
  - Tech
  - Discord
  - JavaScript
description: "discord.js を用いて簡単な Ping-Pong Bot を作成し、シンタックスハイライトが適切に機能するかを確認します。"
category_id: "other"
---

## はじめに

JavaScript (Node.js) を使って、Discord Botを作成する基本的なコードです。
Shikiによる強力なシンタックスハイライトが行われていることを確認できます。

### ping-pong.js

```javascript
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", message => {
  // Bot自身のメッセージには反応しない
  if (message.author.bot) return;

  if (message.content === "!ping") {
    message.reply("Pong!");
  }
});

client.login("YOUR_BOT_TOKEN_HERE");
```

このように、変数や関数名、文字列が綺麗に色分けされて表示されます。
