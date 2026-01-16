#!/usr/bin/env python3
"""
VVE Code Runtime - Python Execution Worker
Multi-file support, plot extraction, uploaded file access
"""

import json
import os
import time
import tempfile
import base64
import shutil
from pathlib import Path

import docker
import redis

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MAX_CONCURRENT = 2
EXECUTION_TIMEOUT = 30  # Increased for packages + matplotlib
MAX_OUTPUT_SIZE = 10 * 1024  # 10 KB
UPLOAD_DIR = Path(__file__).parent.parent / "gateway" / "uploads"

# Docker image
PYTHON_IMAGE = "python:3.12-slim"  # Use slim for better matplotlib support


def get_redis_client():
    return redis.from_url(REDIS_URL, decode_responses=True)


def get_docker_client():
    return docker.from_env()


def get_active_container_count(docker_client):
    containers = docker_client.containers.list(
        filters={"label": "colab-worker=true"}
    )
    return len(containers)


def truncate_output(output: str, max_size: int = MAX_OUTPUT_SIZE) -> str:
    if len(output.encode('utf-8')) > max_size:
        truncated = output.encode('utf-8')[:max_size].decode('utf-8', errors='ignore')
        return truncated + "\n\n... [Output truncated to 10KB]"
    return output


def filter_pip_output(output: str) -> str:
    """Remove pip warnings and notices from output."""
    lines = output.split('\n')
    filtered = []
    for line in lines:
        # Skip pip warnings and notices
        if line.startswith('WARNING:'):
            continue
        if line.startswith('[notice]'):
            continue
        if 'pip install --upgrade pip' in line:
            continue
        if 'Running pip as the' in line:
            continue
        if 'root-user-action' in line:
            continue
        if 'possibly rendering your system unusable' in line:
            continue
        if 'pypa.io/warnings/venv' in line:
            continue
        filtered.append(line)
    
    # Remove leading/trailing empty lines
    while filtered and not filtered[0].strip():
        filtered.pop(0)
    while filtered and not filtered[-1].strip():
        filtered.pop()
    
    return '\n'.join(filtered)



def extract_plots(output_dir: Path) -> list:
    """Extract generated plot files as base64."""
    plots = []
    if not output_dir.exists():
        return plots
    
    for file in output_dir.iterdir():
        if file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.svg']:
            try:
                with open(file, 'rb') as f:
                    data = base64.b64encode(f.read()).decode('utf-8')
                plots.append({
                    'name': file.name,
                    'data': data
                })
            except Exception as e:
                print(f"[Worker] Failed to read plot {file}: {e}")
    
    return plots


def create_wrapper_code(entrypoint: str) -> str:
    """Create wrapper that sets up matplotlib backend and runs user code."""
    return f'''
import sys
import os

# Add /code to path so files can import each other
sys.path.insert(0, '/code')
os.chdir('/code')

# Force matplotlib to use Agg backend (no GUI) if installed
try:
    import matplotlib
    matplotlib.use('Agg')
    
    # Patch savefig to save to /output by default
    import matplotlib.pyplot as plt
    _original_savefig = plt.savefig
    def _patched_savefig(fname, *args, **kwargs):
        if not os.path.isabs(fname):
            fname = os.path.join('/output', fname)
        return _original_savefig(fname, *args, **kwargs)
    plt.savefig = _patched_savefig
except ImportError:
    pass  # matplotlib not installed

# Set output directory for plots
os.makedirs('/output', exist_ok=True)

# Run user code with proper __name__ and __file__
import runpy
runpy.run_path('/code/{entrypoint}', run_name='__main__')
'''



