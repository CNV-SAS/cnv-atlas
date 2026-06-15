import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// La subida de sourcemaps (org, project, SENTRY_AUTH_TOKEN) se configura en el
// bloque de deploy. Por ahora solo se silencia el plugin en el build.
export default withSentryConfig(nextConfig, {
  silent: true,
});
