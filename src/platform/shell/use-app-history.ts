'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useGuardedNavigation} from './navigation-guard';
import {AppHistory} from './app-history';
export function useAppHistory(){
 const pathname=usePathname(),query=useSearchParams().toString(),navigate=useGuardedNavigation();
 const trail=useRef<AppHistory|null>(null),scope=useRef('');
 const [availability,setAvailability]=useState({canGoBack:false,canGoForward:false});
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
   if(window.location.pathname!==pathname)return;
   if(scope.current!==pathname||!trail.current){scope.current=pathname;trail.current=new AppHistory(pathname);}
   // NavigationGuardProvider maintains this alongside Next's own history state.
   const raw=window.history.state?.__heyElliHistoryIndex,index=Number.isSafeInteger(raw)?Number(raw):null;
   trail.current.visit(window.location.pathname+window.location.search+window.location.hash,index);
   setAvailability(trail.current.availability);
  });
  return()=>cancelAnimationFrame(frame);
 },[pathname,query]);
 function move(direction:-1|1){
  if(!trail.current?.target(direction))return;
  navigate(()=>{
   if(window.location.pathname!==scope.current)return;
   const href=trail.current?.begin(direction);if(!href)return;
   setAvailability({canGoBack:false,canGoForward:false});
   // Navigate directly within this app, never traverse the cross-app browser history.
   window.history.pushState(null,'',href);
  });
 }
 return {...availability,back:()=>move(-1),forward:()=>move(1)};
}
