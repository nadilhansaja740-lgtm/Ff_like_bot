const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Render Environment Variables වලින් Token සහ API URL ලබාගැනීම
const TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || 'https://free-ff-like-api.onrender.com/like';

if (!TOKEN) {
  console.error('ERROR: BOT_TOKEN environment variable is missing!');
  process.exit(1);
}

// Bot instance එක සෑදීම
const bot = new TelegramBot(TOKEN, { polling: true });

// Polling errors හැසිරවීම (Render deploy වෙද්දී crash වීම වැළැක්වීමට)
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.code);
});

// දවසකට එක user කෙනෙක්ට 1 පාරක් විතරක් like ගන්න Cooldown Limit එක
const userCooldown = new Map();
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // පැය 24

// Keep-Alive Web Server (Better Stack / UptimeRobot සඳහා)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    bot: 'FF Auto-Like Telegram Bot',
    developer: 'Nadil Hansaja (NH TECH)'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// /start Command එක
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Player';

  const welcomeMsg = `🔥 *ආයුබෝවන් ${firstName}!* 🔥\n\n` +
                     `Free Fire ID එකට නොමිලේ Likes ගන්න පහළ විදියට command එක යවන්න:\n\n` +
                     `👉 \`/like <region> <uid>\`\n\n` +
                     `*උදාහරණයක්:*\n` +
                     `\`/like sg 9085181522\`\n\n` +
                     `🌍 *Regions:* \`sg\`, \`ind\`, \`bd\`, \`br\`, \`id\`\n\n` +
                     `_Powered by NH TECH_`;

  bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
});

// /like Command එක (උදා: /like sg 9085181522)
bot.onText(/\/like (\w+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const region = match[1].toLowerCase();
  const uid = match[2];

  // පැය 24ක Cooldown පරීක්ෂාව
  const now = Date.now();
  if (userCooldown.has(userId)) {
    const lastUsed = userCooldown.get(userId);
    const timePassed = now - lastUsed;
    if (timePassed < COOLDOWN_MS) {
      const hoursLeft = Math.ceil((COOLDOWN_MS - timePassed) / (1000 * 60 * 60));
      return bot.sendMessage(
        chatId,
        `⏳ *ඔයා අද දවසට Likes අරගෙන ඉවරයි!*\nතව පැය *${hoursLeft}* කින් ආයෙත් try කරන්න.`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  const waitMsg = await bot.sendMessage(
    chatId,
    `⏳ *UID:* \`${uid}\` (${region.toUpperCase()}) වෙත Likes යවමින් පවතී... කරුණාකර රැඳී සිටින්න.`,
    { parse_mode: 'Markdown' }
  );

  try {
    const response = await axios.get(`${API_URL}?uid=${uid}&region=${region}`, {
      timeout: 25000
    });
    const data = response.data;

    if (data && (data.status === 'success' || data.LikesGivenByAPI > 0)) {
      userCooldown.set(userId, now);

      const successMsg = `✅ *Likes සාර්ථකව යැව්වා!*\n\n` +
                         `👤 *Player:* ${data.PlayerNickname || 'Unknown'}\n` +
                         `🆔 *UID:* \`${uid}\`\n` +
                         `🌍 *Region:* ${region.toUpperCase()}\n` +
                         `👍 *කලින් Likes:* ${data.LikesbeforeCommand || '-'}\n` +
                         `🚀 *අලුත් Likes:* ${data.LikesafterCommand || '-'}\n` +
                         `➕ *ලැබුණු Likes:* +${data.LikesGivenByAPI || '100'}\n\n` +
                         `_Developer: Nadil Hansaja_`;

      bot.editMessageText(successMsg, {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        parse_mode: 'Markdown'
      });
    } else {
      bot.editMessageText(
        `⚠️ *Likes යැවීමට නොහැකි වුණා.*\nහේතුව: ${data.message || 'මෙම UID එකට අද දවසේ සීමාව අවසන් හෝ API දෝෂයකි.'}`,
        {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
    }
  } catch (error) {
    console.error('API Request Error:', error.message);
    bot.editMessageText(
      `❌ *API Error:* සර්වර් එක දැනට කාර්යබහුලයි හෝ සම්බන්ධ වීමට නොහැකි වුණා. ටික වේලාවකින් නැවත උත්සාහ කරන්න.`,
      {
        chat_id: chatId,
        message_id: waitMsg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }
});
