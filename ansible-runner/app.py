"""
NİZAM Ansible Runner — headless Ansible executor + config importer for TrinoSecure.

Endpoints:
  POST /run         — Synchronous playbook execution (returns when complete)
  POST /run/stream  — Streaming playbook execution (SSE, real-time output)
  POST /import      — Fetch config files from a Trino coordinator via SFTP
  GET  /health      — Health check
"""

import asyncio
import io
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import PurePosixPath
from typing import Optional

import paramiko
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="NİZAM Ansible Runner", version="2.0.0")


# ── Request / response models ─────────────────────────────────────────────────

class RunRequest(BaseModel):
    # Raw [trino]\nhost1\n... — SSH vars are appended by this service.
    inventory: str
    playbook: str
    # Files to copy under files/ so the playbook's `src: files/<name>` resolves.
    files: dict[str, str] = {}
    ssh_user: str = "ansible"
    ssh_password: Optional[str] = None
    # PEM content — written to a temp file (0600) and passed as --private-key.
    ssh_private_key: Optional[str] = None


class RunResult(BaseModel):
    success: bool
    return_code: int
    stdout: str
    stderr: str


class ProbeRequest(BaseModel):
    host: str
    ssh_user: str = "ansible"
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    ssh_port: int = 22


class ProbeResult(BaseModel):
    ok: bool
    message: str


class ImportRequest(BaseModel):
    host: str                    # coordinator hostname or IP (no protocol/port)
    config_target: str           # full remote path, e.g. /etc/trino/rules.json
    ssh_user: str = "ansible"
    ssh_password: Optional[str] = None
    ssh_private_key: Optional[str] = None
    ssh_port: int = 22


class ImportResult(BaseModel):
    files: dict[str, str]   # logical name → file content
    errors: dict[str, str]  # logical name → error description


# ── Helpers ──────────────────────────────────────────────────────────────────

def _build_inventory(
    base: str,
    ssh_user: str,
    ssh_password: Optional[str],
    key_path: Optional[str],
) -> str:
    lines = [base.rstrip(), "", "[trino:vars]", f"ansible_user={ssh_user}"]
    if ssh_password:
        lines.append(f"ansible_ssh_pass={ssh_password}")
    if key_path:
        lines.append(f"ansible_ssh_private_key_file={key_path}")
    return "\n".join(lines) + "\n"


def _setup_workspace(req: RunRequest) -> tuple[str, str, str]:
    """Create a temporary workspace with all playbook artifacts. Returns (workdir, inv_path, pb_path)."""
    workdir = tempfile.mkdtemp(prefix="nizam-")

    files_dir = os.path.join(workdir, "files")
    os.makedirs(files_dir)
    for name, content in req.files.items():
        with open(os.path.join(files_dir, name), "w", encoding="utf-8") as fh:
            fh.write(content)

    key_path: Optional[str] = None
    if req.ssh_private_key:
        key_path = os.path.join(workdir, "ansible_key.pem")
        with open(key_path, "w", encoding="utf-8") as fh:
            fh.write(req.ssh_private_key)
        os.chmod(key_path, 0o600)

    inv_content = _build_inventory(req.inventory, req.ssh_user, req.ssh_password, key_path)
    inv_path = os.path.join(workdir, "inventory.ini")
    with open(inv_path, "w", encoding="utf-8") as fh:
        fh.write(inv_content)

    pb_path = os.path.join(workdir, "playbook.yml")
    with open(pb_path, "w", encoding="utf-8") as fh:
        fh.write(req.playbook)

    return workdir, inv_path, pb_path


def _make_pkey(pem_content: str) -> paramiko.PKey:
    """Auto-detect key type (RSA / Ed25519 / ECDSA / DSS) and load the PEM private key."""
    for cls in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey, paramiko.DSSKey):
        try:
            return cls.from_private_key(io.StringIO(pem_content))
        except Exception:
            continue
    raise ValueError("Desteklenmeyen özel anahtar türü (RSA, Ed25519, ECDSA, DSS bekleniyor)")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/run", response_model=RunResult)