def execute_code(job: dict, docker_client: docker.DockerClient) -> tuple:
    """Execute user code in Docker container."""
    job_id = job["jobId"]
    files = job.get("files", {})
    entrypoint = job.get("entrypoint", "main.py")
    packages = job.get("packages", [])
    room_id = job.get("roomId", "default-room")
    
    # Legacy support
    if not files and "sourceCode" in job:
        files = {"main.py": job["sourceCode"]}
    
    print(f"[Worker] Processing job: {job_id} ({len(files)} files)")
    
    # Create temp directories
    temp_dir = Path(tempfile.mkdtemp())
    code_dir = temp_dir / "code"
    output_dir = temp_dir / "output"
    code_dir.mkdir()
    output_dir.mkdir()
    
    container = None
    try:
        # Write all code files
        for filename, content in files.items():
            safe_name = filename.replace('..', '_').replace('/', '_')
            (code_dir / safe_name).write_text(content)
        
        # Write wrapper script
        wrapper_code = create_wrapper_code(entrypoint)
        (code_dir / "__wrapper__.py").write_text(wrapper_code)
        
        # Build command
        if packages:
            packages_str = " ".join(packages)
            command = f"pip install --no-cache-dir -q {packages_str} && python /code/__wrapper__.py"
        else:
            command = "python /code/__wrapper__.py"
        
        # Volume mounts
        volumes = {
            str(code_dir): {'bind': '/code', 'mode': 'ro'},
            str(output_dir): {'bind': '/output', 'mode': 'rw'},
        }
        
        # Mount uploaded files if they exist
        room_upload_dir = UPLOAD_DIR / room_id
        if room_upload_dir.exists():
            volumes[str(room_upload_dir)] = {'bind': '/data', 'mode': 'ro'}
        
        # Network: enabled if packages need installing, disabled otherwise
        # This is a security trade-off - pip needs network access
        needs_network = len(packages) > 0
        
        container = docker_client.containers.run(
            image=PYTHON_IMAGE,
            command=["sh", "-c", command],
            volumes=volumes,
            mem_limit="256m",
            nano_cpus=1000000000,
            network_disabled=not needs_network,
            labels={"colab-worker": "true"},
            detach=True
        )
        
        # Wait with timeout
        try:
            result = container.wait(timeout=EXECUTION_TIMEOUT)
            exit_code = result.get("StatusCode", 0)
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return False, "Execution timed out", [], -1
        
        # Get output
        logs = container.logs(stdout=True, stderr=True).decode('utf-8', errors='replace')
        logs = truncate_output(logs)
        logs = filter_pip_output(logs)
        
        # Extract plots
        plots = extract_plots(output_dir)
        
        return True, logs, plots, exit_code
        
    except Exception as e:
        return False, str(e), [], -1
    finally:
        if container:
            try:
                container.remove(force=True)
            except Exception:
                pass
        # Cleanup temp directory
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


def execute_job(job: dict, docker_client: docker.DockerClient, redis_client: redis.Redis):
    """Execute job and store results."""
    job_id = job["jobId"]
    
    success, output, plots, exit_code = execute_code(job, docker_client)
    
    if not success:
        redis_client.set(
            f"job:{job_id}",
            json.dumps({
                "status": "error",
                "error": output,
                "plots": [],
                "completedAt": int(time.time() * 1000)
            }),
            ex=600
        )
        print(f"[Worker] Job {job_id} failed")
        return
    
    status = "completed" if exit_code == 0 else "error"
    redis_client.set(
        f"job:{job_id}",
        json.dumps({
            "status": status,
            "output": output,
            "plots": plots,
            "exitCode": exit_code,
            "completedAt": int(time.time() * 1000)
        }),
        ex=600
    )
    
    print(f"[Worker] Job {job_id} completed (exit={exit_code}, plots={len(plots)})")


def main():
    print("""
    VVE Code Runtime Worker
    ----------------------
    Multi-file | Plots | Uploads
    """)
    
    redis_client = get_redis_client()
    docker_client = get_docker_client()
    
    print("[Worker] Ensuring Python image is available...")
    try:
        docker_client.images.pull(PYTHON_IMAGE)
        print(f"[Worker] Image {PYTHON_IMAGE} ready")
    except Exception as e:
        print(f"[Worker] Warning: Could not pull image: {e}")
    
    print("[Worker] Waiting for jobs...")
    
    while True:
        try:
            active_count = get_active_container_count(docker_client)
            if active_count >= MAX_CONCURRENT:
                time.sleep(0.5)
                continue
            
            result = redis_client.blpop("submission_queue", timeout=1)
            
            if result is None:
                continue
            
            _, job_json = result
            job = json.loads(job_json)
            
            execute_job(job, docker_client, redis_client)
            
        except redis.ConnectionError as e:
            print(f"[Worker] Redis connection error: {e}")
            time.sleep(2)
        except KeyboardInterrupt:
            print("\n[Worker] Shutting down...")
            break
        except Exception as e:
            print(f"[Worker] Unexpected error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    main()
