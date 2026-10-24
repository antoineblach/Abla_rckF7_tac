// Release of a pass or a kick (SPEC 5.4, 6.5, D-110): at a fixed instant (delay) or on receipt
// (control time), and the real release instant computed by the engine.
import type { KickReport, PassReport } from '../../engine/actionReport'
import type { ReleaseMode } from '../../model/types'
import { NumberField, SelectField } from '../common/fields'
import { releaseRealText } from '../describe'

type ReleaseChoice = 'fixed' | ReleaseMode

export function ReleaseFields({
  release,
  delay,
  report,
  disabled,
  onRelease,
  onDelay,
}: {
  release: ReleaseMode | undefined
  delay: number
  report: PassReport | KickReport | null
  disabled: boolean
  onRelease: (release: ReleaseMode | null) => void
  onDelay: (delay: number) => void
}) {
  return (
    <>
      <SelectField<ReleaseChoice>
        label="Lâcher"
        value={release ?? 'fixed'}
        disabled={disabled}
        options={[
          { value: 'fixed', label: 'À un instant fixe' },
          { value: 'onReceipt', label: 'À la réception' },
        ]}
        onChange={(value) => {
          onRelease(value === 'fixed' ? null : value)
        }}
      />
      <NumberField
        label={release === 'onReceipt' ? 'Temps de contrôle' : 'Délai'}
        unit="s"
        min={0}
        max={60}
        value={delay}
        disabled={disabled}
        onCommit={onDelay}
      />
      {report ? (
        <p className="inspector__info" data-testid="release-real">
          {releaseRealText(report)}
        </p>
      ) : null}
    </>
  )
}
