import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** 環境変数が足りないときに表示する案内。Server Component として描画できる。 */
export function MissingEnvNotice({ missing }: { missing: string[] }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center px-6 py-16">
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Supabase environment variables are missing</AlertTitle>
        <AlertDescription>
          <p>
            The app cannot talk to Supabase until these variables are set in{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>:
          </p>
          <ul className="list-inside list-disc font-mono text-xs">
            {missing.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
          <ol className="list-inside list-decimal text-sm">
            <li>
              Copy <code className="font-mono text-xs">.env.local.example</code> to{" "}
              <code className="font-mono text-xs">.env.local</code>.
            </li>
            <li>
              Paste the Project URL and the <strong>anon public</strong> key from Supabase →
              Project Settings → API.
            </li>
            <li>Restart the dev server.</li>
          </ol>
          <p className="text-xs">
            Never put the service role key in a{" "}
            <code className="font-mono">NEXT_PUBLIC_</code> variable — it would be shipped to the
            browser.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
