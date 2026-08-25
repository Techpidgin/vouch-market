# Vercel asset and wallet diagnosis

The known Vercel marketplace URL returned the prior HANKA page content without the current live-board and recommended-price sections that are present in the latest local preview. This indicates that the inspected Vercel domain is serving an older deployment or another project configuration. A follow-up browser view request timed out, so direct HTTP checks will be used for the asset routes and deployment metadata.

After moving the Opera image inside the opaque terminal window layer, the local desktop preview visibly shows the artwork behind the terminal rows while preserving contrast. The 390px landing preview retains the artwork as a bottom-right underlay without hiding the terminal controls or hero call to action.

The final desktop and 390px previews confirm that Opera is now a full-page landing underlay rather than a terminal-only image. A dark directional overlay maintains readable headers, hero copy, market cards, and footer links across the full scrollable landing page.

The revised value proposition renders as a single concise line on desktop and wraps naturally into two short lines at 390px without pushing the primary action or transaction terminal below the initial viewport.

After the final GitHub/Vercel deployment, the live Vercel client bundle contains the public HANKA asset origin. Both Opera and Solana public storage routes return a 307 redirect, so the Vercel UI no longer depends on its unconfigured Manus storage proxy. The zero-wallet Connect flow opens the in-app-wallet chooser rather than emitting an immediate install-wallet error; injected-wallet discovery and mobile handoff links are covered by active tests.
