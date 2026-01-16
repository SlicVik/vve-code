import { useState, useCallback, useEffect } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import Editor from './components/Editor'
import OutputPanel from './components/OutputPanel'
import SharedOutput from './components/SharedOutput'
import PackageManager from './components/PackageManager'
import FileUpload from './components/FileUpload'
import LibrariesModal from './components/LibrariesModal'
import LandingPage from './components/LandingPage'
import { executeCode, pollStatus, installPackages } from './lib/api'
import { getSharedOutput, addInstalledPackages, getInstalledPackages, getRoomId, setRoomId, resetYjsConnection, getCurrentUser } from './lib/collaboration'
import { useStorageStats } from './hooks/useStorageStats'
import './App.css'

function App() {
  const [roomId, setCurrentRoomId] = useState(null)
  const [output, setOutput] = useState('')
  const [plots, setPlots] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [codeRef, setCodeRef] = useState({ getValue: () => '', getAllFiles: () => ({}) })
  const [isPackageManagerOpen, setIsPackageManagerOpen] = useState(false)
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false)
  const [isLibrariesOpen, setIsLibrariesOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const storageStats = useStorageStats()

  // Check URL for room ID on mount
  useEffect(() => {
    const urlRoomId = getRoomId()
    if (urlRoomId && urlRoomId !== 'default-room') {
      setCurrentRoomId(urlRoomId)
    }
  }, [])

  const handleJoinRoom = (newRoomId) => {
    // Update URL
    window.history.pushState({}, '', `?room=${newRoomId}`)
    setRoomId(newRoomId)
    setCurrentRoomId(newRoomId)
    // Reset Yjs connection for new room
    resetYjsConnection()
  }

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRun = useCallback(async () => {
    const files = codeRef.getAllFiles ? codeRef.getAllFiles() : { 'main.py': codeRef.getValue() }
    const activeFile = codeRef.getActiveFile ? codeRef.getActiveFile() : 'main.py'

    if (Object.keys(files).length === 0) {
      setOutput('// No code to execute')
      return
    }

    setIsRunning(true)
    setOutput('// Submitting...')
    setPlots([])

    try {
      const installedPkgs = getInstalledPackages().toArray()
      const currentRoomId = getRoomId()

      const { jobId } = await executeCode(files, activeFile, installedPkgs, currentRoomId)
      setOutput(`// Job submitted: ${jobId}\n// Waiting for result...`)

      const result = await pollStatus(jobId)
      setOutput(result.output || result.error || '// No output')

      if (result.plots && result.plots.length > 0) {
        setPlots(result.plots)
      }
    } catch (err) {
      setOutput(`// Error: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }, [codeRef])

  const handleShare = useCallback(() => {
    if (!output || output.startsWith('//')) return

    const ytext = getSharedOutput()
    const user = getCurrentUser()
    const shareData = JSON.stringify({
      output: output,
      plots: plots,
      sharedBy: user ? user.name : 'Anonymous',
      sharedAt: Date.now()
    })

    ytext.delete(0, ytext.length)
    ytext.insert(0, shareData)
  }, [output, plots])

  const handleInstallPackages = useCallback(async (packages) => {
    await installPackages(packages)

    // Fetch versions from PyPI for each package
    const { getPackageVersion } = await import('./lib/api')
    const packagesWithVersions = await Promise.all(
      packages.map(async (name) => {
        const version = await getPackageVersion(name)
        return { name, version }
      })
    )

    addInstalledPackages(packagesWithVersions)
  }, [])

  const handleExport = useCallback(() => {
    const files = codeRef.getAllFiles ? codeRef.getAllFiles() : {}

    if (Object.keys(files).length === 0) {
      return
    }

    const zip = new JSZip()

    // Add each file to the zip
    Object.entries(files).forEach(([filename, content]) => {
      zip.file(filename, content)
    })

    // Generate and download
    zip.generateAsync({ type: 'blob' }).then(blob => {
      const timestamp = new Date().toISOString().slice(0, 10)
      saveAs(blob, `vve-code-${roomId.substring(0, 8)}-${timestamp}.zip`)
    })
  }, [codeRef, roomId])

  // Show landing page if no room selected
  if (!roomId) {
    return <LandingPage onJoinRoom={handleJoinRoom} />
  }

  return (
    <div className="app">
      <header className="header">
        <h1>VVE Code Runtime</h1>
        <div className="user-info">
          <span className="username" style={{ color: getCurrentUser()?.color || '#fff' }}>
            Username: {getCurrentUser()?.name || 'Anonymous'}
          </span>
          <span className="room-id-display" title={roomId}>
            {roomId.substring(0, 8)}...
          </span>
          <button className="copy-link-btn" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Room ID'}
          </button>
        </div>
        <div className="header-buttons">
          <button
            className="files-button"
            onClick={() => setIsFileUploadOpen(true)}
            title={`${storageStats.formattedSize} / ${storageStats.formattedLimit} used`}
          >
            Upload Data File ({storageStats.formattedSize})
            <div className="usage-bar">
              <div className="usage-progress" style={{ width: `${storageStats.percentage}%` }}></div>
            </div>
          </button>

          <button
            className="packages-button"
            onClick={() => setIsPackageManagerOpen(true)}
          >
            Packages
          </button>
          <button
            className="libraries-button"
            onClick={() => setIsLibrariesOpen(true)}
          >
            Libraries
          </button>
          <button
            className="export-button"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            className="share-button"
            onClick={handleShare}
            disabled={!output || output.startsWith('//')}
          >
            Share
          </button>
          <button
            className="run-button"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </header>
      <main className="main">
        <Editor onEditorReady={setCodeRef} />
        <OutputPanel output={output} plots={plots} />
        <SharedOutput />
      </main>

      <PackageManager
        isOpen={isPackageManagerOpen}
        onClose={() => setIsPackageManagerOpen(false)}
        onInstall={handleInstallPackages}
      />

      <FileUpload
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
      />

      <LibrariesModal
        isOpen={isLibrariesOpen}
        onClose={() => setIsLibrariesOpen(false)}
      />
    </div>
  )
}

export default App
