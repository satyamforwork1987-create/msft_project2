'use client';

interface ConfidenceDialProps {
  value: number; // 0.0 to 1.0
  size?: number;
  showLabel?: boolean;
}

export function ConfidenceDial({ value, size = 64, showLabel = true }: ConfidenceDialProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = clamped * 100;

  // Color based on confidence
  const color =
    clamped >= 0.75
      ? '#2D6A3F' // success green
      : clamped >= 0.5
      ? '#9A6400' // amber warning
      : '#B91C1C'; // danger red

  const trackColor = 'rgba(43, 33, 24, 0.08)';

  // SVG gauge parameters
  const cx = size / 2;
  const cy = size / 2;
  const r = (size * 0.38);
  const strokeWidth = size * 0.08;

  // Arc: 210° spread (-120° to 30°), needle points within arc
  const startAngle = -210; // degrees, starting from left
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240°

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  // Needle angle
  const needleAngle = startAngle + clamped * totalAngle;
  const needleRad = ((needleAngle - 90) * Math.PI) / 180;
  const needleLength = r * 0.85;
  const needleTipX = cx + needleLength * Math.cos(needleRad);
  const needleTipY = cy + needleLength * Math.sin(needleRad);
  const needleBaseR = strokeWidth * 0.5;

  // Track and progress arcs
  const trackPath = arcPath(startAngle, endAngle);
  const progressEnd = startAngle + clamped * totalAngle;
  const progressPath = clamped > 0.01 ? arcPath(startAngle, progressEnd) : '';

  return (
    <div className="confidence-gauge" style={{ width: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size * 0.85}
        viewBox={`0 0 ${size} ${size * 0.85}`}
        className="gauge-svg"
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        {clamped > 0.01 && (
          <path
            d={progressPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease' }}
          />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTipX}
          y2={needleTipY}
          stroke={color}
          strokeWidth={strokeWidth * 0.35}
          strokeLinecap="round"
          style={{ transition: 'all 0.6s ease' }}
        />

        {/* Needle pivot */}
        <circle
          cx={cx}
          cy={cy}
          r={needleBaseR}
          fill={color}
          style={{ transition: 'fill 0.6s ease' }}
        />

        {/* Value label */}
        {showLabel && (
          <text
            x={cx}
            y={cy + r * 0.55}
            textAnchor="middle"
            fontSize={size * 0.18}
            fontFamily="'Inter', sans-serif"
            fontWeight="500"
            fill={color}
          >
            {value === 0 && clamped === 0 ? 'N/A' : `${Math.round(pct)}%`}
          </text>
        )}
      </svg>
    </div>
  );
}
