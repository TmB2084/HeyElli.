import type {HTMLAttributes,ReactNode} from 'react';
export type NoticeTone='error'|'success'|'neutral';
type Props=HTMLAttributes<HTMLElement>&{tone?:NoticeTone;as?:'p'|'small'|'div';children:ReactNode};
export function Notice({tone='neutral',as:Tag='p',children,className='',role,...props}:Props){
 if(children===null||children===undefined||children===''||children===false)return null;
 return <Tag {...props} role={role??(tone==='error'?'alert':'status')} className={`app-notice app-notice-${tone}${Tag==='small'?' app-notice-compact':''} ${className}`}><span className="app-notice-icon" aria-hidden="true">{tone==='error'?'!':tone==='success'?'✓':'i'}</span>{children}</Tag>;
}
