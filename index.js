const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 🔑 Токен бота (замени на свой!)
const TOKEN = '6166550816:AAFB8xm3sRUlHzBzfvTtaVcptMITxacP1vI';
const bot = new TelegramBot(TOKEN, { polling: true });

const KNOWLEDGE_FILE = 'knowledge.json';

let samples = [];
let labels = [];
let responses = {};
let trainingMode = {}; // { chatId: { input: '', state: 'awaiting_response' } }

let botUsername = 'zikrullogpt_bot'; // сюда подгрузим имя бота из Telegram

// 🧠 Загрузка базы знаний
if (fs.existsSync(KNOWLEDGE_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
        if (data.samples && data.labels && data.responses) {
            samples = data.samples;
            labels = data.labels;
            responses = data.responses;
        }
    } catch (e) {
        console.error("❌ Ошибка загрузки базы знаний:", e.message);
    }
} else {
    samples = ['привет', 'как дела', 'пока'];
    labels = ['greeting', 'howareyou', 'goodbye'];
    responses = {
        greeting: 'Привет! 👋',
        howareyou: 'У меня всё отлично! А у тебя?',
        goodbye: 'Пока-пока!'
    };
}

// 🔍 Поиск самого похожего сообщения
function findMostSimilarSample(input, samples) {
    input = input.trim().toLowerCase();
    let bestMatch = null;
    let bestScore = -1;

    if (samples.includes(input)) return samples.indexOf(input);

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i].toLowerCase().trim();
        let score = 0;

        const inputWords = input.split(' ');
        const sampleWords = sample.split(' ');

        if (inputWords[0] === sampleWords[0]) score += 2;
        const commonWords = inputWords.filter(word => sampleWords.includes(word));
        score += commonWords.length;
        if (sample.includes(input) || input.includes(sample)) score += 1;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = i;
        }
    }

    return { index: bestMatch, score: bestScore };
}

// 📩 Обработка входящих сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const isGroup = msg.chat.type.includes('group');
    const input = msg.text?.trim();

    if (!input) return;

    // В группах обрабатываем только если бот упомянут
    if (isGroup) {
        if (!botUsername) {
            const me = await bot.getMe();
            botUsername = me.username;
        }

        if (!input.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) {
            return; // бот не был упомянут
        }
    }

    const cleanedInput = input.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim().toLowerCase();

    // 🎓 Режим обучения
    if (trainingMode[chatId] && trainingMode[chatId].state === 'awaiting_response') {
        const originalInput = trainingMode[chatId].input;
        const newLabel = `custom_${Object.keys(responses).length}`;
        responses[newLabel] = cleanedInput;
        samples.push(originalInput);
        labels.push(newLabel);
        trainingMode[chatId] = null;

        // 💾 Сохраняем
        fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify({ samples, labels, responses }, null, 2));
        bot.sendMessage(chatId, '🤖 Зикиҷон: Рахмат брат, ёдамба мондам!');
        return;
    }

    // 🔍 Поиск
    const match = findMostSimilarSample(cleanedInput, samples);

    if (typeof match === 'number') {
        const label = labels[match];
        bot.sendMessage(chatId, responses[label] || '🤖 ...');
        return;
    }

    if (match && match.score >= 2) {
        const label = labels[match.index];
        bot.sendMessage(chatId, responses[label] || '🤖 ...');
        return;
    }

    // ❓ Не понял — просим обучить
    bot.sendMessage(chatId, '🤖 Зикиҷон: Ман чизе гум акун из гапатба?\nНавис чавобат.');
    trainingMode[chatId] = {
        input: cleanedInput,
        state: 'awaiting_response'
    };
});
