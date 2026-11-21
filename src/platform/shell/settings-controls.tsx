import type {ReactNode} from 'react';
import styles from './settings-controls.module.css';
export function SettingsGroup({title,description,children}:{title?:string;description?:ReactNode;children:ReactNode}){
 return <section className={styles.group} aria-label={title}>{title&&<h3>{title}</h3>}<div className={styles.surface}>{children}</div>{description&&<p className={styles.note}>{description}</p>}</section>;
}
export function SettingsRow({title,description,controlId,children,wide=false}:{title:string;description?:ReactNode;controlId?:string;children:ReactNode;wide?:boolean}){
 return <div className={`${styles.row} ${wide?styles.wide:''}`}><div className={styles.label}>{controlId?<label htmlFor={controlId}>{title}</label>:<span>{title}</span>}{description&&<small>{description}</small>}</div><div className={styles.control}>{children}</div></div>;
}
export function SettingsDestination({label,detail,initials,accessory,onClick}:{label:string;detail?:string;initials?:string;accessory?:ReactNode;onClick:()=>void}){
 return <button type="button" className={styles.destination} onClick={onClick}>{initials&&<span className={styles.avatar} aria-hidden="true">{initials}</span>}<span className={styles.identity}><strong>{label}</strong>{detail&&<small>{detail}</small>}</span>{accessory&&<span className={styles.accessory}>{accessory}</span>}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></button>;
}
export function SettingsIdentity({name,detail}:{name:string;detail?:string}){
 return <div className={styles.identityCard}><span className={styles.avatar} aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><div className={styles.identity}><h3>{name}</h3>{detail&&<small>{detail}</small>}</div></div>;
}
