const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN = process.env.BOT_TOKEN;
const INFO_API_URL = 'https://walkerz.onrender.com'; // ඔයාගේ WalkerZ API එක
const LIKE_API_URL = process.env.API_URL || '';

if (!TOKEN) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
bot.on('polling_error', (err) => console.log('Polling error:', err.code));

app.get('/', (req, res) => {
  res.status(200).send('CHUTTA FF BOT IS ONLINE!');
});

app.listen(PORT, () => console.log(`Port ${PORT}`));

// /start Command
bot.onText(/\/start/, (msg) => {
  const text = `🔥 *CHUTTA FF BOT* 🔥\n\n` +
               `👤 *Player Info බලන්න:*\n` +
               `\`/info sg 9085181522\`\n\n` +
               `👍 *Likes යවන්න:*\n` +
               `\`/like sg 9085181522\``;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// /info Command
bot.onText(/\/info (\w+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const region = match[1].toUpperCase();
  const uid = match[2];

  const wait = await bot.sendMessage(chatId, `🔍 \`${uid}\` (${region}) විස්තර සොයමින්...`, { parse_mode: 'Markdown' });

  try {
    const res = await axios.get(`${INFO_API_URL}/get?uid=${uid}&region=${region}`, { timeout: 30000 });
    const data = res.data;
    const info = data.basicInfo || data.AccountInfo || data;

    if (info && (info.nickname || info.AccountName)) {
      const reply = `🎮 *PLAYER PROFILE* 🎮\n\n` +
                    `👤 *Name:* ${info.nickname || info.AccountName}\n` +
                    `🆔 *UID:* \`${uid}\`\n` +
                    `🌍 *Region:* ${region}\n` +
                    `⭐ *Level:* ${info.level || info.AccountLevel || '-'}\n` +
                    `👍 *Likes:* ${info.liked || info.AccountLikes || '-'}\n` +
                    `🛡️ *Guild:* ${(data.clanBasicInfo && data.clanBasicInfo.clanName) || 'No Guild'}`;

      bot.editMessageText(reply, { chat_id: chatId, message_id: wait.message_id, parse_mode: 'Markdown' });
    } else {
      bot.editMessageText(`⚠️ Player හමු නොවීය! UID/Region පරීක්ෂා කරන්න.`, { chat_id: chatId, message_id: wait.message_id });
    }
  } catch (err) {
    bot.editMessageText(`❌ API සර්වර් එක අවදි වෙමින් පවතී. තත්පර 20කින් ආයෙත් \`/info\` ගහන්න.`, {
      chat_id: chatId, message_id: wait.message_id, parse_mode: 'Markdown'
    });
  }
});

// /like Command
bot.onText(/\/like (\w+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const region = match[1].toLowerCase();
  const uid = match[2];

  if (!LIKE_API_URL) {
    return bot.sendMessage(chatId, `⚠️ Render Environment වල \`API_URL\` එකට Like API ලින්ක් එකක් දාන්න.`, { parse_mode: 'Markdown' });
  }

  const wait = await bot.sendMessage(chatId, `⏳ \`${uid}\` වෙත Likes යවමින්...`, { parse_mode: 'Markdown' });

  try {
    const res = await axios.get(`${LIKE_API_URL}?uid=${uid}&region=${region}`, { timeout: 25000 });
    const d = res.data;
    if (d && (d.status === 'success' || d.LikesGivenByAPI > 0)) {
      bot.editMessageText(`✅ *Likes යැව්වා!* (+${d.LikesGivenByAPI || 100})`, {
        chat_id: chatId, message_id: wait.message_id, parse_mode: 'Markdown'
      });
    } else {
      bot.editMessageText(`⚠️ Likes යැවීමට නොහැකි වුණා.`, { chat_id: chatId, message_id: wait.message_id });
    }
  } catch (err) {
    bot.editMessageText(`❌ Like API Error!`, { chat_id: chatId, message_id: wait.message_id });
  }
});
