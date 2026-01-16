import { useState, useEffect } from 'react'
import { getSharedOutput } from '../lib/collaboration'
import './SharedOutput.css'

function SharedOutput() {
    const [sharedContent, setSharedContent] = useState('')
    const [sharedPlots, setSharedPlots] = useState([])
    const [sharedBy, setSharedBy] = useState('')

    useEffect(() => {
        const ytext = getSharedOutput()

        const parseContent = () => {
            const text = ytext.toString()
            if (text) {
                try {
                    const data = JSON.parse(text)
                    setSharedContent(data.output || '')
                    setSharedPlots(data.plots || [])
                    setSharedBy(data.sharedBy || 'Unknown')
                } catch {
                    setSharedContent(text)
                    setSharedPlots([])
                    setSharedBy('')
                }
            } else {
                setSharedContent('')
                setSharedPlots([])
                setSharedBy('')
            }
        }

        parseContent()
        ytext.observe(parseContent)

        return () => {
            ytext.unobserve(parseContent)
        }
    }, [])

    const hasPlots = sharedPlots && sharedPlots.length > 0

    return (
        <div className="shared-output-container">
            <div className="shared-output-header">
                <span>Shared Output</span>
                {sharedBy && <span className="shared-by">by {sharedBy}</span>}
            </div>

            <div className="shared-output-body">
                <pre className="shared-output-content">
                    {sharedContent || '// No shared output yet\n// Click "Share" to share your output with the room'}
                </pre>

                {hasPlots && (
                    <div className="shared-plots">
                        <div className="shared-plots-header">Plots</div>
                        <div className="shared-plots-content">
                            {sharedPlots.map((plot, index) => (
                                <div key={index} className="shared-plot-item">
                                    <img
                                        src={`data:image/png;base64,${plot.data}`}
                                        alt={plot.name || `Plot ${index + 1}`}
                                    />
                                    {plot.name && <span className="plot-name">{plot.name}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SharedOutput
