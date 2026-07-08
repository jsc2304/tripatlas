import { getTranslations } from "next-intl/server";

export async function Placeholder({ title }: { title: string }) {
  const t = await getTranslations("ui");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-neutral-500 dark:text-neutral-400">
        {t("comingSoon")}
      </p>
    </div>
  );
}
