import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { buildJourneyReport } from "@tripatlas/core";
import { validateSession } from "../../../../../lib/auth/session";
import { loadJourneyGpxTracks, loadJourneyReportData } from "../../../../../lib/exports/journey";
import { renderJourneyCsv, buildCsvLabels } from "../../../../../lib/exports/csv";
import { renderJourneyPdf, buildPdfLabels } from "../../../../../lib/exports/pdf";
import { renderJourneyGpx } from "../../../../../lib/exports/gpx";
import { journeyFilename } from "../../../../../lib/exports/filenames";
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
  const journeyId = Number(id);
  if (!Number.isInteger(journeyId) || journeyId <= 0) {
    return NextResponse.json({ error: t("errors.invalidJourneyId") }, { status: 400 });
  }

  const format = request.nextUrl.searchParams.get("format");
  if (!isValidFormatWithGpx(format)) {
    return NextResponse.json(
      { error: t("errors.invalidFormatWithGpx") },
      { status: 400 },
    );
  }

  if (format === "gpx") {
    const gpxData = await loadJourneyGpxTracks(journeyId);
    if (!gpxData) {
      return NextResponse.json({ error: t("errors.journeyNotFound") }, { status: 404 });
    }
    if (gpxData.tracks.length === 0) {
      return NextResponse.json(
        { error: t("errors.noTrackDataJourney") },
        { status: 404 },
      );
    }
    const gpx = renderJourneyGpx(gpxData.journeyName, gpxData.tracks);
    const filename = journeyFilename(journeyId, gpxData.journeyName, "gpx");
    return new NextResponse(gpx, {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const data = await loadJourneyReportData(journeyId);
  if (!data) {
    return NextResponse.json({ error: t("errors.journeyNotFound") }, { status: 404 });
  }

  const report = buildJourneyReport(data.journey, data.drives, data.charges, data.meta);
  const filename = journeyFilename(journeyId, data.journey.name, format);

  if (format === "csv") {
    const tCommon = await getTranslations("common");
    const csv = renderJourneyCsv(report, buildCsvLabels(t, tCommon));
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
  const pdf = await renderJourneyPdf(report, buildPdfLabels(t, tCommon, locale));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
