import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

// Single-locale (tr) setup, no i18n routing — see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
