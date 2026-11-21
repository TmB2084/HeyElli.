export {RecordGlyph as FileActionIcon} from '@/platform/shell';

export function objectActionIcon(type?:string){return type==='TECHNISCHE_EINHEIT'?'unit' as const:'object' as const;}
