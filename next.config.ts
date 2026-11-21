import {browserHeaders} from "./src/platform/http-safety/headers";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  // Hostnamen für den LAN-Testmodus, z. B. HEYELLI_DEV_ORIGINS=heyelli.elomech.de (kommagetrennt)
  allowedDevOrigins: (process.env.HEYELLI_DEV_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean),
  experimental: {proxyClientMaxBodySize:"512kb"},
  async headers(){return [{source:"/:path*",headers:browserHeaders(process.env.NODE_ENV!=="production")}];},
  async redirects(){
    return [
      // Frühere Adressen (Lesezeichen, Links in Mails) dauerhaft auf die App-Namen vom 21.11.2026; Parameter bleiben erhalten.
      {source:'/stoerungen',destination:'/casedesk',permanent:true},
      {source:'/ressourcenkalender',destination:'/planboard',permanent:true},
      {source:'/bereitschaft',destination:'/dutyboard',permanent:true},
      {source:'/service',destination:'/servicehub',permanent:true},
      {source:'/service/:path*',destination:'/servicehub/:path*',permanent:true},
      {source:'/stoerungsmeister',destination:'/casedesk',permanent:true},
      {source:'/stoerungsmeister/:path*',destination:'/casedesk/:path*',permanent:true},
      {source:'/ressourcenmeister',destination:'/planboard',permanent:true},
      {source:'/ressourcenmeister/:path*',destination:'/planboard/:path*',permanent:true},
      {source:'/bereitschaftsmeister',destination:'/dutyboard',permanent:true},
      {source:'/bereitschaftsmeister/:path*',destination:'/dutyboard/:path*',permanent:true},
      {source:'/aufgaben',destination:'/taskhub',permanent:true},
      {source:'/aufgaben/:path*',destination:'/taskhub/:path*',permanent:true},
      {source:'/werkzeuge/stoerungsmeister',destination:'/werkzeuge/casedesk',permanent:true},
    ];
  },
  logging: {incomingRequests: {ignore: [/^\/api\/auth\/microsoft\/callback(?:\?|$)/]}},

};

export default nextConfig;
