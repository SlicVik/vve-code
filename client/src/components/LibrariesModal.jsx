import { useState, useEffect } from 'react'
import { getInstalledPackages } from '../lib/collaboration'
import './LibrariesModal.css'

// Base libraries always available in the runtime
const BASE_LIBRARIES = [
    { name: 'Python', version: '3.12' },
    { name: 'pip', version: '24.x' },
]

function LibrariesModal({ isOpen, onClose }) {
    const [installedPackages, setInstalledPackages] = useState([])

    useEffect(() => {
        if (isOpen) {
            const yarray = getInstalledPackages()
            const updateInstalled = () => {
                setInstalledPackages([...yarray.toArray()])
            }
            updateInstalled()
            yarray.observe(updateInstalled)
            return () => yarray.unobserve(updateInstalled)
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="libraries-overlay" onClick={onClose}>
            <div className="libraries-modal" onClick={e => e.stopPropagation()}>
                <header className="libraries-header">
                    <h2>Installed Libraries</h2>
                    <button className="libraries-close" onClick={onClose}>×</button>
                </header>

                <div className="libraries-content">
                    <div className="libraries-section">
                        <h3>Base Environment</h3>
                        <div className="library-list">
                            {BASE_LIBRARIES.map((lib, i) => (
                                <div key={i} className="library-item">
                                    <span className="library-name">{lib.name}</span>
                                    <span className="library-version">{lib.version}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="libraries-section">
                        <h3>User Installed ({installedPackages.length})</h3>
                        {installedPackages.length > 0 ? (
                            <div className="library-list">
                                {installedPackages.map((pkg, i) => {
                                    // Handle both string format (legacy) and object format
                                    const name = typeof pkg === 'string' ? pkg : pkg.name
                                    const version = typeof pkg === 'string' ? 'installed' : (pkg.version || 'installed')
                                    return (
                                        <div key={i} className="library-item user-installed">
                                            <span className="library-name">{name}</span>
                                            <span className="library-version">{version}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="no-libraries">
                                No additional packages installed yet.
                                <br />
                                Use the Packages button to install more.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LibrariesModal
