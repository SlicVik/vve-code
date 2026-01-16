import { useState, useEffect } from 'react'
import { getUploadedFiles } from '../lib/collaboration'

export function useStorageStats() {
    const [totalSize, setTotalSize] = useState(0)

    useEffect(() => {
        const yarray = getUploadedFiles()

        const updateStats = () => {
            const files = yarray.toArray()
            const size = files.reduce((acc, file) => acc + (file.size || 0), 0)
            setTotalSize(size)
        }

        updateStats()
        yarray.observe(updateStats)

        return () => yarray.unobserve(updateStats)
    }, [])

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const limit = 50 * 1024 * 1024 // 50 MB
    const percentage = Math.min((totalSize / limit) * 100, 100)

    return {
        totalSize,
        formattedSize: formatSize(totalSize),
        limit: limit,
        formattedLimit: '50 MB',
        percentage: percentage.toFixed(1)
    }
}
