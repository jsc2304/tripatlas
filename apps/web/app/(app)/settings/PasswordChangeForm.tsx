"use client";
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  changePassword,
  type PasswordChangeResult,
} from "../../../lib/actions/settings";
import { buttonClasses } from "../../../components/ui/Button";

const initialState: PasswordChangeResult = { ok: false };

const fieldClasses =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100";

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations("settings");

  useEffect(() => {
    if (state.ok && !pending) {
      formRef.current?.reset();
    }
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("passwordChange.currentPassword")}
        </span>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("passwordChange.newPassword")}
        </span>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("passwordChange.newPasswordRepeat")}
        </span>
        <input
          type="password"
          name="newPasswordRepeat"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClasses}
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {t("passwordChange.success")}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
          {pending ? t("passwordChange.submitting") : t("passwordChange.submit")}
        </button>
      </div>
    </form>
  );
}
