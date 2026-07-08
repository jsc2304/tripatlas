/**
 * App-wide configuration derived from environment variables.
 *
 * The display timezone is a single app-level setting (single-user app). All
 * day-boundary math and clock formatting resolves against this zone; the DB
 * always stores timestamptz in UTC.
 */

/** IANA timezone used for all day-boundary math and clock display. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Zurich";

/** Name of the httpOnly session cookie. */
export const SESSION_COOKIE = "tripatlas_session";
