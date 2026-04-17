# Market Selection Pass

Omen should narrow the book before any expensive reasoning pass. The first filter does not need model output; it only needs enough market structure to reject obvious dead ends.

## Keep candidates when

- Resolution terms are explicit and machine-readable.
- Order book depth can support the intended sizing without immediate self-slippage.
- The market still has time for new information to matter.
- External feeds exist that can challenge the naive consensus price.

## Drop candidates when

- The wording is vague enough that two operators would settle it differently.
- The best bid and ask are stale relative to the venue heartbeat.
- One side is too thin to unwind without becoming the market.
- The outcome is effectively locked and only offers headline risk.

## Hand-off

The scored candidate set should be small, explainable, and ready for the oracle and signal stages to enrich further.
