"use client";

import { useEffect, useRef } from "react";
import { turnstileSiteKey } from "@/lib/auth/turnstile";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: "light";
      language: string;
      size: "normal";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget(props: {
  onToken: (token: string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onToken = useRef(props.onToken);
  onToken.current = props.onToken;

  useEffect(() => {
    const sitekey = turnstileSiteKey();
    const node = host.current;
    if (!node || !sitekey) return;
    let widgetId: string | null = null;
    let cancelled = false;

    function render() {
      if (cancelled || !node || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(node, {
        sitekey,
        theme: "light",
        language: "fr",
        size: "normal",
        callback: (token) => onToken.current(token),
        "expired-callback": () => onToken.current(null),
        "error-callback": () => onToken.current(null),
      });
    }

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile]",
    );
    if (window.turnstile) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render);
    } else {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.turnstile = "1";
      script.onload = render;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!turnstileSiteKey()) {
    return (
      <p className="text-center text-xs text-rose-500">
        Clé Cloudflare Turnstile absente.
      </p>
    );
  }

  const testKey = !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  return (
    <div className="mt-4 flex w-full justify-center">
      <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[4px] border border-[#c8cdd3] bg-white">
        <div ref={host} data-turnstile-host className="min-h-[71px] w-full" />
        {testKey ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-px bottom-0 z-[2] h-7 bg-white"
          />
        ) : null}
      </div>
    </div>
  );
}
