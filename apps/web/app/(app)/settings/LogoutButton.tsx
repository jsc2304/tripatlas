"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { logout } from "../../../lib/auth/actions";
import { buttonClasses } from "../../../components/ui/Button";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("settings");
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className={buttonClasses("secondary", "md")}
    >
      {pending ? t("loggingOut") : t("logout")}
    </button>
  );
}
