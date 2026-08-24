# Production Verification Note

The first custom-domain verification briefly served the earlier large-hero build even though the local preview showed the compact market board. After a fresh auto-published build, `https://vouchmark-cwykp9xs.manus.space/market?revision=1a427f7d` displayed the compact hero, dense listing rows, reduced market midpoint panel, and neutral public-market copy successfully. An independent, loaded 390px-wide capture of that published custom-domain page confirmed the readable compact mobile layout: a reduced hero, seven slim seller rows, the 0.52-USDC midpoint panel, and neutral public terms.

Ordered image verification, slices 1–2: the 390px published page shows the compact “Market board.” hero, concise primary actions, CommonsMade selector, and the beginning of a seller-offer column labelled `07`; the following slice shows slim 0.52-USDC seller rows with band, point count, and connection action.

Ordered image verification, slices 3–4: the remaining seller rows retain the compact information hierarchy, including the 100-point listing; the final slice shows the reduced `Market midpoint` panel at `0.52 USDC` and public terms with no human-review language.

Exact-quantity release verification: the first desktop request briefly served the prior compact board; a second request after propagation served the new dark leaderboard. The live markup confirmed the `Trade the signal.` heading, unified market ledger, `All` / `Vouches` / `Slashes` filters, exact-units column, and no repeated row-level wallet connection actions. The first new-board capture occurred before the client-side market query had rendered.

Live API follow-up: the empty board was an initial client-loading snapshot, not missing production data. The published `market.board` endpoint returned the CommonsMade project, seven existing vouch listings, `instrument: "vouch"`, their exact quantities, and a vouch midpoint of `0.5200`.

Mobile production verification, slices 1–2: the loaded 390px custom-domain page presents the `Trade the signal.` header, unified vouch/slash filter, one top-level wallet connection control, and compact market rows. Each visible row reports `ASK`, instrument `VOUCH`, `EXACT AVAILABLE`, and quote, with a neutral dash rather than a repeated connect or trade button while disconnected.

Mobile production verification, slices 3–4: all seven listing rows retain the same exact-quantity hierarchy, including the 100-unit listing. The final slice shows separate vouch and slash midpoint panels plus public guidance that distinguishes green bids from charcoal asks and states that each row uses an exact vouch or slash quantity.

Rendered mobile DOM proof: a headless `390×844` live custom-domain render contained `Trade the signal.`, the `All`, `Vouches`, and `Slashes` filter controls, all seven live `ASK-` records, and both `Vouch midpoint` and `Slash midpoint` panels after client loading. The corresponding image slices show the disconnected rows use a neutral dash rather than row-level connection actions.

OCR and DOM action proof: OCR of the four ordered 390px slices recognized the exact-quantity row labels, seven `ASK` rows, vouch/slash midpoint labels, and the explanatory market copy. The rendered DOM contained exactly one `Connect wallet` label, zero `Buy` labels, zero `Fill` labels, and 15 neutral-dash placeholders while disconnected; the one wallet connection control is in the header rather than a listing row.
