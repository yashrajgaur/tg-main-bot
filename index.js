require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const express = require('express');

// ==========================================
// DUMMY WEB SERVER FOR RENDER
// ==========================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 1x Helper Bot is alive and running!');
});

app.listen(port, () => {
    console.log(`✅ Dummy web server is listening on port ${port}`);
});

// ==========================================
// MONGODB SCHEMAS & MODELS
// ==========================================
const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    firstName: String,
    username: String,
    isVerified: { type: Boolean, default: false },
    language: { type: String, default: 'en' }, // 'en' for English, 'hi' for Hindi
    joinedAt: { type: Date, default: Date.now },
    referredBy: { type: Number, default: null }, 
    referralsCount: { type: Number, default: 0 } 
});
const User = mongoose.model('User', userSchema);

// ==========================================
// TELEGRAM BOT SETUP
// ==========================================
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { 
    polling: false, // We will start polling manually after DB connects
    request: {
        agentOptions: {
            family: 4 
        }
    }
});

let botUsername = 'your_bot_username'; 

bot.getMe().then((botInfo) => {
    botUsername = botInfo.username;
});

bot.on('polling_error', (error) => {
    console.error('🚨 POLLING ERROR:', error.message);
});

// Constants
const PROMO_CODE = 'YOURWIN26';
const REG_LINK = 'https://cutt.ly/DtC6xYFe';
const VIDEO_PLACEHOLDER = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; 
const REQUIRED_CHANNEL = '@RegistrationAssistance1x';

// Dynamic Main Menu Keyboard based on language
function getMainMenu(lang) {
    if (lang === 'hi') {
        return {
            reply_markup: {
                keyboard: [
                    ['🎁 वेलकम बोनस', '📝 रजिस्टर कैसे करें'],
                    ['💳 डिपॉजिट कैसे करें', '🏷 प्रोमो कोड एक्टिवेट करें'],
                    ['🌐 भाषा (Language)', '📞 सहायता (Support)']
                ],
                resize_keyboard: true,
                is_persistent: true
            }
        };
    }
    return {
        reply_markup: {
            keyboard: [
                ['🎁 Welcome Bonus', '📝 How to Register'],
                ['💳 How to Deposit', '🏷 Activate Promo Code'],
                ['🌐 Language', '📞 Support']
            ],
            resize_keyboard: true,
            is_persistent: true
        }
    };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
async function isSubscribed(userId) {
    try {
        const chatMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        return ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);
    } catch (error) {
        return false; 
    }
}

async function getOrCreateUser(msg, refId = null) {
    let user = await User.findOne({ telegramId: msg.from.id });
    
    if (!user) {
        const finalRefId = (refId && refId !== msg.from.id) ? refId : null;

        user = new User({
            telegramId: msg.from.id,
            firstName: msg.from.first_name,
            username: msg.from.username || 'No Username',
            referredBy: finalRefId
        });
        await user.save();

        if (finalRefId) {
            try {
                await User.findOneAndUpdate(
                    { telegramId: finalRefId },
                    { $inc: { referralsCount: 1 } }
                );
                
                bot.sendMessage(finalRefId, `🎉 *New Referral!* [${msg.from.first_name}](tg://user?id=${msg.from.id}) just joined the bot using your link!`, { parse_mode: 'Markdown' });
            } catch (err) {
                console.error("Error updating inviter:", err);
            }
        }
    }
    return user;
}

