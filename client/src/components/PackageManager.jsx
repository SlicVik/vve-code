import { useState, useEffect, useMemo } from 'react'
import { getInstalledPackages } from '../lib/collaboration'
import './PackageManager.css'

// Allowlist will be fetched from server
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function PackageManager({ isOpen, onClose, onInstall }) {
    const [allowlist, setAllowlist] = useState([])
    const [installedPackages, setInstalledPackages] = useState([])
    const [selectedPackages, setSelectedPackages] = useState(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [isInstalling, setIsInstalling] = useState(false)
    const [error, setError] = useState('')

    // Fetch allowlist on mount
    useEffect(() => {
        if (isOpen) {
            fetchAllowlist()
            syncInstalledPackages()
        }
    }, [isOpen])

    const fetchAllowlist = async () => {
        try {
            const response = await fetch(`${API_URL}/allowlist`)
            if (response.ok) {
                const data = await response.json()
                setAllowlist(data.packages || [])
            }
        } catch (err) {
            console.error('Failed to fetch allowlist:', err)
        }
    }

    const syncInstalledPackages = () => {
        const yarray = getInstalledPackages()
        const updateInstalled = () => {
            setInstalledPackages([...yarray.toArray()])
        }
        updateInstalled()
        yarray.observe(updateInstalled)
        return () => yarray.unobserve(updateInstalled)
    }

    // Filter packages based on search
    const filteredPackages = useMemo(() => {
        const query = searchQuery.toLowerCase()
        return allowlist.filter(pkg =>
            pkg.name.toLowerCase().includes(query) ||
            pkg.description.toLowerCase().includes(query)
        )
    }, [allowlist, searchQuery])

    const handleTogglePackage = (pkgName) => {
        const newSelected = new Set(selectedPackages)
        if (newSelected.has(pkgName)) {
            newSelected.delete(pkgName)
        } else {
            newSelected.add(pkgName)
        }
        setSelectedPackages(newSelected)
    }

    const handleInstall = async () => {
        if (selectedPackages.size === 0) return

        setIsInstalling(true)
        setError('')

        try {
            const packagesToInstall = [...selectedPackages]
            await onInstall(packagesToInstall)
            setSelectedPackages(new Set())
        } catch (err) {
            setError(err.message)
        } finally {
            setIsInstalling(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="package-manager-overlay" onClick={onClose}>
            <div className="package-manager-modal" onClick={e => e.stopPropagation()}>
                <header className="pm-header">
                    <h2>Package Manager</h2>
                    <button className="pm-close" onClick={onClose}>×</button>
                </header>

                <div className="pm-search">
                    <input
                        type="text"
                        placeholder="Search packages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {error && <div className="pm-error">{error}</div>}

                <div className="pm-list">
                    {filteredPackages.map(pkg => {
                        const isInstalled = installedPackages.includes(pkg.name)
                        const isSelected = selectedPackages.has(pkg.name)

                        return (
                            <div
                                key={pkg.name}
                                className={`pm-package ${isInstalled ? 'installed' : ''} ${isSelected ? 'selected' : ''}`}
                            >
                                <label className="pm-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={isSelected || isInstalled}
                                        disabled={isInstalled}
                                        onChange={() => handleTogglePackage(pkg.name)}
                                    />
                                    <span className="pm-name">{pkg.name}</span>
                                    {isInstalled && <span className="pm-badge">✓ Installed</span>}
                                </label>
                                <span className="pm-desc">{pkg.description}</span>
                            </div>
                        )
                    })}
                </div>

                <footer className="pm-footer">
                    <span className="pm-count">
                        {selectedPackages.size} selected • {installedPackages.length} installed
                    </span>
                    <button
                        className="pm-install-btn"
                        onClick={handleInstall}
                        disabled={selectedPackages.size === 0 || isInstalling}
                    >
                        {isInstalling ? '⏳ Installing...' : `📥 Install (${selectedPackages.size})`}
                    </button>
                </footer>
            </div>
        </div>
    )
}

export default PackageManager