async def run_playbook(req: RunRequest) -> RunResult:
    """Synchronous playbook execution — blocks until ansible-playbook exits."""
    workdir, inv_path, pb_path = _setup_workspace(req)
    try:
        env = os.environ.copy()
        env["ANSIBLE_HOST_KEY_CHECKING"] = "False"

        result = subprocess.run(
            ["ansible-playbook", "-i", inv_path, pb_path],
            capture_output=True,
            text=True,
            cwd=workdir,
            env=env,
            timeout=600,
        )

        return RunResult(
            success=result.returncode == 0,
            return_code=result.returncode,
            stdout=result.stdout,
            stderr=result.stderr,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


@app.post("/run/stream")
async def run_stream(req: RunRequest) -> StreamingResponse:
    """Stream ansible-playbook stdout as Server-Sent Events (text/event-stream).

    Each event carries one of:
      {"line": "..."}                        — one line of Ansible output
      {"done": true, "returnCode": N}        — process exited
      {"error": "...", "done": true, "returnCode": -1}  — internal error
    """

    async def event_gen():
        workdir, inv_path, pb_path = _setup_workspace(req)
        try:
            env = os.environ.copy()
            env["ANSIBLE_HOST_KEY_CHECKING"] = "False"
            env["ANSIBLE_FORCE_COLOR"] = "False"
            env["PYTHONUNBUFFERED"] = "1"

            proc = await asyncio.create_subprocess_exec(
                "ansible-playbook", "-i", inv_path, pb_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=workdir,
                env=env,
            )

            assert proc.stdout is not None
            async for raw_line in proc.stdout:
                line = raw_line.decode("utf-8", errors="replace")
                yield f"data: {json.dumps({'line': line})}\n\n"

            await proc.wait()
            yield f"data: {json.dumps({'done': True, 'returnCode': proc.returncode})}\n\n"

        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc), 'done': True, 'returnCode': -1})}\n\n"

        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/probe", response_model=ProbeResult)
async def probe_host(req: ProbeRequest) -> ProbeResult:
    """Test SSH connectivity to a single host using ansible ping (30 s timeout)."""
    inv = f"[trino]\n{req.host}:{req.ssh_port}\n"
    pb = (
        "---\n"
        "- name: SSH probe (NİZAM)\n"
        "  hosts: trino\n"
        "  gather_facts: false\n"
        "  tasks:\n"
        "    - ansible.builtin.ping:\n"
    )
    run_req = RunRequest(
        inventory=inv,
        playbook=pb,
        files={},
        ssh_user=req.ssh_user,
        ssh_password=req.ssh_password,
        ssh_private_key=req.ssh_private_key,
    )
    workdir, inv_path, pb_path = _setup_workspace(run_req)
    try:
        env = os.environ.copy()
        env["ANSIBLE_HOST_KEY_CHECKING"] = "False"
        result = subprocess.run(
            ["ansible-playbook", "-i", inv_path, pb_path],
            capture_output=True,
            text=True,
            cwd=workdir,
            env=env,
            timeout=30,
        )
        if result.returncode == 0:
            return ProbeResult(ok=True, message="SSH bağlantısı başarılı")
        combined = (result.stdout + "\n" + result.stderr).strip()
        return ProbeResult(ok=False, message=combined or "ansible-playbook başarısız oldu")
    except subprocess.TimeoutExpired:
        return ProbeResult(ok=False, message="SSH bağlantısı zaman aşımına uğradı (30s)")
    except Exception as e:
        return ProbeResult(ok=False, message=str(e))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


@app.post("/import", response_model=ImportResult)
async def import_config(req: ImportRequest) -> ImportResult:
    """Fetch Trino config files from the coordinator via SFTP and return their contents.

    Reads: rules.json, resource-groups.json, group-provider.txt, password.db,
    and any *.properties files found in the catalog/ subdirectory.
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs: dict = {
        "hostname": req.host,
        "port": req.ssh_port,
        "username": req.ssh_user,
        "timeout": 30,
        "look_for_keys": False,
        "allow_agent": False,
    }

    if req.ssh_private_key:
        try:
            connect_kwargs["pkey"] = _make_pkey(req.ssh_private_key)
        except Exception as e:
            err = str(e)
            return ImportResult(
                files={},
                errors={n: err for n in ("rules.json", "resource-groups.json", "group-provider.txt", "password.db")},
            )
    elif req.ssh_password:
        connect_kwargs["password"] = req.ssh_password

    files: dict[str, str] = {}
    errors: dict[str, str] = {}

    try:
        client.connect(**connect_kwargs)
        sftp = client.open_sftp()

        config_dir = str(PurePosixPath(req.config_target).parent)

        known_files = {
            "rules.json": req.config_target,
            "resource-groups.json": f"{config_dir}/resource-groups.json",
            "group-provider.txt": f"{config_dir}/group-provider.txt",
            "password.db": f"{config_dir}/password.db",
        }

        for name, remote_path in known_files.items():
            try:
                with sftp.open(remote_path, "r") as fh:
                    files[name] = fh.read().decode("utf-8", errors="replace")
            except IOError as e:
                errors[name] = str(e)

        # Catalog connector properties
        catalog_dir = f"{config_dir}/catalog"
        try:
            for fname in sftp.listdir(catalog_dir):
                if not fname.endswith(".properties"):
                    continue
                try:
                    with sftp.open(f"{catalog_dir}/{fname}", "r") as fh:
                        files[fname] = fh.read().decode("utf-8", errors="replace")
                except IOError as e:
                    errors[fname] = str(e)
        except IOError:
            pass  # catalog/ directory may not exist

        sftp.close()
    except Exception as e:
        err = str(e)
        for name in ("rules.json", "resource-groups.json", "group-provider.txt", "password.db"):
            if name not in files:
                errors[name] = err
    finally:
        client.close()

    return ImportResult(files=files, errors=errors)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