async function askForSubscription(chatId, lang) {
    const promptText = lang === 'hi'
        ? `🛑 *रुकिए! आपको पहले हमारा चैनल जॉइन करना होगा।*\n\nइस बॉट का उपयोग करने और बेहतरीन प्रोमो कोड्स पाने के लिए हमारे आधिकारिक चैनल से जुड़ें:\n👉 ${REQUIRED_CHANNEL}\n\nजॉइन करने के बाद, वेरीफाई करने के लिए नीचे दिए गए बटन पर क्लिक करें!`
        : `🛑 *Wait! You need to join our channel first.*\n\nTo use this bot and get the best promo codes, you must join our official channel:\n👉 ${REQUIRED_CHANNEL}\n\nOnce you have joined, click the button below to verify!`;
        
    const promptOptions = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: lang === 'hi' ? '📢 चैनल जॉइन करें' : '📢 Join Channel', url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}` }],
                [{ text: lang === 'hi' ? '✅ मैंने जॉइन कर लिया है' : '✅ I have joined', callback_data: 'check_sub' }]
            ]
        }
    };
    await bot.sendMessage(chatId, promptText, promptOptions);
}

async function sendWelcome(chatId, lang) {
    const welcomeText = lang === 'hi'
        ? `👋 *1x Helper Bot में आपका स्वागत है!*\n\nमैं यहाँ आपको रजिस्ट्रेशन, डिपॉजिट और लेटेस्ट प्रोमो कोड्स के बारे में गाइड करने के लिए हूँ।\n\n🎁 *एक्सक्लूसिव वेलकम बोनस*\nरजिस्ट्रेशन के दौरान प्रोमो कोड: \`${PROMO_CODE}\` का उपयोग करें और अपना अधिकतम वेलकम बोनस प्राप्त करें!\n\n🔗 *रजिस्ट्रेशन लिंक:* [यहाँ क्लिक करें](${REG_LINK})`
        : `👋 *Welcome to 1x Helper Bot!*\n\nI am here to guide you through registration, help you with deposits, and provide the latest bonus offers and promo codes.\n\n🎁 *Exclusive Welcome Bonus*\nUse promo code: \`${PROMO_CODE}\` during registration to claim your maximum welcome bonus!\n\n🔗 *Registration Link:* [Click Here to Register](${REG_LINK})`;

    const inlineOptions = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: lang === 'hi' ? '🚀 अभी रजिस्टर करें' : '🚀 Register Now', url: REG_LINK }],
                [{ text: lang === 'hi' ? '📺 ट्यूटोरियल वीडियो देखें' : '📺 Watch Tutorial Video', url: VIDEO_PLACEHOLDER }]
            ]
        }
    };

    await bot.sendMessage(chatId, welcomeText, inlineOptions);
    const menuMsg = lang === 'hi' ? 'कृपया जारी रखने के लिए नीचे दिए गए मेनू से एक विकल्प चुनें:' : 'Please choose an option from the menu below to continue:';
    await bot.sendMessage(chatId, menuMsg, getMainMenu(lang));
}

// ==========================================
// 1. WELCOME MESSAGE & REFERRAL TRACKING
// ==========================================
bot.onText(/^\/start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const refId = match[1] ? parseInt(match[1]) : null;
    
    try {
        let user = await getOrCreateUser(msg, refId);
        const lang = user.language || 'en';

        if (!user.isVerified) {
            const subbed = await isSubscribed(user.telegramId);
            if (subbed) {
                user.isVerified = true;
                await user.save();
            } else {
                return await askForSubscription(chatId, lang);
            }
        }

        await sendWelcome(chatId, lang);

    } catch (err) {
        console.error("❌ Error in /start command:", err);
        bot.sendMessage(chatId, "⚠️ Server error while connecting to the database. Please try again in a moment.");
    }
});

// ==========================================
// CALLBACK QUERY (Verify Button & Language)
// ==========================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;

    try {
        let user = await User.findOne({ telegramId: userId });
        const lang = user ? user.language : 'en';

        if (query.data === 'check_sub') {
            const subbed = await isSubscribed(userId);
            if (subbed) {
                user = await User.findOneAndUpdate({ telegramId: userId }, { isVerified: true }, { new: true });
                await bot.deleteMessage(chatId, query.message.message_id);
                
                const successMsg = lang === 'hi' ? '✅ *जुड़ने के लिए धन्यवाद!* एक्सेस मिल गया है।' : '✅ *Thank you for joining!* Access granted.';
                await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });

                await sendWelcome(chatId, lang);
            } else {
                bot.answerCallbackQuery(query.id, {
                    text: lang === 'hi' ? "❌ आपने अभी तक चैनल जॉइन नहीं किया है! कृपया जारी रखने के लिए जॉइन करें।" : "❌ You haven't joined the channel yet! Please join to continue.",
                    show_alert: true
                });
            }
        }

        if (query.data.startsWith('set_lang_')) {
            const newLang = query.data.replace('set_lang_', ''); 
            user = await User.findOneAndUpdate({ telegramId: userId }, { language: newLang }, { new: true });
            
            bot.deleteMessage(chatId, query.message.message_id).catch(() => {}); 
            
            const confirmMsg = newLang === 'hi' ? '✅ भाषा बदलकर हिन्दी कर दी गई है।' : '✅ Language changed to English.';
            bot.sendMessage(chatId, confirmMsg, getMainMenu(newLang));
        }

    } catch (err) {
        console.error("❌ Error in callback query:", err);
    }
});

