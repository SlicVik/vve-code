import { useState, useCallback, useEffect } from 'react'
import { getUploadedFiles, addUploadedFile, removeUploadedFile, getRoomId, setFileContent } from '../lib/collaboration'
import './FileUpload.css'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTENSIONS = ['.csv', '.json', '.txt', '.png', '.jpg', '.jpeg', '.xlsx', '.parquet', '.py', '.md']
const EDITABLE_EXTENSIONS = ['.csv', '.json', '.txt', '.py', '.md']
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function FileUpload({ isOpen, onClose }) {
    const [uploadedFiles, setUploadedFiles] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState('')
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        const yarray = getUploadedFiles()

        const updateFiles = () => {
            setUploadedFiles([...yarray.toArray()])
        }

        updateFiles()
        yarray.observe(updateFiles)

        return () => yarray.unobserve(updateFiles)
    }, [])

    const validateFile = (file) => {
        if (file.size > MAX_FILE_SIZE) {
            return `File too large: ${file.name} (max 5MB)`
        }
        const ext = '.' + file.name.split('.').pop().toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return `Invalid file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        }
        return null
    }

    const uploadFile = async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('roomId', getRoomId())

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'Upload failed')
        }

        return response.json()
    }

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.onerror = (e) => reject(e)
            reader.readAsText(file)
        })
    }

    const handleFiles = useCallback(async (files) => {
        setError('')
        setIsUploading(true)

        try {
            for (const file of files) {
                const validationError = validateFile(file)
                if (validationError) {
                    setError(validationError)
                    continue
                }

                await uploadFile(file)

                const ext = '.' + file.name.split('.').pop().toLowerCase()
                if (EDITABLE_EXTENSIONS.includes(ext)) {
                    try {
                        const content = await readFileContent(file)
                        setFileContent(file.name, content)
                    } catch (readErr) {
                        console.warn('Failed to read file content for editor', readErr)
                    }
                }

                addUploadedFile({
                    name: file.name,
                    size: file.size,
                    uploadedAt: Date.now()
                })
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setIsUploading(false)
        }
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            handleFiles(files)
        }
    }, [handleFiles])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleInputChange = useCallback((e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
            handleFiles(files)
        }
    }, [handleFiles])

    const handleDelete = async (fileName) => {
        try {
            await fetch(`${API_URL}/files/${getRoomId()}/${encodeURIComponent(fileName)}`, {
                method: 'DELETE'
            })
            removeUploadedFile(fileName)
        } catch (err) {
            setError('Failed to delete file')
        }
    }

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    // MODAL: Don't render if not open
    if (!isOpen) return null

    return (
        <div className="file-upload-overlay" onClick={onClose}>
            <div className="file-upload-modal" onClick={e => e.stopPropagation()}>
                <header className="upload-modal-header">
                    <h2>Upload Data Files</h2>
                    <button className="upload-modal-close" onClick={onClose}>×</button>
                </header>

                <div className="upload-content">
                    <div className="upload-hint">Files are accessible in code via /data/filename</div>

                    <div
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <input
                            type="file"
                            onChange={handleInputChange}
                            multiple
                            accept={ALLOWED_EXTENSIONS.join(',')}
                            id="file-input-modal"
                            hidden
                        />
                        <label htmlFor="file-input-modal" className="drop-label">
                            {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
                        </label>
                    </div>

                    {error && <div className="upload-error">{error}</div>}

                    {uploadedFiles.length > 0 ? (
                        <div className="uploaded-list">
                            {uploadedFiles.map((file, i) => (
                                <div key={i} className="uploaded-file">
                                    <div className="file-info">
                                        <span className="file-name">{file.name}</span>
                                        <span className="file-size">{formatSize(file.size)}</span>
                                    </div>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDelete(file.name)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-files">No files uploaded yet</div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default FileUpload
