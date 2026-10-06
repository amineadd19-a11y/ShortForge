# ShortForge OpenShell validation

Before production:

1. Policy loads successfully.
2. Effective policy contains only the intended YouTube and storage endpoints.
3. yt-dlp can reach required YouTube hosts.
4. node can reach only the configured storage host.
5. ffmpeg cannot make outbound requests.
6. Arbitrary HTTP requests are denied.
7. Worker health is reachable through the selected service exposure/edge.
8. RENDER_WORKER_TOKEN is required for /jobs.
9. A failed or timed-out render does not leave active job slots stuck.

Useful commands:

    openshell policy get shortforge-render --full
    openshell policy list shortforge-render
    openshell logs shortforge-render --since 15m
    openshell service list shortforge-render

Apply policy changes with --wait, then verify the effective policy and actual traffic.
