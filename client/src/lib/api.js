// Gateway API URL (configurable via env)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Max total payload size
const MAX_PAYLOAD_SIZE = 50 * 1024 // 50 KB for all files combined

/**
 * Submit code for execution
 * @param {Object} files - Map of filename to content
 * @param {string} entrypoint - File to run (e.g. 'main.py')
 * @param {string[]} packages - Installed packages to include
 * @param {string} roomId - Room ID for uploaded files access
 * @returns {Promise<{jobId: string}>}
 */
export async function executeCode(files, entrypoint = 'main.py', packages = [], roomId = 'default-room') {
    // Validate payload size
    const totalSize = Object.values(files).reduce((sum, content) => sum + new Blob([content]).size, 0)
    if (totalSize > MAX_PAYLOAD_SIZE) {
        throw new Error('Total code size exceeds maximum of 50 KB')
    }

    const response = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files, entrypoint, packages, roomId }),
    })

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment.')
        }
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to submit code')
    }

    return response.json()
}


/**
 * Poll for job status until complete
 * @param {string} jobId 
 * @param {number} maxAttempts 
 * @returns {Promise<{status: string, output?: string, error?: string}>}
 */
export async function pollStatus(jobId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(`${API_URL}/status/${jobId}`)

        if (!response.ok) {
            throw new Error('Failed to check job status')
        }

        const result = await response.json()

        if (result.status === 'completed' || result.status === 'error') {
            return result
        }

        // Wait 500ms before next poll
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    throw new Error('Execution timed out')
}

/**
 * Install packages (triggers pip install)
 * @param {string[]} packages - Package names to install
 */
export async function installPackages(packages) {
    const response = await fetch(`${API_URL}/install`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packages }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to install packages')
    }

    return response.json()
}

/**
 * Get allowlist of safe packages
 */
export async function getAllowlist() {
    const response = await fetch(`${API_URL}/allowlist`)
    if (!response.ok) {
        throw new Error('Failed to fetch allowlist')
    }
    return response.json()
}

/**
 * Get latest version of a package from PyPI
 * @param {string} packageName 
 * @returns {Promise<string>} version string
 */
export async function getPackageVersion(packageName) {
    try {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`)
        if (response.ok) {
            const data = await response.json()
            return data.info?.version || 'installed'
        }
    } catch (e) {
        console.warn(`Failed to get version for ${packageName}:`, e)
    }
    return 'installed'
}
