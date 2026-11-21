# Deploying on Railway

This directory holds the Railway build/run configuration (`railway.json`) for this
service. Railway supplies the platform-level settings (region, replicas, domains); the
files here only cover the build and start commands and the environment the service
expects.

## Environment variables

| Variable    | Required | Purpose |
|-------------|----------|---------|
| `GH_TOKEN`  | No       | A GitHub token used when calling the GitHub API. The service polls GitHub, and the unauthenticated API is capped at 60 requests per hour. Without `GH_TOKEN`, the service still runs, but it makes unauthenticated requests and is more likely to be rate-limited, which can make polling fall behind or requests fail once the limit is hit. Set `GH_TOKEN` to raise that limit. |
| `LOOP_REPO` | Yes      | The `owner/repo` this service polls. |
| `PORT`      | No       | Supplied by Railway at deploy time. Do not set it manually. |

## Files

- `railway.json` — the build command (`go build`) and start command for the compiled
  binary.

## Secrets

Nothing in this directory holds a secret value. Set `GH_TOKEN` (and any other secret)
through Railway's own environment variable configuration for the service, not in these
files.
