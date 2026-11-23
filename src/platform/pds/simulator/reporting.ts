// Public, browser-safe formatting contract shared by UI and simulator storage.
export const maxOrderRemarkLength=2000;
export const reportingChannels = [
  {value:"Telefon",label:"Telefonisch gemeldet und beauftragt",sentence:"telefonisch gemeldet und beauftragt"},
  {value:"E-Mail",label:"Per E-Mail gemeldet und beauftragt",sentence:"per E-Mail gemeldet und beauftragt"},
  {value:"an Techniker vor Ort",label:"Mündlich an Techniker vor Ort gemeldet und beauftragt",sentence:"mündlich an Techniker vor Ort gemeldet und beauftragt"},
] as const;
export function formatReportSummary(input:{channel:string;reporter:string;contact:string;reportedAt:string;problem:string;externalOrderNumber:string}):string {
  const [date,time]=input.reportedAt.split("T");
  const [year,month,day]=date.split("-");
  const phone=input.channel!=="E-Mail" && input.contact.trim() ? `, Tel: ${input.contact.trim()}` : "";
  const lines=[
    `Serviceauftrag ${reportingChannels.find(channel=>channel.value===input.channel)?.sentence ?? input.channel}`,
    `von ${input.reporter.trim()}${phone} am ${day}.${month}.${year}, ${time}`,
    "Störung/Auftragsbeschreibung:",
    input.problem.trim(),
  ];
  if(input.externalOrderNumber.trim())lines.push(`Ihre Auftragsnummer: ${input.externalOrderNumber.trim()}`);
  return lines.join("\n");
}
