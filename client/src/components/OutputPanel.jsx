import './OutputPanel.css'

function OutputPanel({ output, plots = [] }) {
    // Parse output - check if it contains base64 images
    const hasPlots = plots && plots.length > 0

    return (
        <div className="output-container">
            <div className="output-section">
                <div className="output-header">
                    <span>Output</span>
                </div>
                <pre className="output-content">
                    {output || '// Run your code to see output here'}
                </pre>
            </div>

            {hasPlots && (
                <div className="plots-section">
                    <div className="output-header">
                        <span>Plots</span>
                    </div>
                    <div className="plots-content">
                        {plots.map((plot, index) => (
                            <div key={index} className="plot-item">
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
    )
}

export default OutputPanel

