import { useState, useEffect } from 'react'
import { getFiles, getRoomId } from '../lib/collaboration'
import './FileExplorer.css'

const MAX_FILES = 10

function FileExplorer({ activeFile, onFileSelect, onFileCreate }) {
    const [files, setFiles] = useState(['main.py'])
    const [isCreating, setIsCreating] = useState(false)
    const [newFileName, setNewFileName] = useState('')

    useEffect(() => {
        const ymap = getFiles()

        const updateFiles = () => {
            const fileNames = Array.from(ymap.keys())
            if (fileNames.length === 0) {
                // Initialize with main.py if empty
                ymap.set('main.py', '')
                setFiles(['main.py'])
            } else {
                setFiles(fileNames.sort())
            }
        }

        updateFiles()
        ymap.observe(updateFiles)

        return () => ymap.unobserve(updateFiles)
    }, [])

    const handleCreateFile = () => {
        if (!newFileName.trim()) return

        let fileName = newFileName.trim()
        if (!fileName.endsWith('.py')) {
            fileName += '.py'
        }

        // Validate filename
        if (!/^[a-zA-Z0-9_-]+\.py$/.test(fileName)) {
            alert('Invalid filename. Use only letters, numbers, underscores, and hyphens.')
            return
        }

        const ymap = getFiles()
        if (ymap.has(fileName)) {
            alert('File already exists')
            return
        }

        if (files.length >= MAX_FILES) {
            alert(`Maximum ${MAX_FILES} files allowed`)
            return
        }

        ymap.set(fileName, '')
        onFileSelect(fileName)
        setNewFileName('')
        setIsCreating(false)
    }

    const handleDeleteFile = (fileName, e) => {
        e.stopPropagation()

        if (files.length === 1) {
            alert('Cannot delete the last file')
            return
        }

        if (!confirm(`Delete ${fileName}?`)) return

        const ymap = getFiles()
        ymap.delete(fileName)

        if (activeFile === fileName) {
            const remaining = files.filter(f => f !== fileName)
            onFileSelect(remaining[0] || 'main.py')
        }
    }

    return (
        <div className="file-explorer">
            <div className="file-tabs">
                {files.map(fileName => (
                    <div
                        key={fileName}
                        className={`file-tab ${activeFile === fileName ? 'active' : ''}`}
                        onClick={() => onFileSelect(fileName)}
                    >
                        <span className="file-name">{fileName}</span>
                        {files.length > 1 && (
                            <button
                                className="delete-btn"
                                onClick={(e) => handleDeleteFile(fileName, e)}
                                title="Delete file"
                            >
                                x
                            </button>
                        )}
                    </div>
                ))}

                {files.length < MAX_FILES && !isCreating && (
                    <button
                        className="new-file-btn"
                        onClick={() => setIsCreating(true)}
                        title="New file"
                    >
                        +
                    </button>
                )}

                {isCreating && (
                    <div className="new-file-input">
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFile()
                                if (e.key === 'Escape') setIsCreating(false)
                            }}
                            placeholder="filename.py"
                            autoFocus
                        />
                        <button onClick={handleCreateFile}>Create</button>
                        <button onClick={() => setIsCreating(false)}>Cancel</button>
                    </div>
                )}
            </div>

            <div className="file-info">
                <span className="file-count">{files.length}/{MAX_FILES} files</span>
            </div>
        </div>
    )
}

export default FileExplorer
