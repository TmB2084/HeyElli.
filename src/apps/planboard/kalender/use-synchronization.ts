"use client";
import {useState,useSyncExternalStore} from "react";
import {CalendarSynchronization} from "./synchronization.ts";
export function useCalendarSynchronization(){
 const [sync]=useState(()=>new CalendarSynchronization());
 const snapshot=useSyncExternalStore(sync.subscribe,sync.getSnapshot,sync.getSnapshot);
 return {sync,...snapshot};
}
