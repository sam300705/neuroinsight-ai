"""Private Unix-socket transport for the heavyweight v3.2 inference process."""

from __future__ import annotations

import argparse
import http.client
import json
import os
import signal
import socket
import socketserver
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from .constants import MAX_UPLOAD_BYTES
from .inference_execution import InferenceBusyError
from .v32_runtime import MODEL_VERSION, load_pipeline

MAX_RESPONSE_BYTES = 32 * 1024 * 1024
INFERENCE_TIMEOUT_SECONDS = 38


class WorkerUnavailable(RuntimeError):
    pass


class UnixConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: Path, timeout: float):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(str(self.socket_path))


class WorkerClient:
    def __init__(self, socket_path: Path):
        self.socket_path = socket_path

    def request(self, method: str, path: str, payload: bytes | None = None):
        connection = UnixConnection(self.socket_path, 1 if method == "GET" else INFERENCE_TIMEOUT_SECONDS)
        try:
            connection.request(method, path, body=payload)
            response = connection.getresponse()
            if method == "POST" and response.status == 503:
                raise InferenceBusyError("Inference capacity is busy")
            if response.status != 200 or int(response.getheader("Content-Length", "0")) > MAX_RESPONSE_BYTES:
                raise WorkerUnavailable("Inference worker returned an invalid response")
            body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES:
                raise WorkerUnavailable("Inference worker response exceeded its limit")
            return json.loads(body)
        except (OSError, http.client.HTTPException, ValueError) as exc:
            raise WorkerUnavailable("Inference worker could not be reached") from exc
        finally:
            connection.close()

    def ready(self):
        try:
            return self.request("GET", "/ready") == {"model_version": MODEL_VERSION}
        except WorkerUnavailable:
            return False

    def predict(self, payload: bytes):
        return self.request("POST", "/predict", payload)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def setup(self):
        self.request.settimeout(5)
        super().setup()

    def send_json(self, status, payload):
        body = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode()
        if len(body) > MAX_RESPONSE_BYTES:
            status, body = 500, b'{"error":"response too large"}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/ready":
            self.send_json(200, {"model_version": MODEL_VERSION})
        else:
            self.send_json(404, {"error": "unknown endpoint"})

    def do_POST(self):
        if self.path != "/predict":
            self.send_json(404, {"error": "unknown endpoint"})
            return
        if not self.server.prediction_lock.acquire(blocking=False):
            self.send_json(503, {"error": "inference capacity is busy"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_UPLOAD_BYTES:
                self.send_json(413, {"error": "invalid image size"})
                return
            image = self.rfile.read(size)
            if len(image) != size:
                self.send_json(400, {"error": "incomplete upload"})
                return
            prediction = self.server.pipeline.predict(image)
            self.send_json(200, prediction)
        except OSError:
            return
        except Exception:
            self.send_json(500, {"error": "prediction unavailable"})
        finally:
            self.server.prediction_lock.release()


class WorkerServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True

    def __init__(self, socket_path: str, pipeline):
        self.pipeline = pipeline
        self.prediction_lock = threading.Lock()
        super().__init__(socket_path, Handler)


def stop_worker(_signal, _frame):
    raise SystemExit(0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", type=Path, required=True)
    parser.add_argument("--socket", type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    signal.signal(signal.SIGTERM, stop_worker)
    pipeline = load_pipeline(args.models)
    with WorkerServer(str(args.socket), pipeline) as server:
        try:
            print(f"{MODEL_VERSION} ready", flush=True)
            server.serve_forever()
        finally:
            args.socket.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
