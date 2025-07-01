import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'TfsZ2F51Q1qrW3rjfMu0nMeIiJxT6LDA',
    socket: {
        host: 'redis-17852.c239.us-east-1-2.ec2.redns.redis-cloud.com',
        port: 17852
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
console.log(result)  // >>> bar

