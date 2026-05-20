type Props = {
  /** 1-based index of the current step */
  current: number
  /** total number of steps in the flow */
  total: number
}

/**
 * Compact "Step X of N" indicator with filled/empty dots.
 * Gives users a sense of how far through the multi-step flow they are,
 * which reduces drop-off at higher-friction steps (e.g. photo upload).
 */
export default function ProgressIndicator({ current, total }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 mb-6" aria-label={`Step ${current} of ${total}`}>
      <span className="text-sm font-medium text-sky-700">
        Step {current} of {total}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i < current ? 'bg-sky-600' : 'bg-sky-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
