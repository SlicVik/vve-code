import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import multer from 'multer'
import redis from '../lib/redis.js'

const router = express.Router()

// Get directory path for loading allowlist
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Max payload sizes
const MAX_TOTAL_SIZE = 50 * 1024 // 50 KB for all files combined
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5 MB per upload
const UPLOAD_DIR = join(__dirname, '../../uploads')

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Configure multer for file uploads
const upload = multer({
    limits: { fileSize: MAX_UPLOAD_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.csv', '.json', '.txt', '.png', '.jpg', '.jpeg', '.xlsx', '.parquet']
        const ext = '.' + file.originalname.split('.').pop().toLowerCase()
        if (allowedExts.includes(ext)) {
            cb(null, true)
        } else {
            cb(new Error(`Invalid file type: ${ext}`))
        }
    }
})

// Load allowlist
let allowlist = []
try {
    const allowlistPath = join(__dirname, '../../allowlist.txt')
    const content = readFileSync(allowlistPath, 'utf-8')
    allowlist = content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
            const [name, description] = line.split('|')
            return { name: name.trim(), description: (description || '').trim() }
        })
    console.log(`[API] Loaded ${allowlist.length} packages from allowlist`)
} catch (err) {
    console.error('[API] Failed to load allowlist:', err.message)
}

/**
 * GET /api/allowlist
 */
router.get('/allowlist', (req, res) => {
    res.json({ packages: allowlist })
})

/**
 * POST /api/upload
 * Upload a data file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        const { roomId } = req.body
        if (!roomId) {
            return res.status(400).json({ error: 'Room ID required' })
        }

        // Create room upload directory
        const roomDir = join(UPLOAD_DIR, roomId)
        if (!existsSync(roomDir)) {
            mkdirSync(roomDir, { recursive: true })
        }

        // Sanitize filename
        const safeFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = join(roomDir, safeFileName)

        // Write file
        writeFileSync(filePath, req.file.buffer)

        console.log(`[API] File uploaded: ${safeFileName} for room ${roomId}`)
        res.json({ success: true, fileName: safeFileName })

    } catch (err) {
        console.error('[API] Upload error:', err)
        res.status(500).json({ error: err.message || 'Upload failed' })
    }
})

/**
 * GET /api/files/:roomId
 * List uploaded files
 */
router.get('/files/:roomId', (req, res) => {
    try {
        const roomDir = join(UPLOAD_DIR, req.params.roomId)
        if (!existsSync(roomDir)) {
            return res.json({ files: [] })
        }
        const files = readdirSync(roomDir)
        res.json({ files })
    } catch (err) {
        res.status(500).json({ error: 'Failed to list files' })
    }
})

/**
 * DELETE /api/files/:roomId/:fileName
 */
router.delete('/files/:roomId/:fileName', (req, res) => {
    try {
        const filePath = join(UPLOAD_DIR, req.params.roomId, req.params.fileName)
        if (existsSync(filePath)) {
            unlinkSync(filePath)
        }
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete file' })
    }
})

/**
 * POST /api/execute
 * Submit code for execution (multi-file)
 */
router.post('/execute', async (req, res) => {
    try {
        const { files, entrypoint = 'main.py', packages = [], roomId = 'default-room' } = req.body

        // Support legacy single-file format
        let codeFiles = files
        if (typeof files === 'undefined' && req.body.code) {
            codeFiles = { 'main.py': req.body.code }
        }

        if (!codeFiles || Object.keys(codeFiles).length === 0) {
            return res.status(400).json({ error: 'Code files are required' })
        }

        // Check total payload size
        const totalSize = Object.values(codeFiles).reduce((sum, content) =>
            sum + Buffer.byteLength(content || '', 'utf8'), 0)
        if (totalSize > MAX_TOTAL_SIZE) {
            return res.status(413).json({ error: 'Total code size exceeds maximum of 50 KB' })
        }

        // Validate packages against allowlist
        const allowedNames = new Set(allowlist.map(p => p.name))
        const invalidPackages = packages.filter(p => !allowedNames.has(p))
        if (invalidPackages.length > 0) {
            return res.status(400).json({
                error: `Invalid packages: ${invalidPackages.join(', ')}`
            })
        }

        const jobId = uuidv4()
        const job = {
            jobId,
            files: codeFiles,
            entrypoint,
            packages,
            roomId,
            language: 'python',
            submittedAt: Date.now(),
        }

        // Store job status
        await redis.set(`job:${jobId}`, JSON.stringify({
            status: 'pending',
            submittedAt: job.submittedAt,
        }), 'EX', 600)

        // Push to queue
        await redis.lpush('submission_queue', JSON.stringify(job))

        console.log(`[API] Job submitted: ${jobId} (${Object.keys(codeFiles).length} files, entry: ${entrypoint})`)
        res.json({ jobId })

    } catch (err) {
        console.error('[API] Execute error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * POST /api/install
 */
router.post('/install', async (req, res) => {
    try {
        const { packages = [] } = req.body

        if (!Array.isArray(packages) || packages.length === 0) {
            return res.status(400).json({ error: 'Packages array is required' })
        }

        const allowedNames = new Set(allowlist.map(p => p.name))
        const invalidPackages = packages.filter(p => !allowedNames.has(p))
        if (invalidPackages.length > 0) {
            return res.status(400).json({
                error: `Invalid packages: ${invalidPackages.join(', ')}`
            })
        }

        console.log(`[API] Packages validated: [${packages.join(', ')}]`)
        res.json({ success: true, packages })

    } catch (err) {
        console.error('[API] Install error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

/**
 * GET /api/status/:jobId
 */
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params
        const result = await redis.get(`job:${jobId}`)

        if (!result) {
            return res.status(404).json({ error: 'Job not found' })
        }

        res.json(JSON.parse(result))

    } catch (err) {
        console.error('[API] Status error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router


