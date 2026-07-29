"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PlugZap, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { checkSupabaseConnection } from "@/lib/supabase/client";
import type { AppError } from "@/types/result";

type ConnectionState = "checking" | "connected" | "disconnected";

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [error, setError] = useState<AppError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // showSpinner: 手動の再確認だけ "checking" を表示する。
  // 初回・定期チェックは非同期の結果だけで状態を更新する。
  const check = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setState("checking");
    const result = await checkSupabaseConnection();
    if (!mountedRef.current) return;

    if (result.ok) {
      setState("connected");
      setError(null);
      return;
    }
    setState("disconnected");
    setError(result.error);
  }, []);

  useEffect(() => {
    // 接続確認は外部システムへの購読に相当する意図的な副作用。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check(false);
    // 60 秒ごとに再確認する。
    const timer = window.setInterval(() => void check(false), 60_000);
    return () => window.clearInterval(timer);
  }, [check]);

  const label =
    state === "checking"
      ? "Checking Supabase…"
      : state === "connected"
        ? "Supabase connected"
        : "Supabase unreachable";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void check(true)}
          className="rounded-4xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`${label}. Click to re-check.`}
        >
          <Badge
            variant={state === "connected" ? "outline" : state === "checking" ? "secondary" : "destructive"}
          >
            {state === "checking" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : state === "connected" ? (
              <PlugZap aria-hidden="true" />
            ) : (
              <Unplug aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{label}</span>
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {error ? `${error.message}${error.detail ? ` — ${error.detail}` : ""}` : label}
      </TooltipContent>
    </Tooltip>
  );
}
