# OpenAPI Guidance

## Purpose

OpenAPI is the machine-readable API contract for this project.

For this project:

- `docs/mvp-api-contract.md` explains the design reasoning and tradeoffs.
- `docs/openapi.yaml` defines the executable API contract.
- No runtime API documentation UI is served by the Express app.

## MVP Decision

Use a contract-first OpenAPI workflow:

- OpenAPI version: 3.1.1.
- Spec source: `docs/openapi.yaml`.
- API server base path: `/api/v1`.
- Route-comment generation is deferred.

This keeps API design reviewable before controllers, services, validators, and raw SQL repositories exist.

## Security Rules

- Do not put real patient information in examples.
- Do not put real access tokens, refresh tokens, storage keys, report URLs, phone numbers, or emails in examples.
- Public endpoints must explicitly set `security: []`.
- Protected endpoints must use `bearerAuth`.

## Modeling Rules

- Use reusable `components.schemas` for common response shapes.
- Use `components.parameters` for repeated pagination and UUID path parameters.
- Use `components.responses` for common errors such as `Unauthorized`, `Forbidden`, `NotFound`, and `ValidationError`.
- Use `operationId` values that map naturally to service methods.
- Use examples that teach expected shape, not full real-world data.
- Keep enum values aligned with the database schema.
- Keep request schemas stricter than response schemas where appropriate.

## Sync Workflow

When an endpoint changes:

1. Update the reasoning contract in `docs/mvp-api-contract.md`.
2. Update the machine-readable contract in `docs/openapi.yaml`.
3. Check auth declarations and examples.
4. Later, update validators/controllers/tests in the same implementation slice.

## Validation Alignment

Phase 0 chose `express-validator` for request validation. The OpenAPI file stays hand-authored and contract-first for MVP because `express-validator` is route-chain oriented rather than schema-generation oriented.

When implementing an endpoint, keep three things aligned in the same edit session:

- the reasoning contract in `docs/mvp-api-contract.md`
- the executable contract in `docs/openapi.yaml`
- the route validators in the module's `*.validators.js` file
