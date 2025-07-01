// Test Redis configuration parsing
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing Redis URL parsing...');

if (process.env.REDIS_URL) {
    try {
        const redisUrl = new URL(process.env.REDIS_URL);
        const redisConfig = {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port) || 6379,
            password: redisUrl.password || undefined,
            retryDelayOnFailover: 100,
            retryConnectOnFailover: true,
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
            commandTimeout: 5000,
            lazyConnect: false
        };
        
        console.log('✅ Redis config parsed successfully:');
        console.log(`   Host: ${redisConfig.host}`);
        console.log(`   Port: ${redisConfig.port}`);
        console.log(`   Password: ${redisConfig.password ? '***HIDDEN***' : 'None'}`);
        
    } catch (error) {
        console.error('❌ Error parsing REDIS_URL:', error.message);
    }
} else {
    console.log('📝 Example REDIS_URL format: redis://h:password@hostname:port');
    console.log('💡 To test locally, set REDIS_URL=redis://localhost:6379');
}
