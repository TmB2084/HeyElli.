import {createHash} from 'node:crypto';
// A full SHA-256 digest in base64url takes 43 characters; with dl_ this is 46.
// Hex plus the prefix used 67 characters and Microsoft rejected that user ID.
export function directLineUserId(owner:string){return 'dl_'+createHash('sha256').update(owner).digest('base64url');}
