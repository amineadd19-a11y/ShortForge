# ShortForge + NVIDIA OpenShell

ShortForge keeps the Next.js application on Vercel and moves the privileged media workload into the existing Docker render worker. NVIDIA OpenShell can run that worker as a policy-enforced sandbox.

OpenShell is an infrastructure/runtime dependency, not a Next.js dependency. It provides filesystem/process isolation and deny-by-default network egress for the worker.

## Recommended topology

Vercel / ShortForge
        |
        | HTTPS + RENDER_WORKER_TOKEN
        v
Authenticated edge / reverse proxy
        |
        v
OpenShell service exposure
        |
        v
ShortForge render-worker sandbox
   |             |
   |             +--> S3/R2/MinIO (read/write)
   |
   +--> YouTube / Google video CDN (read-only)

The browser never receives worker credentials.

## Build

From the repository root:

    docker build -f worker/Dockerfile -t shortforge-render-worker:0.5.0 .

## Prepare the policy

Copy policy.yaml.example and replace __S3_HOST__ with the exact hostname of the object-storage endpoint.

Do not use a catch-all S3 wildcard. Exact hosts keep the egress boundary narrow.

## Create the sandbox

OpenShell requires an active gateway and compute driver:

    openshell sandbox create \
      --name shortforge-render \
      --from shortforge-render-worker:0.5.0 \
      --policy ./openshell/policy.yaml \
      --expose 8787 \
      --detach \
      -- node server.mjs

The worker listens on loopback inside the sandbox and is exposed through OpenShell service routing.

## Verify

    openshell policy get shortforge-render --full
    openshell policy list shortforge-render
    openshell logs shortforge-render --since 10m
    openshell service list shortforge-render

For high-assurance deployments, run the OpenShell policy prover against an operator boundary before approving policy changes.

## Connect Vercel

Set:

    RENDER_WORKER_URL=https://<authenticated-worker-domain>
    RENDER_WORKER_TOKEN=<long-random-secret>

Do not point Vercel directly at an unauthenticated OpenShell gateway service URL. Remote OpenShell service endpoints normally require gateway authentication. Put an authenticated edge/reverse proxy in front of the exposed worker service, or integrate the OpenShell SDK with your gateway identity layer.

## Security model

- OpenShell denies outbound traffic unless a policy allows it.
- yt-dlp is restricted to YouTube/Google video endpoints.
- node is restricted to the configured object-storage endpoint.
- ffmpeg has no network permission.
- /tmp is the writable workspace.
- The worker still authenticates every /jobs request with RENDER_WORKER_TOKEN.
- Source URLs remain validated as YouTube URLs by both the Next.js API and the worker.
- Child processes use argument arrays; no shell interpolation is introduced.

## Important limitation

YouTube delivery hosts are dynamic. The policy allows **.googlevideo.com for the media CDN because exact CDN hostnames vary per download. Keep this permission attached only to yt-dlp/python3 and monitor OpenShell logs. Tighten it if the downloader can later use a smaller stable endpoint set.


## Render job contract

The worker accepts an optional `Idempotency-Key` header (or `idempotencyKey` JSON field), 8–128 characters using `A-Z a-z 0-9 . _ : -`. Repeating the same key while the job is retained returns the existing `jobId` instead of starting a duplicate download/render.

Use a stable application-generated key for each logical render request, for example a database render-job ID. Do not derive the key from an untrusted source URL alone.

Cancellation:

    POST /jobs/<jobId>/cancel

The cancellation request is authenticated with `RENDER_WORKER_TOKEN` and terminates the active subprocess tree. Timeouts use the same abort path.

OpenShell remains the execution boundary: filesystem and network permissions are enforced by policy outside the worker process. This matches OpenShell's deny-by-default sandbox model and its service-exposure architecture.