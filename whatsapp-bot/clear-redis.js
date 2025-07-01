#!/usr/bin/env node

// Script untuk manual clear Redis auth state
import dotenv from 'dotenv';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

dotenv.config();

async function clearRedisAuthState() {
    if (!process.env.REDIS_URL) {
        console.log('❌ REDIS_URL not set in environment variables');
        process.exit(1);
    }

    try {
        console.log('🔗 Connecting to Redis...');
        
        const keyvRedis = new KeyvRedis(process.env.REDIS_URL);
        const keyv = new Keyv({ 
            store: keyvRedis, 
            namespace: 'wa-auth'
        });
        
        // Test connection
        await keyv.set('test', 'ok', 1000);
        await keyv.delete('test');
        
        console.log('🧹 Clearing Redis auth state...');
        await keyv.clear();
        
        console.log('✅ Redis auth state cleared successfully!');
        console.log('💡 You can now restart the bot with fresh authentication');
        
        // Disconnect
        await keyv.disconnect();
        
    } catch (error) {
        console.error('❌ Error clearing Redis auth state:', error.message);
        process.exit(1);
    }
}

// Jalankan script
clearRedisAuthState().catch(console.error);
