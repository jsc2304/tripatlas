"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  testTeslamateConnection,
  type TeslamateTestResult,
} from "../../../lib/actions/diagnostics";
import { buttonClasses } from "../../../components/ui/Button";

export function TeslamateTestButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TeslamateTestResult | null>(null);
  const t = useTranslations("settings");

  function trigger() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await testTeslamateConnection();
        setResult(res);
      } catch (err) {
        setResult({
          ok: false,
          message:
            err instanceof Error ? err.message : t("diagnostics.teslamateTest.unknownError"),
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        className={buttonClasses("secondary", "sm", "self-start")}
      >
        {pending ? t("diagnostics.teslamateTest.testing") : t("diagnostics.teslamateTest.trigger")}
      </button>
      {result && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-sm ${
            result.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 aria-hidden size={16} className="mt-0.5 shrink-0" />
          ) : (
            <XCircle aria-hidden size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{result.message}</span>
        </p>
      )}
    </div>
  );
}
