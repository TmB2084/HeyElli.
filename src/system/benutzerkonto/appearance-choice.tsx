'use client';
import {useId} from 'react';
import type {Appearance} from '@/apps/planboard/kalender/domain';
import styles from './appearance-settings.module.css';
export function AppearanceChoice({value,onChange,disabled=false,label='Erscheinungsbild'}:{value:Appearance;onChange:(value:Appearance)=>void;disabled?:boolean;label?:string}){
 const name=useId();
 return <div className={styles.choices} role="radiogroup" aria-label={label}>
  {([['light','Hell'],['dark','Dunkel'],['system','Wie Gerät']] as const).map(([option,title])=><label key={option} className={styles.choice} data-selected={value===option}>
   <input type="radio" name={name} value={option} checked={value===option} disabled={disabled} onChange={()=>onChange(option)}/>
   <span className={styles.preview} data-appearance={option} aria-hidden="true"><span className={styles.previewBar}><i/><i/><i/></span><span className={styles.previewSide}/><span className={styles.previewContent}><i/><i/><i/></span></span>
   <span className={styles.label}>{title}<span aria-hidden="true">{value===option?'✓':''}</span></span>
  </label>)}
 </div>;
}
