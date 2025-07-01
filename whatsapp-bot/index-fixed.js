// Import library yang kita butuhkan
import Baileys, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Client, Functions } from 'node-appwrite';
import fs from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';
import axios from 'axios';
import pino from 'pino';
import express from 'express';
import { Boom } from '@hapi/boom';
import { makeInMemoryStore } from '@rodrigogs/baileys-store';
import Redis from 'ioredis';

// Load environment variables
dotenv.config();

// ====================================================================
// Simple Redis-based authentication state with improved error handling
// ====================================================================

let redisClient = null;

async function initRedis() {
    if (!process.env.REDIS_URL) {
        console.log('📁 REDIS_URL not set');
        return null;
    }
    
    try {
        console.log('🔗 Connecting to Redis...');
        
        const redis = new Redis(process.env.REDIS_URL, {
            connectTimeout: 3000,
            lazyConnect: true,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 1,
            family: 4,
            keepAlive: true,
            enableOfflineQueue: false,
            maxLoadingTimeout: 2000,
            reconnectOnError: () => false
        });
        
        // Quick connection test
        await Promise.race([
            redis.ping(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis timeout')), 3000)
            )
        ]);
        
        console.log('✅ Redis connected');
        return redis;
        
    } catch (error) {
        console.error('❌ Redis failed:', error.message);
        return null;
    }
}

async function makeRedisAuthState(sessionId = 'wa-session') {
    // Try to initialize Redis
    redisClient = await initRedis();
    
    if (redisClient) {
        try {
            // First, clear any existing corrupt credentials
            console.log('🧹 Clearing any existing Redis credentials...');
            await redisClient.del(`${sessionId}:creds`, `${sessionId}:keys`, `${sessionId}:me`);
            console.log('✅ Redis credentials cleared');
            
            // Check for existing session (should be empty now)
            const existingSession = await redisClient.get(`${sessionId}:me`);
            if (existingSession) {
                console.log('🎯 Found existing session in Redis after clear!');
            } else {
                console.log('📝 No existing session in Redis (as expected after clear)');
            }
            
            // Load from Redis (will be empty initially)
            const existingCreds = await loadFromRedis(`${sessionId}:creds`);
            const existingKeys = await loadFromRedis(`${sessionId}:keys`);
            
            // If no valid credentials in Redis, use file-based auth first
            if (!existingCreds || !existingCreds.me) {
                console.log('📁 No valid Redis session, falling back to file-based auth for initial setup');
                
                // Use file-based auth state first
                const fileAuthState = await useMultiFileAuthState('./auth_info');
                
                // Wrap the saveCreds to also save to Redis
                const originalSaveCreds = fileAuthState.saveCreds;
                fileAuthState.saveCreds = async (creds) => {
                    // Save to file first
                    await originalSaveCreds(creds);
                    
                    // Then sync to Redis
                    if (redisClient && creds) {
                        try {
                            await saveToRedis(`${sessionId}:creds`, creds);
                            if (creds.me) {
                                await redisClient.set(`${sessionId}:me`, JSON.stringify(creds.me));
                            }
                            console.log('💾 Session synced to Redis');
                        } catch (error) {
                            console.error('❌ Failed to sync to Redis:', error.message);
                        }
                    }
                };
                
                return fileAuthState;
            }
            
            // Return Redis-based auth state if valid credentials exist
            return {
                state: {
                    creds: existingCreds,
                    keys: existingKeys || {}
                },
                saveCreds: async (creds) => {
                    if (redisClient && creds) {
                        try {
                            await saveToRedis(`${sessionId}:creds`, creds);
                            if (creds.me) {
                                await redisClient.set(`${sessionId}:me`, JSON.stringify(creds.me));
                            }
                            console.log('💾 Session saved to Redis');
                        } catch (error) {
                            console.error('❌ Failed to save to Redis:', error.message);
                        }
                    }
                }
            };
            
        } catch (error) {
            console.error('❌ Redis auth setup failed:', error.message);
        }
    }
    
    // Fallback to file-based storage
    console.log('📁 Using file-based auth...');
    const sessionDir = './auth_info';
    await fs.ensureDir(sessionDir);
    return await useMultiFileAuthState(sessionDir);
}

