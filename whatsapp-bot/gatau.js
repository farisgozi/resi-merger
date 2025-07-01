// Import library yang kita butuhkan
import Baileys from '@whiskeysockets/baileys';
import { useRedisAuthState } from 'redis-baileys'; // <-- IMPORT LIBRARY BARU
import QRCode from 'qrcode';
import { Client, Functions } from 'node-appwrite';
import fs from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import dotenv from 'dotenv';
import axios from 'axios';
import pino from 'pino';
import express from 'express';
import ioredis from 'ioredis';

// Load environment variables
dotenv.config();

// Inisialisasi koneksi ke Redis (tetap diperlukan)
const redis = new ioredis(process.env.REDIS_URL);

// HAPUS SELURUH FUNGSI useRedisAuthState LAMA YANG KITA BUAT MANUAL
// Kode tersebut sekarang digantikan oleh library `redis-baileys`

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
        
        this.client = new Client();
        this.client
            .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
            .setProject(CONFIG.APPWRITE_PROJECT_ID)
            .setKey(CONFIG.APPWRITE_API_KEY);
            
        this.functions = new Functions(this.client);
    }

    async init() {
        try {
            // GANTI DENGAN INI: Panggil library baru dan berikan koneksi redis
            const { state, saveCreds } = await useRedisAuthState(redis);
            
            const { version } = await Baileys.fetchLatestBaileysVersion();

            const logger = pino({ 
                level: 'debug',
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
                browser: ['Resi Merger Bot', 'Chrome', '1.0.0']
            });

            this.sock.ev.on('connection.update', this.handleConnection.bind(this));
            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessages.bind(this));

        } catch (error) {
            console.error('Failed to initialize WhatsApp bot:', error);
            throw error;
        }
    }

    handleConnection(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Scan QR code to connect to WhatsApp:');
            console.log('='.repeat(50));
            
            QRCode.toString(qr, { type: 'terminal', small: true }, (err, qrString) => {
                if (err) {
                    console.log('❌ Error generating QR code, please check connection');
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
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== Baileys.DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                setTimeout(() => this.init(), 5000);
            }
            this.isConnected = false;
        } else if (connection === 'open') {
            console.log('✅ WhatsApp bot connected successfully!');
            console.log('🤖 Bot is ready to receive messages!');
            console.log(`📋 Send "${CONFIG.BOT_PREFIX}" to any chat to start PDF merging`);
            this.isConnected = true;
        }
    }

    // ... SISA DARI KODE ANDA (handleMessages, dll) TIDAK PERLU DIUBAH SAMA SEKALI ...
    // ... Salin dan tempel sisa dari class WhatsAppPDFBot Anda di sini ...
    // ... Kode Express app dan proses shutdown juga tetap sama ...
    async handleMessages(messageUpdate) {
        try {
            const message = messageUpdate.messages[0];
            if (!message || message.key.fromMe) return;

            const chatId = message.key.remoteJid;
            const messageType = Object.keys(message.message || {})[0];
            
            // Handle text messages
            if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
                await this.handleTextMessage(chatId, text.trim(), message);
            }
            
            // Handle document messages (PDFs)
            if (messageType === 'documentMessage') {
                await this.handleDocumentMessage(chatId, message);
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async handleTextMessage(chatId, text, message) {
        try {
            // Check if user wants to start PDF merge
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

            // Handle session commands
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

            // Help command
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
            const mimeType = doc.mimetype;
            const fileName = doc.fileName || 'document.pdf';

            // Check if it's a PDF
            if (!CONFIG.SUPPORTED_MIMES.includes(mimeType)) {
                await this.sendMessage(chatId, '❌ Please send only PDF files.');
                return;
            }

            // Check file size
            if (doc.fileLength > CONFIG.MAX_FILE_SIZE) {
                await this.sendMessage(chatId, `❌ File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / (1024*1024)}MB.`);
                return;
            }

            const session = userSessions.get(chatId);
            if (!session || session.status !== 'collecting_files') {
                await this.sendMessage(chatId, `Please start a PDF merge session first by sending "${CONFIG.BOT_PREFIX}"`);
                return;
            }

            await this.sendMessage(chatId, '📄 Downloading PDF file...');

            // Download the file
            const mediaBuffer = await Baileys.downloadMediaMessage(message, 'buffer', {});
            const filePath = path.join(CONFIG.TEMP_DIR, `${Date.now()}_${fileName}`);
            await fs.writeFile(filePath, mediaBuffer);

            // Add to session
            session.files.push({
                name: fileName,
                path: filePath,
                size: doc.fileLength
            });

            await this.sendMessage(chatId, 
                `✅ PDF added! (${session.files.length} file${session.files.length > 1 ? 's' : ''} total)\n\n` +
                `Send more PDFs or type "${CONFIG.BOT_PREFIX} merge" when ready to merge.`
            );

        } catch (error) {
            console.error('Error handling document:', error);
            await this.sendMessage(chatId, '❌ Failed to process PDF file. Please try again.');
        }
    }

    async startPDFMergeSession(chatId) {
        try {
            // Clean up any existing session
            await this.cleanupSession(chatId);

            userSessions.set(chatId, {
                status: 'collecting_files',
                files: [],
                startTime: Date.now()
            });

            await this.sendMessage(chatId, 
                `🔗 *Nyatuin Resi Anti Ribet Saayyy*\n\n` +
                `Send me PDF files to merge. When you're done, type "${CONFIG.BOT_PREFIX} merge" to combine them.\n\n` +
                `📋 *Instructions:*\n` +
                `• Send PDF files one by one\n` +
                `• Maximum file size: ${CONFIG.MAX_FILE_SIZE / (1024*1024)}MB\n` +
                `• Files will be merged in the order received\n` +
                `• Type "${CONFIG.BOT_PREFIX} merge" when ready\n` +
                `• Type "${CONFIG.BOT_PREFIX} cancel" to cancel`
            );

        } catch (error) {
            console.error('Error starting session:', error);
            await this.sendMessage(chatId, '❌ Failed to start PDF merge session.');
        }
    }

    async processPDFMerge(chatId) {
        const session = userSessions.get(chatId);
        if (!session || session.files.length < 1) {
            await this.sendMessage(chatId, '❌ No PDF files to merge.');
            return;
        }

        try {
            session.status = 'processing';
            await this.sendMessage(chatId, `🔄 Merging ${session.files.length} PDF files...`);

            // Call Appwrite Function API
            const result = await this.callPDFMergerAPI(session.files);
            
            if (result.success) {
                await this.sendMessage(chatId, '✅ PDF merge completed! Preparing download...');
                
                // Check if we have direct content (immediate delivery - no expiry risk)
                if (result.directContent) {
                    console.log('📄 Direct content available, sending immediately...');
                    await this.sendPDFDirectly(chatId, result.directContent, result.fileSize);
                } else {
                    // Download and send the merged PDF via status check
                    await this.sendMergedPDF(chatId, result.jobId);
                }
                
            } else {
                throw new Error(result.error || 'PDF merge failed');
            }

        } catch (error) {
            console.error('Error processing PDF merge:', error);
            await this.sendMessage(chatId, `❌ PDF merge failed: ${error.message}`);
        } finally {
            await this.cleanupSession(chatId);
        }
    }

    async callPDFMergerAPI(files) {
        try {
            // Prepare files as base64 strings like in demo-sdk.js
            const fileData = [];
            
            for (const file of files) {
                const fileBuffer = await fs.readFile(file.path);
                const base64Content = fileBuffer.toString('base64');
                
                fileData.push({
                    filename: file.name,
                    content: base64Content
                });
            }

            const requestData = {
                action: "merge",
                files: fileData,
                client_id: "whatsapp_bot"
            };

            const result = await this.functions.createExecution(
                CONFIG.PDF_MERGER_FUNCTION_ID,
                JSON.stringify(requestData),
                false, // async
                '/',   // path
                'POST', // method
                {'Content-Type': 'application/json'}
            );
            
            if (result.responseStatusCode === 200 && result.responseBody) {
                const responseBody = JSON.parse(result.responseBody);
                
                // Check if response contains direct file content (immediate delivery)
                if (responseBody.success && responseBody.file_content_base64) {
                    return {
                        success: true,
                        jobId: responseBody.job_id,
                        message: responseBody.message,
                        directContent: responseBody.file_content_base64,
                        fileSize: responseBody.file_size
                    };
                }
                
                return {
                    success: true,
                    jobId: responseBody.job_id,
                    message: responseBody.message
                };
            } else {
                return {
                    success: false,
                    error: result.logs || result.responseBody || 'Unknown error occurred'
                };
            }

        } catch (error) {
            console.error('API call error:', error);
            return {
                success: false,
                error: error.message || 'Unknown error occurred'
            };
        }
    }

    async sendMergedPDF(chatId, jobId, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            console.log(`📊 Checking job status: ${jobId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
            
            // Check job status first using SDK
            const statusResult = await this.functions.createExecution(
                CONFIG.PDF_MERGER_FUNCTION_ID,
                JSON.stringify({
                    action: "status",
                    job_id: jobId
                }),
                false,
                '/',
                'POST',
                {'Content-Type': 'application/json'}
            );

            if (statusResult.responseStatusCode === 200) {
                const statusData = JSON.parse(statusResult.responseBody);
                console.log(`📋 Job status: ${statusData.status}`);
                
                if (statusData.status === 'completed') {
                    console.log('📥 Processing completed PDF...');
                    
                    let pdfBuffer;
                    let fileName = `merged_${Date.now()}.pdf`;
                    let contentSource = 'unknown';
                    
                    // PRIORITY 1: Use base64 content first (immediate, no token expiry)
                    if (statusData.file_content_base64 && statusData.content_available !== false) {
                        console.log('📄 Using base64 content from response (preferred method)');
                        try {
                            pdfBuffer = Buffer.from(statusData.file_content_base64, 'base64');
                            contentSource = 'base64';
                            console.log(`✅ Base64 content decoded: ${pdfBuffer.length} bytes`);
                        } catch (decodeError) {
                            console.error('❌ Base64 decode failed:', decodeError.message);
                            pdfBuffer = null;
                        }
                    }
                    
                    // PRIORITY 2: Fallback to download URL with authentication (if base64 failed)
                    if (!pdfBuffer && statusData.download_url) {
                        console.log('📥 Fallback: Downloading PDF from URL:', statusData.download_url);
                        
                        try {
                            const pdfResponse = await axios.get(statusData.download_url, {
                                headers: {
                                    'X-Appwrite-Project': CONFIG.APPWRITE_PROJECT_ID,
                                    'X-Appwrite-Key': CONFIG.APPWRITE_API_KEY,
                                    'Authorization': `Bearer ${CONFIG.APPWRITE_API_KEY}`
                                },
                                responseType: 'arraybuffer',
                                timeout: 30000, // 30 seconds timeout
                                maxRedirects: 5
                            });

                            pdfBuffer = Buffer.from(pdfResponse.data);
                            contentSource = 'download';
                            console.log(`✅ Downloaded content: ${pdfBuffer.length} bytes`);
                            
                        } catch (downloadError) {
                            console.error('❌ Download failed:', downloadError.message);
                            
                            // Handle specific errors
                            if (downloadError.response) {
                                const status = downloadError.response.status;
                                if (status === 404) {
                                    throw new Error('File not found or expired');
                                } else if (status === 403) {
                                    throw new Error('Access denied to file');
                                } else if (status === 401) {
                                    throw new Error('Authentication failed');
                                } else {
                                    throw new Error(`Download failed with status ${status}`);
                                }
                            } else {
                                throw new Error(`Network error: ${downloadError.message}`);
                            }
                        }
                    }
                    
                    // PRIORITY 3: No content available
                    if (!pdfBuffer) {
                        throw new Error('No PDF content available from any source');
                    }

                    console.log(`📄 PDF ready from ${contentSource}: ${pdfBuffer.length} bytes`);

                    // Validate PDF content
                    if (pdfBuffer.length < 100) {
                        throw new Error('PDF file appears to be corrupted (too small)');
                    }

                    // Send PDF via WhatsApp
                    await this.sock.sendMessage(chatId, {
                        document: pdfBuffer,
                        fileName: fileName,
                        mimetype: 'application/pdf',
                        caption: `📄 *PDF Merged Successfully!*\n\n✅ Your PDF files have been merged and optimized.\n\n✨ Selamat packing-packing! -Zerin\n\n📊 Final size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB\n🔧 Source: ${contentSource}`
                    });

                    console.log('✅ PDF sent successfully to WhatsApp');
                    
                } else if (statusData.status === 'processing') {
                    await this.sendMessage(chatId, '⏳ PDF is still being processed. Please wait a moment...');
                    
                    // Retry after 3 seconds (with backoff)
                    setTimeout(() => {
                        this.sendMergedPDF(chatId, jobId, retryCount);
                    }, 3000 + (retryCount * 1000));
                    
                } else if (statusData.status === 'failed') {
                    const errorMsg = statusData.error_message || 'Unknown processing error';
                    throw new Error(`Processing failed: ${errorMsg}`);
                } else {
                    throw new Error(`Unexpected job status: ${statusData.status}`);
                }
            } else {
                throw new Error(`Status check failed: ${statusResult.responseStatusCode}`);
            }

        } catch (error) {
            console.error(`❌ Error sending merged PDF (attempt ${retryCount + 1}):`, error.message);
            
            // Retry logic for transient errors
            if (retryCount < maxRetries) {
                const isRetryableError = error.message.includes('timeout') || 
                                       error.message.includes('ECONNRESET') ||
                                       error.message.includes('ENOTFOUND') ||
                                       error.message.includes('Network error');
                
                if (isRetryableError) {
                    console.log(`🔄 Retrying in ${(retryCount + 1) * 2} seconds...`);
                    await this.sendMessage(chatId, `⚠️ Network issue occurred. Retrying... (${retryCount + 1}/${maxRetries})`);
                    
                    setTimeout(() => {
                        this.sendMergedPDF(chatId, jobId, retryCount + 1);
                    }, (retryCount + 1) * 2000);
                    return;
                }
            }
            
            // Final error handling
            let userMessage = '❌ Failed to deliver merged PDF. ';
            
            if (error.message.includes('not found') || error.message.includes('expired')) {
                userMessage += 'The file has expired. Please try merging again.';
            } else if (error.message.includes('Access denied')) {
                userMessage += 'Access denied. Please contact support.';
            } else if (error.message.includes('corrupted')) {
                userMessage += 'The PDF file appears to be corrupted. Please try again.';
            } else if (error.message.includes('Processing failed')) {
                userMessage += `Processing error: ${error.message.split(': ')[1] || 'Unknown error'}`;
            } else {
                userMessage += `Technical error: ${error.message}`;
            }
            
            userMessage += '\n\n💡 You can try again or contact support if the problem persists.';
            
            await this.sendMessage(chatId, userMessage);
        }
    }

    async sendPDFDirectly(chatId, base64Content, fileSize) {
        try {
            console.log('📄 Sending PDF directly from base64 content...');
            
            // Decode base64 content
            const pdfBuffer = Buffer.from(base64Content, 'base64');
            const fileName = `merged_${Date.now()}.pdf`;
            
            console.log(`✅ PDF ready for direct delivery: ${pdfBuffer.length} bytes`);
            
            // Validate PDF content
            if (pdfBuffer.length < 100) {
                throw new Error('PDF file appears to be corrupted (too small)');
            }
            
            // Send PDF via WhatsApp
            await this.sock.sendMessage(chatId, {
                document: pdfBuffer,
                fileName: fileName,
                mimetype: 'application/pdf',
                caption: `📄 *PDF Merged Successfully!*\n\n✅ Your PDF files have been merged and optimized.\n\n✨ Features applied:\n• Smart cropping\n• Layout optimization\n• Size optimization\n\n📊 Final size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB\n⚡ Delivered instantly (no expiry risk)`
            });

            console.log('✅ PDF sent directly to WhatsApp (no download required)');
            
        } catch (error) {
            console.error('❌ Error sending PDF directly:', error.message);
            
            let userMessage = '❌ Failed to send PDF directly. ';
            
            if (error.message.includes('corrupted')) {
                userMessage += 'The PDF file appears to be corrupted. Please try again.';
            } else {
                userMessage += `Technical error: ${error.message}`;
            }
            
            userMessage += '\n\n💡 You can try again or contact support if the problem persists.';
            
            await this.sendMessage(chatId, userMessage);
        }
    }

    async cancelSession(chatId) {
        await this.cleanupSession(chatId);
        await this.sendMessage(chatId, '❌ PDF merge session cancelled.');
    }

    async cleanupSession(chatId) {
        const session = userSessions.get(chatId);
        if (session && session.files) {
            // Clean up temporary files
            for (const file of session.files) {
                try {
                    await fs.remove(file.path);
                } catch (error) {
                    console.error('Error cleaning up file:', error);
                }
            }
        }
        userSessions.delete(chatId);
    }

    async sendHelpMessage(chatId) {
        const helpText = `🤖 *PDF Merger Bot Help*\n\n` +
            `*Commands:*\n` +
            `• \`${CONFIG.BOT_PREFIX}\` - Start PDF merge session\n` +
            `• \`help\` - Show this help message\n\n` +
            `*How to use:*\n` +
            `1. Send \`${CONFIG.BOT_PREFIX}\` to start\n` +
            `2. Send PDF files one by one\n` +
            `3. Send \`${CONFIG.BOT_PREFIX} merge\` when ready\n` +
            `4. Confirm with "yes" to merge\n` +
            `5. Receive your merged PDF!\n\n` +
            `*Features:*\n` +
            `• Automatic page layout optimization\n` +
            `• Smart cropping for better readability\n` +
            `• Support for multiple PDF files\n` +
            `• Fast processing via Appwrite`;

        await this.sendMessage(chatId, helpText);
    }

    async sendMessage(chatId, text) {
        try {
            await this.sock.sendMessage(chatId, { text });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    // Cleanup on exit
    async cleanup() {
        console.log('Cleaning up...');
        
        // Clean up all sessions
        for (const [chatId] of userSessions) {
            await this.cleanupSession(chatId);
        }

        // Clean up temp directory
        try {
            await fs.emptyDir(CONFIG.TEMP_DIR);
        } catch (error) {
            console.error('Error cleaning temp directory:', error);
        }
    }
}

// Add Express app for Heroku health check
const app = express();

app.get('/', (req, res) => {
    res.json({
        status: 'WhatsApp PDF Merger Bot is running',
        connected: bot?.isConnected || false,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// Start Express server
app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Health check server running on port ${CONFIG.PORT}`);
});

// Initialize and start WhatsApp bot
const bot = new WhatsAppPDFBot();

console.log('🚀 Starting WhatsApp PDF Merger Bot...');
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Port: ${CONFIG.PORT}`);

bot.init().catch(error => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📴 Shutting down bot...');
    await bot.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n📴 Shutting down bot...');
    await bot.cleanup();
    process.exit(0);
});

export default bot;

