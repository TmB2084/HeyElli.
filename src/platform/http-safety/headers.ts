// Nonces require dynamic HTML: no cached/prerendered shell may reuse them.
export function sourcePolicy(development:boolean,nonce?:string,toolFrame=false){
 if(nonce&&!/^[A-Za-z0-9+/]{24,64}={0,2}$/.test(nonce))throw Error('Invalid CSP nonce');
 return `default-src 'none'; script-src 'self'${nonce?` 'nonce-${nonce}' 'strict-dynamic'`:''}${development?" 'unsafe-eval'":''}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${development?' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*':''}; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors ${toolFrame?"'self'":"'none'"}; report-uri /api/sicherheit/csp; report-to heyelli-csp`;
}
export function browserHeaders(development:boolean,nonce?:string,toolFrame=false){return [
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:toolFrame?'SAMEORIGIN':'DENY'},
 {key:'Referrer-Policy',value:'no-referrer'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
 {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
 {key:'Content-Security-Policy',value:sourcePolicy(development,nonce,toolFrame)},
 ];}
// Next's internal URL may use localhost while the browser uses 127.0.0.1.
// Use the actual validated Host, never an arbitrary forwarded header.
// Behind a TLS reverse proxy, HEYELLI_PUBLIC_ORIGIN (e.g. https://heyelli.example) declares the public
// scheme explicitly; it applies only when the validated Host matches it exactly.
export function browserOrigin(request:Request){
 const url=new URL(request.url),host=request.headers.get('host');
 // Clear the internal port first: assigning a Host without port would otherwise keep it (e.g. :3000).
 if(host){if(/[\s/@?#\\,]/.test(host))throw Error('Invalid browser host');url.port='';url.host=host;if(url.host.toLowerCase()!==host.toLowerCase())throw Error('Invalid browser host');}
 const configured=process.env.HEYELLI_PUBLIC_ORIGIN;
 if(configured){const pub=new URL(configured);if(pub.host.toLowerCase()===url.host.toLowerCase())return pub.origin;}
 return url.origin;
}
