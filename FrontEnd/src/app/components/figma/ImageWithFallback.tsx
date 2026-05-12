import React, { useState } from 'react'

// Default scholarship banner image (reliable external placeholder)
const DEFAULT_SCHOLARSHIP_IMAGE = 'https://placehold.co/600x200/2563EB/FFFFFF?text=Scholarship';

// Fallback for when the default also fails (inline SVG)
const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMjU2M0VCIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGQ9Ik0xMiAxNEwyMiAxMiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMiAxNEwyIDEyIj48L3BhdGg+PHBhdGggZD0iTTEyIDE0VjIyIj48L3BhdGg+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0Ij48L2NpcmNsZT48L3N2Zz4='

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export function ImageWithFallback(props: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(props.src || DEFAULT_SCHOLARSHIP_IMAGE)

  const handleError = () => {
    if (!didError) {
      // First error: try the default scholarship image
      if (currentSrc !== DEFAULT_SCHOLARSHIP_IMAGE && currentSrc !== props.fallbackSrc) {
        setCurrentSrc(props.fallbackSrc || DEFAULT_SCHOLARSHIP_IMAGE);
      } else {
        // Second error: show the error placeholder
        setDidError(true);
      }
    }
  }

  const { src, fallbackSrc, alt, style, className, ...rest } = props

  return didError ? (
    <div
      className={`inline-block bg-blue-50 text-center align-middle ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img src={ERROR_IMG_SRC} alt="Scholarship" {...rest} data-original-url={src} />
      </div>
    </div>
  ) : (
    <img 
      src={currentSrc} 
      alt={alt || 'Scholarship'} 
      className={className} 
      style={style} 
      {...rest} 
      onError={handleError} 
    />
  )
}
