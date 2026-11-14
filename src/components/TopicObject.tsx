import { useState, type CSSProperties } from 'react';
import type { TopicObject as TopicObjectSpec } from '../data/topicObjects';

interface Props {
  object: TopicObjectSpec;
  image: string;
  /** True while this topic's card is showing. */
  open: boolean;
  /** Phones line the objects up as small icons instead of scattering them. */
  compact: boolean;
  onToggle: () => void;
}

/**
 * One cut-out object on the surface view. It is a button: click, tap or Enter
 * opens the topic's card. If the picture cannot be loaded it becomes a plain
 * labelled button, so the topic never disappears.
 */
export default function TopicObject({ object, image, open, compact, onToggle }: Props) {
  // Remember which picture failed, so a different one gets a fresh try.
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const position = compact ? undefined : object.position;

  if (failedImage === image) {
    return (
      <button type="button" className="btn object-fallback" style={position} aria-expanded={open} onClick={onToggle}>
        {object.name}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="object"
      style={compact ? undefined : ({ ...position, '--tilt': `${object.tilt}deg` } as CSSProperties)}
      aria-label={object.name}
      aria-expanded={open}
      onClick={onToggle}
    >
      <img src={image} alt="" draggable={false} onError={() => setFailedImage(image)} />
      <span className="object__label" style={compact ? undefined : object.labelPosition}>
        {object.label}
      </span>
    </button>
  );
}
