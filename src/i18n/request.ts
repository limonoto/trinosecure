import { getRequestConfig } from "next-intl/server";

/**
 * Single-locale configuration. The app is Turkish-only, so there is no locale
 * routing — every request resolves to `tr`. UI strings live in messages/tr.json;
 * never hardcode user-facing text (see CLAUDE.md / docs/09-conventions.md).
 */
export const locale = "tr" as const;

export default getRequestConfig(async () => ({
  locale,
  messages: (await import(`../../messages/${locale}.json`)).default,
}));