// ==========================================
// HANDLE MAIN MENU BUTTONS (BILINGUAL)
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    try {
        let user = await getOrCreateUser(msg);
        const lang = user.language || 'en';
        
        if (!user.isVerified) {
            const subbed = await isSubscribed(user.telegramId);
            if (subbed) {
                user.isVerified = true;
                await user.save();
            } else {
                return await askForSubscription(chatId, lang);
            }
        }

        switch (text) {
            case '🌐 Language':
            case '🌐 भाषा (Language)':
                const langPrompt = lang === 'hi' ? 'अपनी पसंदीदा भाषा चुनें:' : 'Choose your preferred language:';
                const langKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🇬🇧 English', callback_data: 'set_lang_en' }],
                            [{ text: '🇮🇳 हिन्दी (Hindi)', callback_data: 'set_lang_hi' }]
                        ]
                    }
                };
                bot.sendMessage(chatId, langPrompt, langKeyboard);
                break;

            case '📝 How to Register':
            case '📝 रजिस्टर कैसे करें':
                const regText = lang === 'hi'
                    ? `📝 *रजिस्टर कैसे करें (स्टेप-बाय-स्टेप)*\n\n1️⃣ [रजिस्ट्रेशन पेज](${REG_LINK}) खोलें\n2️⃣ अपना पसंदीदा तरीका चुनें (Email/Phone)\n3️⃣ प्रोमो कोड दर्ज करें: \`${PROMO_CODE}\` (बोनस के लिए बहुत जरूरी!)\n4️⃣ वेरिफिकेशन पूरा करें\n5️⃣ बोनस एक्टिवेट करने के लिए पहला डिपॉजिट करें।\n\n*विजुअल गाइड के लिए नीचे दिए गए वीडियो और स्क्रीनशॉट देखें!* 👇`
                    : `📝 *How to Register (Step-by-Step)*\n\n1️⃣ Open the [Registration Page](${REG_LINK})\n2️⃣ Choose your preferred method (Email/Phone)\n3️⃣ Enter the promo code: \`${PROMO_CODE}\` to ensure you get your bonus!\n4️⃣ Complete verification\n5️⃣ Make your first deposit to activate the bonus.\n\n*Review the video tutorial and screenshot cards below for a visual guide!* 👇`;

                await bot.sendMessage(chatId, regText, { parse_mode: 'Markdown' });
                
                try {
                    const videoPath = path.join(__dirname, 'register-video.mp4'); 
                    await bot.sendVideo(chatId, videoPath, {
                        caption: lang === 'hi' ? '📺 *वीडियो ट्यूटोरियल: रजिस्टर कैसे करें*' : '📺 *Video Tutorial: How to Register Step-by-Step*',
                        parse_mode: 'Markdown'
                    });
                } catch (videoErr) {
                    console.error("❌ Error sending registration video:", videoErr.message);
                    await bot.sendMessage(chatId, `📺 *Prefer a video tutorial?* Watch it here: ${VIDEO_PLACEHOLDER}`, { parse_mode: 'Markdown' });
                }

                const regMediaGroup = [
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+1:+Click+Register', caption: lang === 'hi' ? 'स्टेप 1: लिंक खोलें और Register पर क्लिक करें' : 'Step 1: Open the link and click Register' },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+2:+Enter+Details', caption: lang === 'hi' ? 'स्टेप 2: अपना विवरण (Details) भरें' : 'Step 2: Fill in your details' },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+3:+Enter+YOURWIN26', caption: lang === 'hi' ? `स्टेप 3: सबसे जरूरी! प्रोमो कोड ${PROMO_CODE} डालें` : `Step 3: Crucial! Enter promo code ${PROMO_CODE}` }
                ];
                await bot.sendMediaGroup(chatId, regMediaGroup);
                break;

            case '💳 How to Deposit':
            case '💳 डिपॉजिट कैसे करें':
                const depText = lang === 'hi'
                    ? `💳 *डिपॉजिट कैसे करें*\n\nहम कई सुरक्षित पेमेंट तरीके सपोर्ट करते हैं:\n✅ UPI\n✅ Paytm\n✅ Crypto\n✅ Net Banking\n✅ Bank Cards\n\n💡 *याद रखें!* अगर आपने रजिस्ट्रेशन के समय \`${PROMO_CODE}\` इस्तेमाल किया है, तो आपके पहले डिपॉजिट पर बड़ा वेलकम बोनस मिलेगा!\n\n*अकाउंट में पैसे डालने के लिए नीचे दिए गए स्टेप्स फॉलो करें:* 👇`
                    : `💳 *How to Make a Deposit*\n\nWe support multiple fast and secure payment methods:\n✅ UPI\n✅ Paytm\n✅ Crypto\n✅ Net Banking\n✅ Bank Cards\n\n💡 *Don't Forget!* If you used promo code \`${PROMO_CODE}\` during registration, your first deposit will be heavily matched with a welcome bonus!\n\n*Follow the screenshot cards below to fund your account:* 👇`;

                await bot.sendMessage(chatId, depText, { parse_mode: 'Markdown' });
                const depMediaGroup = [
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+1:+Go+to+Deposit', caption: lang === 'hi' ? 'स्टेप 1: Deposit बटन पर क्लिक करें' : 'Step 1: Click on the Deposit button' },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+2:+Choose+Method', caption: lang === 'hi' ? 'स्टेप 2: अपना पेमेंट तरीका चुनें (जैसे UPI)' : 'Step 2: Select your preferred payment method (e.g., UPI)' },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Step+3:+Enter+Amount', caption: lang === 'hi' ? 'स्टेप 3: अमाउंट डालें और कन्फर्म करें' : 'Step 3: Enter the amount and confirm' }
                ];
                await bot.sendMediaGroup(chatId, depMediaGroup);
                await bot.sendMessage(chatId, `📺 *Deposit Video Guide:* ${VIDEO_PLACEHOLDER}`, { parse_mode: 'Markdown' });
                break;

            case '🏷 Activate Promo Code':
            case '🏷 प्रोमो कोड एक्टिवेट करें':
                const promoText = lang === 'hi'
                    ? `🏷 *अपना प्रोमो कोड कैसे एक्टिवेट करें*\n\nप्रोमो कोड डालना आसान लेकिन बहुत महत्वपूर्ण है। आप रजिस्ट्रेशन के दौरान 'Sports Bonus' या 'Casino Bonus' चुन सकते हैं।\n\n1️⃣ सुनिश्चित करें कि आप रजिस्ट्रेशन पेज पर हैं।\n2️⃣ "Promo Code" का बॉक्स खोजें।\n3️⃣ बिल्कुल ऐसा टाइप करें: \`${PROMO_CODE}\`\n4️⃣ रजिस्टर करने से पहले अपना बोनस टाइप चुनें।\n\n*यह बिल्कुल ऐसा दिखता है:* 👇`
                    : `🏷 *How to Activate Your Promo Code*\n\nEntering your promo code is simple but very important. You can choose between a *Sports Bonus* or a *Casino Bonus* when registering.\n\n1️⃣ Make sure you are on the registration page.\n2️⃣ Look for the "Promo Code" field.\n3️⃣ Type exactly: \`${PROMO_CODE}\`\n4️⃣ Select your preferred bonus type (Sports or Casino) from the dropdown/sidebar.\n\n*Here is exactly what it looks like:* 👇`;

                await bot.sendMessage(chatId, promoText, { parse_mode: 'Markdown' });
                const promoMediaGroup = [
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Locate+Promo+Field', caption: lang === 'hi' ? 'कार्ड 1: फॉर्म पर प्रोमो कोड बॉक्स खोजें।' : 'Card 1: Locate the Promo Code input field on the form.' },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Type+YOURWIN26', caption: lang === 'hi' ? `कार्ड 2: बॉक्स में ठीक ${PROMO_CODE} टाइप करें।` : `Card 2: Type in ${PROMO_CODE} exactly as shown.` },
                    { type: 'photo', media: 'https://via.placeholder.com/600x400.png?text=Select+Bonus+Type', caption: lang === 'hi' ? 'कार्ड 3: रजिस्टर करने से पहले कसीनो या स्पोर्ट्स बोनस चुनें।' : 'Card 3: Switch between Casino or Sports bonus before clicking register.' }
                ];
                await bot.sendMediaGroup(chatId, promoMediaGroup);
                break;

            case '🎁 Welcome Bonus':
            case '🎁 वेलकम बोनस':
                bot.sendMessage(chatId, lang === 'hi' 
                    ? `⏳ *वेलकम बोनस ब्लॉक अभी अपडेट किया जा रहा है।*\n\nरजिस्टर करते समय \`${PROMO_CODE}\` का उपयोग करना न भूलें!` 
                    : `⏳ *Welcome Bonus block is currently being updated.*\n\nRemember to use \`${PROMO_CODE}\` when registering!`, { parse_mode: 'Markdown' });
                break;

            case '📞 Support':
            case '📞 सहायता (Support)':
                const supportText = lang === 'hi'
                    ? `📞 *सहायता (Support)*\n\nकिसी भी प्रश्न के लिए, कृपया हमसे संपर्क करें:\n📧 *सामान्य पूछताछ:* info-ind@1xbet-team.com\n🌍 *विश्वव्यापी समर्थन:* +44 127 325-69-87\n💬 *टेलीग्राम:* 1xBet Official Support\n\n🛠 *सपोर्ट टिकट कैसे खोलें (How to open a ticket):*\n1️⃣ 1xBet ऐप या वेबसाइट खोलें।\n2️⃣ मेनू (Menu) में जाएं और 'कस्टमर सपोर्ट' (Customer Support) चुनें।\n3️⃣ तुरंत सहायता के लिए 'चैट' (Chat) चुनें, या ऑपरेटर से बात करने के लिए 'कॉल बैक' (Callback) का अनुरोध करें।\n4️⃣ अपनी समस्या का स्पष्ट विवरण और अपना **अकाउंट आईडी (Account ID)** प्रदान करें।`
                    : `📞 *Support*\n\nFor any questions, please contact us:\n📧 *General inquiries:* info-ind@1xbet-team.com\n🌍 *Worldwide support:* +44 127 325-69-87\n💬 *Telegram:* 1xBet Official Support\n\n🛠 *How to open a support ticket:*\n1️⃣ Open the 1xBet app or website.\n2️⃣ Go to the Menu and select 'Customer Support'.\n3️⃣ Choose 'Chat' for instant help, or request a 'Callback' to speak with an operator.\n4️⃣ Provide a clear description of your issue along with your **Account ID**.\n`;

                bot.sendMessage(chatId, supportText, { parse_mode: 'Markdown' });
                break;

            default:
                bot.sendMessage(chatId, lang === 'hi' ? 'कृपया नेविगेट करने के लिए नीचे दिए गए मेनू का उपयोग करें।' : 'Please use the menu below to navigate.', getMainMenu(lang));
                break;
        }
    } catch (err) {
        console.error("❌ Error in message handler:", err);
    }
});

// ==========================================
// STARTUP LOGIC
// ==========================================
async function startApp() {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully!');

        bot.startPolling();
        console.log('🤖 1x Helper Bot is starting up and ready!');
        
    } catch (err) {
        console.error('❌ FATAL: MongoDB connection error:', err.message);
        console.log('Ensure your current IP address is whitelisted in MongoDB Atlas Network Access!');
        process.exit(1); 
    }
}

startApp();

process.once('SIGINT', () => {
    bot.stopPolling();
    console.log('🛑 Bot polling stopped gracefully.');
    process.exit(0);
});

process.once('SIGTERM', () => {
    bot.stopPolling();
    console.log('🛑 Bot polling stopped gracefully.');
    process.exit(0);
});
