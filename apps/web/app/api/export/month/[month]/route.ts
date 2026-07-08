import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { buildMonthReport } from "@tripatlas/core";
import { validateSession } from "../../../../../lib/auth/session";
import { loadMonthReportData } from "../../../../../lib/exports/data";
import { renderMonthCsv, buildCsvLabels } from "../../../../../lib/exports/csv";
import { renderMonthPdf, buildPdfLabels } from "../../../../../lib/exports/pdf";
import { monthFilename } from "../../../../../lib/exports/filenames";
import {
  isValidFormat,
  isValidMonthParam,
  parseClassifications,
} from "../../../../../lib/exports/params";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const t = await getTranslations("exports");

  const user = await validateSession();
  if (!user) {
    return NextResponse.json({ error: t("errors.notAuthenticated") }, { status: 401 });
  }

  const { month } = await params;
  if (!isValidMonthParam(month)) {
    return NextResponse.json({ error: t("errors.invalidMonth") }, { status: 400 });
  }

  const format = request.nextUrl.searchParams.get("format");
  if (!isValidFormat(format)) {
    return NextResponse.json(
      { error: t("errors.invalidFormat") },
      { status: 400 },
    );
  }

  let classifications;
  try {
    classifications = parseClassifications(request.nextUrl.searchParams.get("classification"));
  } catch {
    return NextResponse.json({ error: t("errors.invalidClassification") }, { status: 400 });
  }

  const data = await loadMonthReportData(month, classifications ?? undefined);
  const report = buildMonthReport(data.drives, month, data.meta, classifications ?? undefined);
  const filename = monthFilename(month, format, classifications ?? undefined);

  if (format === "csv") {
    const tCommon = await getTranslations("common");
    const csv = renderMonthCsv(report, buildCsvLabels(t, tCommon));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const [tCommon, locale] = await Promise.all([
    getTranslations("common"),
    getLocale(),
  ]);
  const pdf = await renderMonthPdf(report, buildPdfLabels(t, tCommon, locale));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