async function loadFromRedis(key) {
    if (!redisClient) return null;
    
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error loading ${key}:`, error.message);
        return null;
    }
}

async function saveToRedis(key, data) {
    if (!redisClient || !data) return;
    
    try {
        await redisClient.set(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving ${key}:`, error.message);
    }
}

// Configuration
const CONFIG = {
    APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID || 'YOUR_PROJECT_ID',
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY || 'YOUR_API_KEY',
    APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    PDF_MERGER_FUNCTION_ID: process.env.PDF_MERGER_FUNCTION_ID || '68617ea70030b8ef6bbe',
    WHATSAPP_BOT_FUNCTION_ID: process.env.WHATSAPP_BOT_FUNCTION_ID || 'whatsapp-pdf-bot',
    BOT_PREFIX: process.env.BOT_PREFIX || '.pdf',
    TEMP_DIR: './temp',
    PORT: process.env.PORT || 3000,
    MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB max file size
    SUPPORTED_MIMES: ['application/pdf']
};

// Ensure temp directory exists
await fs.ensureDir(CONFIG.TEMP_DIR);

// User session storage for tracking PDF merge processes
const userSessions = new Map();

class WhatsAppPDFBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.store = null;
        
        this.client = new Client();
        this.client
            .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
            .setProject(CONFIG.APPWRITE_PROJECT_ID)
            .setKey(CONFIG.APPWRITE_API_KEY);
            
        this.functions = new Functions(this.client);
    }

    async init() {
        try {
            console.log(`🔄 Initializing WhatsApp bot (attempt ${this.retryCount + 1}/${this.maxRetries + 1})...`);
            
            // Reset connection status
            this.isConnected = false;
            
            // Initialize store for message storage
            this.store = makeInMemoryStore({ logger: pino({ level: 'warn' }) });
            
            // Use Redis auth state with fallback
            const authState = await makeRedisAuthState();
            const { state, saveCreds } = authState;
            
            // Check if we have existing credentials
            const hasExistingCreds = state.creds && state.creds.me;
            if (hasExistingCreds) {
                console.log('🎯 Using existing credentials - no QR needed!');
                console.log(`📱 Session for: ${state.creds.me?.name || 'Unknown'}`);
            } else {
                console.log('📝 No existing credentials - QR authentication required');
            }

            const { version } = await Baileys.fetchLatestBaileysVersion();

            const logger = pino({ 
                level: 'warn',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: false,
                        ignore: 'time,pid,hostname'
                    }
                }
            });

            this.sock = Baileys.makeWASocket({
                version,
                auth: state,
                generateHighQualityLinkPreview: true,
                logger: logger,
                browser: ['Resi Merger Bot', 'Chrome', '1.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                markOnlineOnConnect: true
            });

            // Bind store to WhatsApp events
            this.store.bind(this.sock.ev);

            this.sock.ev.on('connection.update', this.handleConnection.bind(this));
            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessages.bind(this));
            
            // Reset retry count on successful initialization
            this.retryCount = 0;

        } catch (error) {
            console.error('Failed to initialize WhatsApp bot:', error);
            
            if (this.retryCount < this.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
                console.log(`🔄 Retrying initialization in ${delay/1000} seconds...`);
                this.retryCount++;
                
                setTimeout(() => {
                    this.init().catch(console.error);
                }, delay);
            } else {
                console.error('💀 Max retries reached. Exiting...');
                process.exit(1);
            }
        }
    }

    handleConnection(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Scan QR code to connect to WhatsApp:');
            console.log('='.repeat(50));
            
            QRCode.toString(qr, { type: 'terminal', small: true }, (err, qrString) => {
                if (err) {
                    console.log('❌ Error generating QR code');
                    console.log('QR Data:', qr);
                } else {
                    console.log(qrString);
                }
                
                console.log('='.repeat(50));
                console.log('📱 Instructions:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Tap on the three dots menu (⋮)');
                console.log('3. Select "Linked Devices"');
                console.log('4. Tap "Link a Device"');
                console.log('5. Scan the QR code above');
                console.log('='.repeat(50));
                console.log('⏳ Waiting for authentication...');
            });
        }

        if (connection === 'close') {
            let shouldReconnect = true;
            
            if (lastDisconnect?.error) {
                const statusCode = lastDisconnect.error instanceof Boom 
                    ? lastDisconnect.error.output?.statusCode 
                    : null;
                
                console.log(`Connection closed. Status code: ${statusCode}`);
                
                if (statusCode === Baileys.DisconnectReason.loggedOut) {
                    console.log('❌ Device logged out. Need fresh authentication.');
                    shouldReconnect = false;
                    this.clearAuthState();
                } else if (statusCode === Baileys.DisconnectReason.restartRequired) {
                    console.log('🔄 Restart required. Reconnecting...');
                } else if (statusCode === 515) {
                    console.log('❌ Invalid session (515). Clearing auth state...');
                    this.clearAuthState();
                    shouldReconnect = true;
                } else {
                    console.log(`🔄 Connection lost (${statusCode}). Reconnecting...`);
                }
            } else {
                console.log('🔄 Connection closed without error. Reconnecting...');
            }
            
            if (shouldReconnect) {
                const statusCode = lastDisconnect?.error instanceof Boom 
                    ? lastDisconnect?.error.output?.statusCode 
                    : null;
                const delay = statusCode === 515 ? 10000 : 5000;
                console.log(`⏳ Reconnecting in ${delay/1000} seconds...`);
                setTimeout(() => this.init(), delay);
            }
            this.isConnected = false;
        } else if (connection === 'open') {
            console.log('✅ WhatsApp bot connected successfully!');
            console.log('🤖 Bot is ready to receive messages!');
            console.log(`📋 Send "${CONFIG.BOT_PREFIX}" to any chat to start PDF merging`);
            this.isConnected = true;
        }
    }

    async clearAuthState() {
        try {
            console.log('🧹 Clearing authentication state...');
            
            // Clear file-based auth state
            const authDir = './auth_info';
            if (await fs.pathExists(authDir)) {
                await fs.remove(authDir);
                console.log('📁 File-based auth state cleared');
            }
            
            // Clear Redis auth state if available
            if (redisClient) {
                try {
                    // Clear all possible session keys
                    const keys = ['wa-session:creds', 'wa-session:keys', 'wa-session:me'];
                    await redisClient.del(...keys);
                    console.log('🔗 Redis auth state cleared');
                    
                    // Also try to clear any other potential session keys
                    const allKeys = await redisClient.keys('wa-session:*');
                    if (allKeys.length > 0) {
                        await redisClient.del(...allKeys);
                        console.log(`🔗 Additional Redis keys cleared: ${allKeys.join(', ')}`);
                    }
                } catch (error) {
                    console.error('❌ Error clearing Redis:', error.message);
                }
            }
            
            console.log('✅ All authentication state cleared successfully');
        } catch (error) {
            console.error('❌ Error clearing auth state:', error.message);
        }
    }

    async handleMessages(messageUpdate) {
        try {
            const message = messageUpdate.messages[0];
            if (!message || message.key.fromMe) return;

            const chatId = message.key.remoteJid;
            const messageType = Object.keys(message.message || {})[0];
            
            if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
                await this.handleTextMessage(chatId, text.trim(), message);
            }
            
            if (messageType === 'documentMessage') {
                await this.handleDocumentMessage(chatId, message);
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async handleTextMessage(chatId, text, message) {
        try {
            if (text.toLowerCase().startsWith(CONFIG.BOT_PREFIX)) {
                const command = text.toLowerCase().replace(CONFIG.BOT_PREFIX, '').trim();
                
                if (command === 'merge') {
                    const session = userSessions.get(chatId);
                    if (session && session.files.length > 0) {
                        session.status = 'waiting_for_confirmation';
                        await this.sendMessage(chatId, 
                            `🔄 Ready to merge ${session.files.length} PDF file${session.files.length > 1 ? 's' : ''}.\n\n` +
                            `Reply with "yes" to confirm or "no" to cancel.`
                        );
                    } else {
                        await this.sendMessage(chatId, 'No PDF files to merge. Send PDF files first.');
                    }
                } else if (command === 'cancel') {
                    await this.cancelSession(chatId);
                } else {
                    await this.startPDFMergeSession(chatId);
                }
                return;
            }

            const session = userSessions.get(chatId);
            if (session && session.status === 'waiting_for_confirmation') {
                if (text.toLowerCase() === 'yes' || text.toLowerCase() === 'y') {
                    await this.processPDFMerge(chatId);
                } else if (text.toLowerCase() === 'no' || text.toLowerCase() === 'n') {
                    await this.cancelSession(chatId);
                } else {
                    await this.sendMessage(chatId, 'Please reply with "yes" or "no" to confirm PDF merge.');
                }
                return;
            }

            if (text.toLowerCase() === 'help' || text.toLowerCase() === '/help') {
                await this.sendHelpMessage(chatId);
            }

        } catch (error) {
            console.error('Error handling text message:', error);
            await this.sendMessage(chatId, '❌ Sorry, an error occurred while processing your message.');
        }
    }

    async handleDocumentMessage(chatId, message) {
        try {
            const doc = message.message.documentMessage;
            
            if (!doc || !CONFIG.SUPPORTED_MIMES.includes(doc.mimetype)) {
                await this.sendMessage(chatId, 
                    '❌ Only PDF files are supported. Please send a PDF file.'
                );
                return;
            }

            if (doc.fileLength > CONFIG.MAX_FILE_SIZE) {
                await this.sendMessage(chatId, 
                    `❌ File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.`
                );
                return;
            }

            // Initialize session if not exists
            if (!userSessions.has(chatId)) {
                userSessions.set(chatId, {
                    files: [],
                    status: 'collecting',
                    startTime: Date.now()
                });
            }

            const session = userSessions.get(chatId);
            
            if (session.status !== 'collecting') {
                await this.sendMessage(chatId, 
                    '❌ Cannot add files now. Please start a new session with ' + CONFIG.BOT_PREFIX
                );
                return;
            }

            // Download and save file
            const fileName = doc.fileName || `document_${Date.now()}.pdf`;
            const filePath = path.join(CONFIG.TEMP_DIR, `${chatId}_${Date.now()}_${fileName}`);
            
            try {
                const buffer = await Baileys.downloadMediaMessage(message, 'buffer', {});
                await fs.writeFile(filePath, buffer);
                
                session.files.push({
                    name: fileName,
                    path: filePath,
                    size: doc.fileLength
                });

                await this.sendMessage(chatId, 
                    `✅ File "${fileName}" added successfully!\n` +
                    `📊 Total files: ${session.files.length}\n\n` +
                    `Send more PDF files or type "${CONFIG.BOT_PREFIX} merge" to merge them.`
                );

            } catch (error) {
                console.error('Error downloading file:', error);
                await this.sendMessage(chatId, '❌ Failed to download file. Please try again.');
            }

        } catch (error) {
            console.error('Error handling document:', error);
            await this.sendMessage(chatId, '❌ Error processing document. Please try again.');
        }
    }

    async startPDFMergeSession(chatId) {
        try {
            // Clear any existing session
            userSessions.set(chatId, {
                files: [],
                status: 'collecting',
                startTime: Date.now()
            });

            await this.sendMessage(chatId, 
                `🤖 *WhatsApp PDF Merger Bot*\n\n` +
                `Welcome! Send me PDF files that you want to merge together.\n\n` +
                `📋 *Instructions:*\n` +
                `1. Send PDF files (one by one or multiple)\n` +
                `2. Type "${CONFIG.BOT_PREFIX} merge" when ready\n` +
                `3. Confirm to merge and download\n\n` +
                `📝 *Commands:*\n` +
                `• ${CONFIG.BOT_PREFIX} - Start new session\n` +
                `• ${CONFIG.BOT_PREFIX} merge - Merge collected files\n` +
                `• ${CONFIG.BOT_PREFIX} cancel - Cancel current session\n` +
                `• help - Show this help\n\n` +
                `⚡ Ready to receive your PDF files!`
            );

        } catch (error) {
            console.error('Error starting session:', error);
            await this.sendMessage(chatId, '❌ Failed to start session. Please try again.');
        }
    }

    async processPDFMerge(chatId) {
        const session = userSessions.get(chatId);
        
        if (!session || session.files.length === 0) {
            await this.sendMessage(chatId, '❌ No files to merge.');
            return;
        }

        try {
            session.status = 'processing';
            
            await this.sendMessage(chatId, 
                `🔄 Merging ${session.files.length} PDF files...\n` +
                `⏳ Please wait, this may take a moment.`
            );

            // Prepare files for Appwrite function
            const files = session.files.map(file => ({
                name: file.name,
                path: file.path,
                size: file.size
            }));

            const mergeData = {
                files: files,
                chatId: chatId,
                timestamp: Date.now()
            };

            console.log('Calling PDF merger function with data:', mergeData);

            // Call Appwrite function
            const execution = await this.functions.createExecution(
                CONFIG.PDF_MERGER_FUNCTION_ID,
                JSON.stringify(mergeData),
                false, // async
                '/', // path
                'POST', // method
                { 'Content-Type': 'application/json' } // headers
            );

            console.log('Function execution result:', execution);

            if (execution.status === 'completed' && execution.responseStatusCode === 200) {
                const result = JSON.parse(execution.response);
                
                if (result.success && result.mergedFileUrl) {
                    await this.sendMessage(chatId, 
                        `✅ *PDF Merge Completed!*\n\n` +
                        `📄 Merged ${session.files.length} files\n` +
                        `📁 File name: ${result.fileName || 'merged.pdf'}\n` +
                        `💾 Download: ${result.mergedFileUrl}\n\n` +
                        `Thank you for using PDF Merger Bot! 🎉`
                    );
                } else {
                    throw new Error(result.error || 'Unknown error during merge');
                }
            } else {
                throw new Error(`Function execution failed: ${execution.response}`);
            }

        } catch (error) {
            console.error('Error during PDF merge:', error);
            await this.sendMessage(chatId, 
                `❌ Failed to merge PDFs: ${error.message}\n\n` +
                `Please try again or contact support.`
            );
        } finally {
            // Cleanup
            await this.cleanupSession(chatId);
        }
    }

    async cancelSession(chatId) {
        try {
            await this.cleanupSession(chatId);
            await this.sendMessage(chatId, 
                '❌ Session cancelled. All files have been removed.\n\n' +
                `Send "${CONFIG.BOT_PREFIX}" to start a new session.`
            );
        } catch (error) {
            console.error('Error cancelling session:', error);
            await this.sendMessage(chatId, '❌ Error cancelling session.');
        }
    }

    async cleanupSession(chatId) {
        const session = userSessions.get(chatId);
        
        if (session && session.files) {
            // Delete temporary files
            for (const file of session.files) {
                try {
                    if (await fs.pathExists(file.path)) {
                        await fs.unlink(file.path);
                    }
                } catch (error) {
                    console.error('Error deleting file:', file.path, error);
                }
            }
        }
        
        userSessions.delete(chatId);
    }

    async sendHelpMessage(chatId) {
        await this.sendMessage(chatId, 
            `🤖 *WhatsApp PDF Merger Bot - Help*\n\n` +
            `This bot helps you merge multiple PDF files into one.\n\n` +
            `📋 *How to use:*\n` +
            `1. Send "${CONFIG.BOT_PREFIX}" to start\n` +
            `2. Upload your PDF files\n` +
            `3. Type "${CONFIG.BOT_PREFIX} merge" to merge\n` +
            `4. Confirm and download merged file\n\n` +
            `📝 *Available commands:*\n` +
            `• ${CONFIG.BOT_PREFIX} - Start new session\n` +
            `• ${CONFIG.BOT_PREFIX} merge - Merge files\n` +
            `• ${CONFIG.BOT_PREFIX} cancel - Cancel session\n` +
            `• help - Show this help\n\n` +
            `⚠️ *Limitations:*\n` +
            `• Only PDF files supported\n` +
            `• Max file size: ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB\n` +
            `• Files are automatically deleted after merge\n\n` +
            `❓ Need support? Contact the administrator.`
        );
    }

    async sendMessage(chatId, text) {
        try {
            if (this.sock && this.isConnected) {
                await this.sock.sendMessage(chatId, { text });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
}

// Web server for health checks
const app = express();
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp PDF Merger Bot is running',
        timestamp: new Date().toISOString(),
        redis_connected: !!redisClient,
        bot_connected: bot.isConnected
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize and start bot
const bot = new WhatsAppPDFBot();
console.log('🚀 Starting WhatsApp PDF Merger Bot...');

// Start the bot
bot.init().catch(console.error);

// Start web server
const PORT = CONFIG.PORT;
app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (redisClient) {
        await redisClient.quit();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down...');
    if (redisClient) {
        await redisClient.quit();
    }
    process.exit(0);
});
