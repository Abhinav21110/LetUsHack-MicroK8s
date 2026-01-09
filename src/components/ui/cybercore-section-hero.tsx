import React, { useState, useEffect, CSSProperties } from 'react'

export interface CybercoreBackgroundProps {
    /** Number of animated light beams */
    beamCount?: number
}

const DEFAULT_BEAM_COUNT = 70

const CybercoreBackground: React.FC<CybercoreBackgroundProps> = ({
    beamCount = DEFAULT_BEAM_COUNT,
}) => {
    const [beams, setBeams] = useState<
        Array<{ id: number; type: 'primary' | 'secondary'; style: CSSProperties }>
    >([])

    useEffect(() => {
        const generated = Array.from({ length: beamCount }).map((_, i) => {
            const riseDur = Math.random() * 4 + 6   // 6–10s rise
            const fadeDur = riseDur                // sync fade
            const type: 'primary' | 'secondary' = Math.random() < 0.2 ? 'secondary' : 'primary'
            return {
                id: i,
                type,
                style: {
                    left: `${Math.random() * 100}%`,
                    width: `${Math.floor(Math.random() * 4) + 3}px`, // 3-6px width
                    animationDelay: `${Math.random() * 8}s`,
                    animationDuration: `${riseDur}s, ${fadeDur}s`,
                },
            }
        })
        setBeams(generated)
        console.log('🔴 Cybercore: Generated', beamCount, 'beams')
    }, [beamCount])

    return (
        <div
            className="scene"
            role="img"
            aria-label="Animated cybercore grid background"
        >
            <div className="floor" />
            <div className="main-column" />
            <div className="light-stream-container">
                {/* TEST BEAM - Always visible */}
                <div
                    className="light-beam primary"
                    style={{
                        left: '50%',
                        width: '8px',
                        animationDelay: '0s',
                        animationDuration: '8s, 8s',
                    }}
                />
                {beams.map((beam) => (
                    <div
                        key={beam.id}
                        className={`light-beam ${beam.type}`}
                        style={beam.style}
                    />
                ))}
            </div>
        </div>
    )
}

export default CybercoreBackground
