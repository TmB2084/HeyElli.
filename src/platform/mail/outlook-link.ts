export function outlookLink(recipient:string,subject:string,body:string){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)||/[\r\n]/.test(recipient)||/[\r\n]/.test(subject))throw new Error('Empfänger und Betreff prüfen.');
 return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r\n|\r|\n/g,'\r\n'))}`;
}
