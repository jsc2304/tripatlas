import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { buildDriveReport } from "@tripatlas/core";
import { validateSession } from "../../../../../lib/auth/session";
import { loadDriveGpxTrack, loadDriveReportData } from "../../../../../lib/exports/data";
import { renderDriveCsv, buildCsvLabels } from "../../../../../lib/exports/csv";
import { renderDrivePdf, buildPdfLabels } from "../../../../../lib/exports/pdf";
import { renderDriveGpx } from "../../../../../lib/exports/gpx";
import { driveFilename } from "../../../../../lib/exports/filenames";
import { isValidFormatWithGpx } from "../../../../../lib/exports/params";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("exports");

  const user = await validateSession();
  if (!user) {
    return NextResponse.json({ error: t("errors.notAuthenticated") }, { status: 401 });
  }

  const { id } = await params;
  const driveId = Number(id);
  if (!Number.isInteger(driveId) || driveId <= 0) {
    return NextResponse.json({ error: t("errors.invalidDriveId") }, { status: 400 });
  }

  const format = request.nextUrl.searchParams.get("format");
  if (!isValidFormatWithGpx(format)) {
    return NextResponse.json(
      { error: t("errors.invalidFormatWithGpx") },
      { status: 400 },
    );
  }

  const data = await loadDriveReportData(driveId);
  if (!data) {
    return NextResponse.json({ error: t("errors.driveNotFound") }, { status: 404 });
  }

  const report = buildDriveReport(data.drive, data.meta);
  const filename = driveFilename(report.date, report.id, format);

  if (format === "gpx") {
    const track = await loadDriveGpxTrack(driveId);
    if (!track) {
      return NextResponse.json(
        { error: t("errors.noTrackDataDrive") },
        { status: 404 },
      );
    }
    const gpx = renderDriveGpx(track);
    return new NextResponse(gpx, {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "csv") {
    const tCommon = await getTranslations("common");
    const csv = renderDriveCsv(report, buildCsvLabels(t, tCommon));
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
  const pdf = await renderDrivePdf(report, buildPdfLabels(t, tCommon, locale));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
