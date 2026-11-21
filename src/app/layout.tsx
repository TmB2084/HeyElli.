import {BrowserViolationReporter} from "@/platform/http-safety/ui";
import {connection} from "next/server";
import {instanceNotice} from "@/platform/server-operation";
import {NavigationGuardProvider} from "@/platform/shell";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeyElli",
  description: "HeyElli – Ihr zentraler Einstieg für Service und Aufträge",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const notice=instanceNotice();
  return (
    <html lang="de">
      <body>{notice?<div className="instance-notice" role="status"><strong>{notice}</strong> · Das ist nicht die produktive Anwendung.</div>:null}<BrowserViolationReporter/><NavigationGuardProvider>{children}</NavigationGuardProvider></body>
    </html>
  );
}
