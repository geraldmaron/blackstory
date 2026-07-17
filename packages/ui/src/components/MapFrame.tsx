/**
 * Accessible map frame placeholder for geographic result context (pin + caption).
 */

import { cx } from '../utils/cx.js';

export type MapPin = {
  readonly id: string;
  readonly label: string;
  /** 0–100 percentage from left. */
  readonly x: number;
  /** 0–100 percentage from top. */
  readonly y: number;
};

export type MapFrameProps = {
  readonly title: string;
  readonly caption?: string;
  readonly pins?: readonly MapPin[];
  readonly className?: string;
};

export function MapFrame({ title, caption, pins = [], className }: MapFrameProps) {
  return (
    <figure className={cx('bb-map', className)}>
      <div
        className="bb-map__frame"
        role="img"
        aria-label={
          pins.length
            ? `${title}. ${pins.length} marked location${pins.length === 1 ? '' : 's'}: ${pins
                .map((pin) => pin.label)
                .join(', ')}.`
            : title
        }
      >
        {pins.map((pin) => (
          <span
            key={pin.id}
            className="bb-map__pin"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            title={pin.label}
          />
        ))}
      </div>
      {caption ? <figcaption className="bb-map__caption">{caption}</figcaption> : null}
    </figure>
  );
}
