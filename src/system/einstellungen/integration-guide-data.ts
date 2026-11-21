export type IntegrationGuideData={
 title:string;intro:string;
 setup:{title:string;steps:string[][]}[];
 gates:string[][];release:string[];
 questions?:{intro:string;items:string[][]};
 errors:string[][];security:string;
 extras?:{title:string;paragraphs:string[];code?:string}[];
 links?:string[][];
};
// Both UI and download use static content only; configuration and credentials never enter exports.
export function guideMarkdown(guide:IntegrationGuideData){
 const content=[`# ${guide.title}`,guide.intro,'## Einrichtung',
 ...guide.setup.map(section=>`### ${section.title}\n\n${section.steps.map(([label,detail],index)=>`${index+1}. **${label}.** ${detail}`).join('\n\n')}`),
 '## Aktueller Stand',guide.gates.map(([label,detail])=>`- **${label}:** ${detail}`).join('\n'),
 '## Prüfung und Freigabe',...guide.release];
 if(guide.questions)content.push('## Offene Fragen an die PDS-Administration',guide.questions.intro,...guide.questions.items.map(([topic,question,scope],index)=>`### ${index+1}. ${topic}\n\n${question}\n\n**Betroffener Ablauf:** ${scope}`));
 content.push('## Fehlerbehebung',guide.errors.map(([label,detail])=>`- **${label}:** ${detail}`).join('\n'),'## Schutz der Zugangsdaten',guide.security);
 for(const extra of guide.extras??[])content.push(`## ${extra.title}`,...extra.paragraphs,...extra.code?[`\`\`\`env\n${extra.code}\n\`\`\``]:[]);
 if(guide.links?.length)content.push('## Weiterführende Anleitungen',guide.links.map(([label,url])=>`- [${label}](${url})`).join('\n'));
 return content.join('\n\n')+'\n';
}
