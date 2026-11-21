import "server-only";
import {database} from "./database.ts";
import {platformRepository} from "./repository.ts";
export {permitted,PlatformError} from "./model.ts";
export type {Role,PlatformUser,Permission} from "./model.ts";
export function platformStore() { return platformRepository(database()); }

export {database as platformDatabase} from "./database.ts";
export type {SystemSettings} from "./system-settings.ts";
export {readSystemDefaults} from "./system-settings.ts";

import {systemSettingsRepository} from "./system-settings.ts";
export function systemSettingsStore(){return systemSettingsRepository(database());}

import {toolPreferences} from './tool-preferences.ts';
export function toolPreferenceStore(){return toolPreferences(database());}

import {launcherPreferences} from './launcher-preferences.ts';
export function launcherPreferenceStore(){return launcherPreferences(database());}

import {assistantChats} from './assistant-chats.ts';
export function assistantChatStore(){return assistantChats(database());}

import {assistantFeedback} from './assistant-feedback.ts';
export function assistantFeedbackStore(){return assistantFeedback(database());}

import {appUsage} from './app-usage.ts';
export function appUsageStore(){return appUsage(database());}
