'use client';
import {useCallback,useState,type SetStateAction} from 'react';
import type {NoticeTone} from './notice';
export function useNoticeState(){
 const [message,setText]=useState(''),[noticeTone,setTone]=useState<NoticeTone>('neutral');
 const setMessage=useCallback((value:SetStateAction<string>)=>{setText(value);if(typeof value!=='function')setTone('neutral');},[]);
 const showError=useCallback((value:string)=>{setText(value);setTone('error');},[]);
 const showSuccess=useCallback((value:string)=>{setText(value);setTone('success');},[]);
 return {message,noticeTone,setMessage,showError,showSuccess};
}
