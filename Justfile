# Lonesome Dove trail map

# Serve locally for development (same port the service uses — stop the service first if needed)
dev:
    python3 -m http.server 18761 --bind 127.0.0.1

# Apply local changes to the running service (static site: files are served live, restart is belt-and-braces)
redeploy:
    systemctl --user restart lonesome-dove.service
    @sleep 1
    @curl -s -o /dev/null -w "http://127.0.0.1:18761 → %{http_code}\n" http://127.0.0.1:18761/

# Full check: dataset integrity + visual regression against goldens
test:
    python3 tests/validate-data.py
    tests/visual-check.sh

# Service health and recent logs
status:
    systemctl --user status lonesome-dove.service --no-pager
    @curl -s -o /dev/null -w "local: %{http_code}\n" http://127.0.0.1:18761/
