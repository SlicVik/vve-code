import Redis from 'ioredis'

// Redis connection (configurable via env)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 3) {
            console.error('[Redis] Max retries reached, giving up')
            return null
        }
        const delay = Math.min(times * 200, 2000)
        console.log(`[Redis] Retrying connection in ${delay}ms...`)
        return delay
    },
})

redis.on('connect', () => {
    console.log('[Redis] Connected successfully')
})

redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
})

export default redis
