import {Fragment} from 'react';
import type {IntegrationGuideData} from './integration-guide-data';
function Inline({text}:{text:string}){return <>{text.split(/(`[^`]+`|\*[^*]+\*)/g).map((part,index)=>part.startsWith('`')?<code key={index}>{part.slice(1,-1)}</code>:part.startsWith('*')?<em key={index}>{part.slice(1,-1)}</em>:part)}</>;}
export function IntegrationGuide({guide,downloadHref}:{guide:IntegrationGuideData;downloadHref:string}){
 return <article className="admin-mail-guide">
  <div className="admin-audit-toolbar"><h2>{guide.title}</h2><a className="admin-audit-download" href={downloadHref} download>Als Markdown herunterladen</a></div>
  <div className="admin-mail-guide-columns">{guide.setup.map(section=><section key={section.title}><h3>{section.title}</h3><ol>{section.steps.map(([label,detail])=><li key={label}><strong>{label}.</strong> <Inline text={detail}/></li>)}</ol></section>)}</div>
  <section><h3>Aktueller Stand</h3><dl className="admin-mail-guide-errors">{guide.gates.map(([label,detail])=><Fragment key={label}><dt>{label}</dt><dd><Inline text={detail}/></dd></Fragment>)}</dl></section>
  <section><h3>Prüfung und Freigabe</h3>{guide.release.map(text=><p key={text}><Inline text={text}/></p>)}</section>
  {guide.questions&&<section><h3>Offene Fragen an die PDS-Administration</h3><p>{guide.questions.intro}</p><div className="admin-table-scroll"><table className="admin-table admin-table-compact"><thead><tr><th>Thema</th><th>Was muss bestätigt werden?</th><th>Betroffener Ablauf</th></tr></thead><tbody>{guide.questions.items.map(([topic,question,scope])=><tr key={topic}><th scope="row">{topic}</th><td>{question}</td><td>{scope}</td></tr>)}</tbody></table></div></section>}
  <section><h3>Fehlerbehebung</h3><dl className="admin-mail-guide-errors">{guide.errors.map(([label,detail])=><Fragment key={label}><dt>{label}</dt><dd><Inline text={detail}/></dd></Fragment>)}</dl></section>
  <section><h3>Schutz der Zugangsdaten</h3><p>{guide.security}</p></section>
  {guide.extras?.map(extra=><section key={extra.title}><h3>{extra.title}</h3>{extra.paragraphs.map(text=><p key={text}><Inline text={text}/></p>)}{extra.code&&<pre>{extra.code}</pre>}</section>)}
  {!!guide.links?.length&&<section><h3>Weiterführende Anleitungen</h3><ul>{guide.links.map(([label,url])=><li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>)}</ul></section>}
 </article>;
}
