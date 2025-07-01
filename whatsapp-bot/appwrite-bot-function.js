/**
 * WhatsApp PDF Merger Bot - Appwrite Function
 * This function runs the WhatsApp bot as a serverless function on Appwrite
 */

import { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    downloadMediaMessage,
    fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import { Client, Functions, Storage, Databases, InputFile } from 'node-appwrite';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export default async ({ req, res, log, error }) => {
    log('🤖 WhatsApp Bot Function Starting...');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.empty(200, headers);
    }

    try {
        // Initialize Appwrite client for internal API calls
        const client = new Client();
        client
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);

        const storage = new Storage(client);
        const databases = new Databases(client);

        // Configuration
        const CONFIG = {
            FUNCTION_ID: process.env.PDF_MERGER_FUNCTION_ID || 'pdf-merger',
            BOT_PREFIX: '.pdf',
            MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
            SUPPORTED_MIMES: ['application/pdf']
        };

        // Handle different request types
        const body = req.body ? JSON.parse(req.body) : {};
        
        if (req.method === 'POST' && body.action === 'webhook') {
            // Handle webhook from WhatsApp Business API or external service
            return await handleWebhook(body, CONFIG, storage, databases, log);
        }
        
        if (req.method === 'GET' || body.action === 'status') {
            // Return bot status
            return res.json({
                status: 'active',
                bot_name: 'WhatsApp PDF Merger Bot',
                prefix: CONFIG.BOT_PREFIX,
                max_file_size: CONFIG.MAX_FILE_SIZE,
                supported_formats: ['PDF'],
                instructions: [
                    `Send "${CONFIG.BOT_PREFIX}" to start PDF merging`,
                    'Send PDF files one by one',
                    `Send "${CONFIG.BOT_PREFIX} merge" to merge all PDFs`,
                    `Send "${CONFIG.BOT_PREFIX} clear" to clear session`
                ]
            }, 200, headers);
        }

        // Handle bot initialization (for persistent connections)
        if (body.action === 'init') {
            return await initializeBot(CONFIG, storage, databases, log);
        }

        return res.json({
            error: 'Invalid request',
            help: 'Use GET for status, POST with action for operations'
        }, 400, headers);

    } catch (err) {
        error('Bot function error:', err);
        return res.json({
            error: 'Bot function failed',
            message: err.message
        }, 500, headers);
    }
};

async function handleWebhook(webhookData, config, storage, databases, log) {
    log('📨 Processing webhook:', JSON.stringify(webhookData, null, 2));
    
    try {
        // Process webhook data - this would typically come from WhatsApp Business API
        const { chatId, message, messageType } = webhookData;
        
        if (messageType === 'text') {
            return await handleTextMessage(chatId, message.text, config, databases, log);
        }
        
        if (messageType === 'document' && message.mimeType === 'application/pdf') {
            return await handlePDFMessage(chatId, message, config, storage, databases, log);
        }
        
        return {
            success: true,
            message: 'Webhook processed'
        };
        
    } catch (err) {
        log('❌ Webhook error:', err.message);
        throw err;
    }
}

async function handleTextMessage(chatId, text, config, databases, log) {
    log(`💬 Text message from ${chatId}: ${text}`);
    
    if (text === config.BOT_PREFIX) {
        // Start new session
        await createUserSession(chatId, databases);
        return {
            success: true,
            reply: `🤖 PDF Merger Bot activated!\n\n📄 Send me PDF files to merge\n🔄 Type "${config.BOT_PREFIX} merge" when ready\n🗑️ Type "${config.BOT_PREFIX} clear" to reset`
        };
    }
    
    if (text === `${config.BOT_PREFIX} merge`) {
        return await processMergeCommand(chatId, config, databases, log);
    }
    
    if (text === `${config.BOT_PREFIX} clear`) {
        await clearUserSession(chatId, databases);
        return {
            success: true,
            reply: '🗑️ Session cleared! Send new PDFs to start over.'
        };
    }
    
    if (text === `${config.BOT_PREFIX} help`) {
        return {
            success: true,
            reply: `🤖 PDF Merger Bot Commands:\n\n${config.BOT_PREFIX} - Start new session\n${config.BOT_PREFIX} merge - Merge uploaded PDFs\n${config.BOT_PREFIX} clear - Clear session\n${config.BOT_PREFIX} help - Show this help`
        };
    }
    
    return {
        success: true,
        message: 'Text processed'
    };
}

