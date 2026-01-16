import rateLimit from 'express-rate-limit'

/**
 * Rate limiter: 10 executions per minute per IP
 * Per design doc section 5.2
 */
export const rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per window per IP
    message: {
        error: 'Rate limit exceeded. Maximum 10 executions per minute.',
    },
    standardHeaders: true,
    legacyHeaders: false,
})
