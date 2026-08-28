"""QA+ Company OS local server. Standard library only; no external publishing."""

from __future__ import annotations

import json
import mimetypes
import os
import tempfile
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


APP_DIR = Path(__file__).resolve().parent


def find_source_project() -> Path:
    """현재 프로젝트 또는 나란히 둔 ai-ceo-os를 자동으로 찾는다."""
    configured = os.getenv("QA_SOURCE_PROJECT", "").strip()
    candidates = [
        Path(configured).expanduser() if configured else None,
        APP_DIR.parent if (APP_DIR.parent / "knowledge").exists() else None,
        APP_DIR.parent / "ai-ceo-os",
        APP_DIR,
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate.resolve()
    return APP_DIR


PROJECT_DIR = find_source_project()
STATE_FILE = APP_DIR / "data" / "os_state.json"
HOST = "127.0.0.1"
PORT = int(os.getenv("QA_COMPANY_OS_PORT", "8877"))


def json_read(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def project_snapshot() -> dict:
    topics = json_read(PROJECT_DIR / "knowledge" / "qa_topics_queue.json", [])
    if isinstance(topics, dict):
        topic_count = len(topics.get("topics", topics.get("queue", [])))
    else:
        topic_count = len(topics)

    blog_count = len(list((PROJECT_DIR / "outputs").rglob("*블로그최종*.html")))
    video_count = len(list((PROJECT_DIR / "outputs" / "videos").rglob("*.mp4"))) if (PROJECT_DIR / "outputs" / "videos").exists() else 0
    script_count = len(list((PROJECT_DIR / "scripts").glob("*.py")))
    agent_count = len(list((PROJECT_DIR / ".codex" / "agents").glob("*.toml")))
    harness_count = len(list((PROJECT_DIR / "outputs" / "harness").glob("*.py")))
    state = json_read(STATE_FILE, {"tasks": [], "approvals": [], "activity": []})

    return {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "metrics": {
            "topics": topic_count,
            "blogs": blog_count,
            "videos": video_count,
            "scripts": script_count,
            "agents": agent_count,
            "harnesses": harness_count,
        },
        "state": state,
        "safeMode": True,
    }


def validate_state(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("상태 데이터는 객체여야 합니다.")
    tasks = payload.get("tasks", [])
    approvals = payload.get("approvals", [])
    activity = payload.get("activity", [])
    if not all(isinstance(value, list) for value in (tasks, approvals, activity)):
        raise ValueError("tasks, approvals, activity는 목록이어야 합니다.")
    if len(tasks) > 500 or len(activity) > 1000:
        raise ValueError("로컬 저장 한도를 초과했습니다.")
    for task in tasks:
        if not isinstance(task, dict) or not str(task.get("title", "")).strip():
            raise ValueError("모든 업무에는 제목이 필요합니다.")
    return {"tasks": tasks, "approvals": approvals, "activity": activity[-1000:]}


def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        temp_name = handle.name
    os.replace(temp_name, path)


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/status":
            self.send_json(project_snapshot())
            return
        relative = "index.html" if path == "/" else path.lstrip("/")
        target = (APP_DIR / relative).resolve()
        if APP_DIR not in target.parents and target != APP_DIR:
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/state":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 1_000_000:
                raise ValueError("요청 크기가 올바르지 않습니다.")
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            state = validate_state(payload)
            atomic_write_json(STATE_FILE, state)
            self.send_json({"ok": True, "savedAt": datetime.now().astimezone().isoformat(timespec="seconds")})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args) -> None:
        print(f"[Company OS] {self.address_string()} - {format % args}")


if __name__ == "__main__":
    print(f"QA+ Company OS: http://{HOST}:{PORT}")
    print("종료: Ctrl+C")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