async function handlePDFMessage(chatId, message, config, storage, databases, log) {
    log(`📄 PDF received from ${chatId}`);
    
    try {
        // Get user session
        const session = await getUserSession(chatId, databases);
        if (!session) {
            return {
                success: true,
                reply: `❌ No active session. Send "${config.BOT_PREFIX}" first to start!`
            };
        }
        
        // Validate file size
        if (message.fileSize > config.MAX_FILE_SIZE) {
            return {
                success: true,
                reply: `❌ File too large! Max size: ${Math.round(config.MAX_FILE_SIZE / 1024 / 1024)}MB`
            };
        }
        
        // Store PDF file
        const fileId = await storePDFFile(message, storage, log);
        
        // Add to session
        const currentFiles = session.pdf_files || [];
        currentFiles.push({
            file_id: fileId,
            filename: message.filename || `file_${currentFiles.length + 1}.pdf`,
            size: message.fileSize
        });
        
        // Update session
        await databases.updateDocument(
            'pdf-merger-db',
            'user-sessions',
            session.$id,
            {
                pdf_files: currentFiles,
                last_activity: new Date().toISOString()
            }
        );
        
        return {
            success: true,
            reply: `✅ PDF ${currentFiles.length} added!\n\n📊 Total files: ${currentFiles.length}\n🔄 Send "${config.BOT_PREFIX} merge" to combine them`
        };
        
    } catch (err) {
        log('❌ PDF handling error:', err.message);
        return {
            success: true,
            reply: '❌ Failed to process PDF. Please try again.'
        };
    }
}

async function processMergeCommand(chatId, config, databases, log) {
    try {
        const session = await getUserSession(chatId, databases);
        if (!session || !session.pdf_files || session.pdf_files.length === 0) {
            return {
                success: true,
                reply: `❌ No PDFs to merge! Send PDF files first.`
            };
        }
        
        if (session.pdf_files.length < 2) {
            return {
                success: true,
                reply: `❌ Need at least 2 PDFs to merge! Current: ${session.pdf_files.length}`
            };
        }
        
        log(`🔄 Starting merge for ${session.pdf_files.length} files`);
        
        // Call PDF merger function
        const mergeResult = await callPDFMerger(session.pdf_files, config, log);
        
        if (mergeResult.success) {
            // Clear session after successful merge
            await clearUserSession(chatId, databases);
            
            return {
                success: true,
                reply: `✅ PDFs merged successfully!\n\n📄 Files merged: ${session.pdf_files.length}\n📊 Size: ${Math.round(mergeResult.file_size / 1024)}KB`,
                merged_file: {
                    content: mergeResult.file_content_base64,
                    filename: 'merged_receipts.pdf',
                    size: mergeResult.file_size
                }
            };
        } else {
            return {
                success: true,
                reply: `❌ Merge failed: ${mergeResult.error}`
            };
        }
        
    } catch (err) {
        log('❌ Merge command error:', err.message);
        return {
            success: true,
            reply: '❌ Merge failed. Please try again.'
        };
    }
}

async function callPDFMerger(pdfFiles, config, log) {
    try {
        // Initialize client for Functions call
        const client = new Client();
        client
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);
            
        // Prepare files for merger function
        const filesData = pdfFiles.map(file => ({
            filename: file.filename,
            content: file.base64_content // This should be stored when file is uploaded
        }));
        
        // Call the PDF merger function
        const functions = new Functions(client);
        const execution = await functions.createExecution(
            config.FUNCTION_ID,
            JSON.stringify({
                files: filesData
            }),
            false
        );
        
        const response = JSON.parse(execution.responseBody);
        return response;
        
    } catch (err) {
        log('❌ PDF merger call failed:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

async function createUserSession(chatId, databases) {
    try {
        return await databases.createDocument(
            'pdf-merger-db',
            'user-sessions',
            'unique()',
            {
                chat_id: chatId,
                pdf_files: [],
                created_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            }
        );
    } catch (err) {
        // Session might already exist, try to get it
        return await getUserSession(chatId, databases);
    }
}

async function getUserSession(chatId, databases) {
    try {
        const sessions = await databases.listDocuments(
            'pdf-merger-db',
            'user-sessions',
            [`Query.equal('chat_id', '${chatId}')`]
        );
        
        return sessions.documents.length > 0 ? sessions.documents[0] : null;
    } catch (err) {
        return null;
    }
}

async function clearUserSession(chatId, databases) {
    try {
        const session = await getUserSession(chatId, databases);
        if (session) {
            await databases.deleteDocument(
                'pdf-merger-db',
                'user-sessions',
                session.$id
            );
        }
    } catch (err) {
        // Session not found or already deleted
    }
}

async function storePDFFile(message, storage, log) {
    try {
        // In a real implementation, you'd download the file from WhatsApp
        // For now, assume we have the file content as base64
        const fileContent = Buffer.from(message.base64Content, 'base64');
        
        // Store in Appwrite storage
        const file = await storage.createFile(
            'pdf-files',
            'unique()',
            InputFile.fromBuffer(fileContent, message.filename)
        );
        
        return file.$id;
    } catch (err) {
        log('❌ File storage error:', err.message);
        throw err;
    }
}

async function initializeBot(config, storage, databases, log) {
    log('🚀 Initializing WhatsApp Bot...');
    
    // This would initialize the actual WhatsApp connection
    // For serverless, we'll use webhook approach instead
    
    return {
        success: true,
        message: 'Bot initialized - webhook mode active',
        webhook_url: `${process.env.APPWRITE_FUNCTION_API_ENDPOINT}/functions/${process.env.APPWRITE_FUNCTION_ID}/executions`,
        instructions: [
            'Configure your WhatsApp Business API webhook to point to this function',
            'Or use the existing client-side bot for direct WhatsApp Web connection'
        ]
    };
}
