# OpenAPI and Swagger Guidance

## Purpose

OpenAPI is the machine-readable API contract. Swagger UI is the browser UI that displays that contract and lets developers try requests.

For this project:

- `docs/mvp-api-contract.md` explains the design reasoning and tradeoffs.
- `docs/openapi.yaml` defines the executable API contract.
- Swagger UI will later serve `docs/openapi.yaml` from the Express app at `/api-docs`.

## MVP Decision

Use a contract-first OpenAPI workflow:

- OpenAPI version: 3.1.1.
- Spec source: `docs/openapi.yaml`.
- Interactive docs: `swagger-ui-express`.
- Serving route: `GET /api-docs`.
- API server base path: `/api/v1`.
- Route-comment generation with `swagger-jsdoc`: deferred.

This keeps the API design reviewable before controllers, services, validators, and Prisma repositories exist.

## Implementation Shape Later

When the Express app exists, the Swagger setup can look like this:

```js
const { readFileSync } = require('node:fs');
const path = require('node:path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const openapiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
const openapiDocument = YAML.parse(readFileSync(openapiPath, 'utf8'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
```

The exact file location can change once the backend folder structure is created, but the source of truth should remain one OpenAPI file unless the spec becomes too large.

## Security Rules

- Do not put real patient information in examples.
- Do not put real access tokens, refresh tokens, storage keys, report URLs, phone numbers, or emails in examples.
- Public endpoints must explicitly set `security: []`.
- Protected endpoints must use `bearerAuth`.
- In production, Swagger UI should be disabled or protected behind admin/staff access. For local development, `/api-docs` can be open.

## Modeling Rules

- Use reusable `components.schemas` for common response shapes.
- Use `components.parameters` for repeated pagination and UUID path parameters.
- Use `components.responses` for common errors such as `Unauthorized`, `Forbidden`, `NotFound`, and `ValidationError`.
- Use `operationId` values that map naturally to service methods.
- Use examples that teach expected shape, not full real-world data.
- Keep enum values aligned with the database schema.
- Keep request schemas stricter than response schemas where appropriate. For example, clients send `unitPrice`, but the backend calculates `amount`, `totalAmount`, `paidAmount`, and `dueAmount`.

## Sync Workflow

When an endpoint changes:

1. Update the reasoning contract in `docs/mvp-api-contract.md`.
2. Update the machine-readable contract in `docs/openapi.yaml`.
3. Check auth declarations and examples.
4. Later, update validators/controllers/tests in the same implementation slice.

## Deferred Decisions

After we choose the validation library, we should revisit whether to generate OpenAPI schemas from validation schemas. Until then, the OpenAPI file stays hand-authored and contract-first.
