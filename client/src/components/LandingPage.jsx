import { useState, useEffect, useRef } from 'react'
import './LandingPage.css'

function generateRoomId() {
    return crypto.randomUUID()
}

function LandingPage({ onJoinRoom }) {
    const [roomId, setRoomId] = useState('')
    const [error, setError] = useState('')
    const [isHovered, setIsHovered] = useState(false)
    const marqueeRef = useRef(null)

    const handleCreateRoom = () => {
        const newRoomId = generateRoomId()
        onJoinRoom(newRoomId)
    }

    const handleJoinRoom = (e) => {
        e.preventDefault()
        const trimmed = roomId.trim()

        if (!trimmed) {
            setError('ENTER_ID')
            return
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(trimmed)) {
            setError('INVALID_FORMAT')
            return
        }

        onJoinRoom(trimmed)
    }

    return (
        <div className="vve-landing">
            <div className="kinetic-bg">
                <div className="marquee-layer layer-top">
                    <div className="track track-left">
                        <span>COLLABORATE // BUILD TOGETHER // REAL-TIME SYNC // SHARE INSIGHTS // </span>
                        <span>COLLABORATE // BUILD TOGETHER // REAL-TIME SYNC // SHARE INSIGHTS // </span>
                    </div>
                </div>
                <div className="marquee-layer layer-middle">
                    <div className="track track-right">
                        <span>SECURE ENVIRONMENT // SANDBOXED RUNTIME // SAFE EXECUTION // PROTECTED // </span>
                        <span>SECURE ENVIRONMENT // SANDBOXED RUNTIME // SAFE EXECUTION // PROTECTED // </span>
                    </div>
                </div>
                <div className="marquee-layer layer-bottom">
                    <div className="track track-left">
                        <span>LEARN TO CODE // NO CONFIG NEEDED // FRIENDLY DEV // START CREATING // </span>
                        <span>LEARN TO CODE // NO CONFIG NEEDED // FRIENDLY DEV // START CREATING // </span>
                    </div>
                </div>
            </div>

            <div className="main-content">
                <header className="hero-header">
                    <div className="hero-left">
                        <h1 className="hero-title">
                            <span className="title-top">VVE</span>
                            <span className="title-bottom">CODE</span>
                        </h1>
                        <div className="hero-status">
                            <span className="status-dot"></span>
                            SYSTEM_ONLINE
                        </div>
                    </div>
                    <div className="hero-description">
                        <p className="desc-main">
                            A collaborative Python editor that abstracts away the complexity of environment setup.
                        </p>
                        <p className="desc-sub">
                            No installation required. Create a room and start building together.
                        </p>
                    </div>
                </header>

                <div className="interaction-zone">
                    <div className="action-block create-block">
                        <button
                            className="huge-btn"
                            onClick={handleCreateRoom}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            INITIALIZE
                            <span className="arrow">→</span>
                        </button>
                    </div>

                    <div className="action-block join-block">
                        <form onSubmit={handleJoinRoom} className="minimal-form">
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => {
                                    setRoomId(e.target.value)
                                    setError('')
                                }}
                                placeholder="ROOM_ID_UUID"
                                className="minimal-input"
                            />
                            <button type="submit" className="minimal-submit">
                                JOIN
                            </button>
                        </form>
                        {error && <div className="minimal-error">{error}</div>}
                    </div>
                </div>

                <footer className="minimal-footer">
                    <div className="specs">
                        <span>Utilizing Python 3.12 + 50 popular libraries</span>
                    </div>
                    <div className="version">V1.0.0</div>
                </footer>
            </div>
        </div>
    )
}

export default LandingPage
