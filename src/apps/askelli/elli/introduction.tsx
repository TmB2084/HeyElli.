'use client';
import {useEffect, useState} from 'react';
import styles from './chat.module.css';

export function ElliIntroduction({text}: {text: string}) {
  const words = text.split(' ');
  const [shown, setShown] = useState(1);
  useEffect(() => {
    let count = 1;
    const timer = setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= words.length) clearInterval(timer);
    }, 35);
    return () => clearInterval(timer);
  }, [words.length]);
  return <div className={styles.introduction}>
    <strong>Elli</strong>
    <p>
      {/* One complete accessible message; visual word reveals stay silent. */}
      <span className={styles.introductionText}>{text}</span>
      <span className={styles.introductionReveal} aria-hidden="true">{words.slice(0, shown).join(' ')}{shown < words.length && <span className={styles.introductionCursor}>▍</span>}</span>
    </p>
  </div>;
}
