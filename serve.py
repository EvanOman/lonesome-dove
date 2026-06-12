#!/usr/bin/env python3
"""Static server with revalidation caching — bare http.server sends no Cache-Control,
so browsers heuristically cache stale CSS/JS after updates."""
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18761
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
