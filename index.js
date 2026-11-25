const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Render Environment Variables
const TOKEN = process.env.BOT_TOKEN;
const LIKE_API_URL = process.env.API_URL || ''; // වැඩ කරන Like API link එකක් හම්බවුණාම Render වල දාන්න
const INFO_API_URL = 'https://wzapi.vercel.app'; // WalkerZ Player Info API

if (!TOKEN) {
  console.error('ERROR: BOT_TOKEN is missing!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
bot.on('polling_error', (err) => console.log('Polling error:', err.code));

const userCooldown = new Map();
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', bot: 'FF Info & Like Bot', dev: 'Nadil Hansaja' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// /start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Player';

  const welcomeMsg = `🔥 *ආයුබෝවන් ${firstName}!* 🔥\n\n` +
                     `පහළ commands පාවිච්චි කරලා Free Fire විස්තර සහ Likes ගන්න පුළුවන්:\n\n` +
                     `👤 *Player Info බලන්න:*\n` +
                     `\`/info <region> <uid>\`\n` +
                     `_(උදා: \`/info sg 9085181522\`)_\n\n` +
                     `👍 *Likes යවන්න:*\n` +
                     `\`/like <region> <uid>\`\n` +
                     `_(උදා: \`/like sg 9085181522\`)_\n\n` +
                     `_Powered by NH TECH_`;

  bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
});

// 1. /info Command (WalkerZ API හරහා Player විස්තර ගැනීම)
bot.onText(/\/info (\w+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const region = match[1].toUpperCase();
  const uid = match[2];

  const waitMsg = await bot.sendMessage(chatId, `🔍 *UID:* \`${uid}\` (${region}) දත්ත පරීක්ෂා කරමින් පවතී...`, { parse_mode: 'Markdown' });

  try {
    const response = await axios.get(`${INFO_API_URL}/get?uid=${uid}&region=${region}`, { timeout: 20000 });
    const data = response.data;

    // API response structure එක අනුව දත්ත ලබාගැනීම
    const info = data.basicInfo || data.AccountInfo || data;

    if (info && (info.nickname || info.AccountName)) {
      const name = info.nickname || info.AccountName || 'Unknown';
      const level = info.level || info.AccountLevel || '-';
      const likes = info.liked || info.AccountLikes || '-';
      const exp = info.exp || info.AccountEXP || '-';
      const bio = (data.socialInfo && data.socialInfo.signature) || info.signature || 'No Bio';
      const guild = (data.clanBasicInfo && data.clanBasicInfo.clanName) || 'No Guild';

      const infoText = `🎮 *FREE FIRE PLAYER INFO* 🎮\n\n` +
                       `👤 *Name:* ${name}\n` +
                       `🆔 *UID:* \`${uid}\`\n` +
                       `🌍 *Region:* ${region}\n` +
                       `⭐ *Level:* ${level} (EXP: ${exp})\n` +
                       `👍 *Likes:* ${likes}\n` +
                       `🛡️ *Guild:* ${guild}\n` +
                       `📝 *Bio:* ${bio}\n\n` +
                       `_NH TECH FF Bot_`;

      bot.editMessageText(infoText, {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        parse_mode: 'Markdown'
      });
    } else {
      bot.editMessageText(`⚠️ *Player හමු නොවීය!* UID එක හෝ Region එක (${region}) නිවැරදිදැයි බලන්න.`, {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    bot.editMessageText(`❌ *Info API Error:* දත්ත ලබාගැනීමට නොහැකි වුණා. ටිකකින් නැවත උත්සාහ කරන්න.`, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
      parse_mode: 'Markdown'
    });
  }
});

// 2. /like Command (Like API සම්බන්ධ කළ පසු වැඩ කරයි)
bot.onText(/\/like (\w+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const region = match[1].toLowerCase();
  const uid = match[2];

  if (!LIKE_API_URL) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Like API තවම සම්බන්ධ කර නැත!*\nRender Environment Variables වල \`API_URL\` එකට Like API ලින්ක් එක ඇතුළත් කරන්න.`,
      { parse_mode: 'Markdown' }
    );
  }

  const now = Date.now();
  if (userCooldown.has(userId) && (now - userCooldown.get(userId)) < COOLDOWN_MS) {
    const hoursLeft = Math.ceil((COOLDOWN_MS - (now - userCooldown.get(userId))) / (1000 * 60 * 60));
    return bot.sendMessage(chatId, `⏳ *ඔයා අද දවසට Likes අරගෙන ඉවරයි!* තව පැය *${hoursLeft}* කින් try කරන්න.`, { parse_mode: 'Markdown' });
  }

  const waitMsg = await bot.sendMessage(chatId, `⏳ *UID:* \`${uid}\` (${region.toUpperCase()}) වෙත Likes යවමින් පවතී...`, { parse_mode: 'Markdown' });

  try {
    const response = await axios.get(`${LIKE_API_URL}?uid=${uid}&region=${region}`, { timeout: 25000 });
    const data = response.data;

    if (data && (data.status === 'success' || data.LikesGivenByAPI > 0)) {
      userCooldown.set(userId, now);
      const successMsg = `✅ *Likes සාර්ථකව යැව්වා!*\n\n` +
                         `👤 *Player:* ${data.PlayerNickname || 'Unknown'}\n` +
                         `🆔 *UID:* \`${uid}\`\n` +
                         `👍 *කලින් Likes:* ${data.LikesbeforeCommand || '-'}\n` +
                         `🚀 *අලුත් Likes:* ${data.LikesafterCommand || '-'}\n` +
                         `➕ *ලැබුණු Likes:* +${data.LikesGivenByAPI || '100'}`;

      bot.editMessageText(successMsg, { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' });
    } else {
      bot.editMessageText(`⚠️ *Likes යැවීමට නොහැකි වුණා.*\nහේතුව: ${data.message || 'දෛනික සීමාව අවසන්.'}`, {
        chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    bot.editMessageText(`❌ *Like API Error:* සර්වර් එක සම්බන්ධ වීමට නොහැකි වුණා.`, {
      chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown'
    });
  }
});
