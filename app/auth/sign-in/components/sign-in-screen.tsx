"use client";

import { useEffect, useState } from "react";
import { SignInForm } from "./sign-in-form";
import { SignInPanel } from "./sign-in-panel";

export type SignInOrg = {
  name: string;
  branchCount: number;
};

export function SignInScreen(props: {
  orgs: SignInOrg[];
  appName: string;
  callbackUrl?: string;
}) {
  const orgs = props.orgs.length > 0 ? props.orgs : [{ name: "Coccinelle", branchCount: 0 }];
  const [index, setIndex] = useState(0);
  const current = orgs[index] ?? orgs[0]!;

  useEffect(() => {
    if (orgs.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % orgs.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [orgs.length]);

  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden bg-white lg:grid lg:grid-cols-2">
      <SignInPanel
        name={current.name}
        names={orgs.map((org) => org.name)}
        index={index}
        branchCount={current.branchCount}
      />
      <main className="flex flex-1 items-center justify-center bg-white px-4 py-6 text-[#10231a] sm:px-8 sm:py-10 lg:min-h-svh lg:justify-start lg:px-12">
        <SignInForm
          callbackUrl={props.callbackUrl}
          brandName={current.name}
          appName={props.appName}
        />
      </main>
    </div>
  );
}
