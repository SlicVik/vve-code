import { useEffect, useRef, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import FileExplorer from './FileExplorer'
import { getFiles, getYjsDoc, getRoomId } from '../lib/collaboration'
import './Editor.css'

const defaultCode = `# Welcome to VVE Code Runtime!
# This is a collaborative Python editor.

def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
`

function CodeEditor({ onEditorReady }) {
    const editorRef = useRef(null)
    const activeFileRef = useRef('main.py')
    const [activeFile, setActiveFile] = useState('main.py')
    const isUpdatingRef = useRef(false)

    // Keep activeFileRef in sync
    useEffect(() => {
        activeFileRef.current = activeFile
    }, [activeFile])

    // Initialize files on mount
    useEffect(() => {
        const ymap = getFiles()

        // Initialize with main.py if empty
        if (ymap.size === 0) {
            ymap.set('main.py', defaultCode)
        }

        // Observe changes to sync across users
        const observer = (event) => {
            if (isUpdatingRef.current) return

            const currentFile = activeFileRef.current

            // Only update if the current file was actually modified
            if (event.keysChanged.has(currentFile)) {
                if (editorRef.current) {
                    const content = ymap.get(currentFile) || ''
                    const editorValue = editorRef.current.getValue()
                    if (editorValue !== content) {
                        isUpdatingRef.current = true
                        const position = editorRef.current.getPosition()
                        editorRef.current.setValue(content)
                        editorRef.current.setPosition(position)
                        isUpdatingRef.current = false
                    }
                }
            }
        }

        ymap.observe(observer)
        return () => ymap.unobserve(observer)
    }, []) // Only run once on mount

    // Save current file before switching
    const saveCurrentFile = useCallback(() => {
        if (editorRef.current) {
            const ymap = getFiles()
            const content = editorRef.current.getValue()
            const currentFile = activeFileRef.current
            isUpdatingRef.current = true
            ymap.set(currentFile, content)
            isUpdatingRef.current = false
        }
    }, [])

    // Handle file switching
    const handleFileSelect = useCallback((fileName) => {
        // Save current file first
        saveCurrentFile()

        // Load new file content
        const ymap = getFiles()
        let content = ymap.get(fileName)

        // If file doesn't exist yet, create it
        if (content === undefined) {
            content = ''
            ymap.set(fileName, content)
        }

        // Update state and editor
        setActiveFile(fileName)
        activeFileRef.current = fileName

        if (editorRef.current) {
            isUpdatingRef.current = true
            editorRef.current.setValue(content)
            isUpdatingRef.current = false
        }
    }, [saveCurrentFile])

    const handleEditorMount = (editor, monaco) => {
        editorRef.current = editor

        // Set initial content
        const ymap = getFiles()
        const content = ymap.get(activeFileRef.current) || defaultCode
        editor.setValue(content)

        // Also save it to ymap if it was default
        if (!ymap.has(activeFileRef.current)) {
            ymap.set(activeFileRef.current, content)
        }

        // Listen for changes and sync to Yjs
        editor.onDidChangeModelContent(() => {
            if (isUpdatingRef.current) return

            const newContent = editor.getValue()
            const currentFile = activeFileRef.current

            isUpdatingRef.current = true
            ymap.set(currentFile, newContent)
            isUpdatingRef.current = false
        })

        // Expose getAllFiles to parent for execution
        onEditorReady({
            getValue: () => editor.getValue(),
            getActiveFile: () => activeFileRef.current,
            getAllFiles: () => {
                // Save current editor content first
                const currentContent = editor.getValue()
                ymap.set(activeFileRef.current, currentContent)

                const files = {}
                ymap.forEach((content, name) => {
                    files[name] = content
                })
                return files
            }
        })
    }

    return (
        <div className="editor-wrapper">
            <FileExplorer
                activeFile={activeFile}
                onFileSelect={handleFileSelect}
            />
            <div className="editor-container">
                <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    options={{
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        minimap: { enabled: false },
                        padding: { top: 16 },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        automaticLayout: true,
                    }}
                    onMount={handleEditorMount}
                />
            </div>
        </div>
    )
}

export default CodeEditor
