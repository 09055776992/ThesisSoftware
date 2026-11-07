import spaces
import gradio as gr
import traceback
import sys

print("[STARTUP] Importing FastAPI app...")
try:
    from main import app as fastapi_app
    print("[STARTUP] FastAPI app imported successfully.")
except Exception as e:
    print(f"[STARTUP ERROR] Failed to import main: {e}")
    traceback.print_exc()
    sys.exit(1)


@spaces.GPU
def check_status(text: str = "warmup") -> str:
    from bert_analyzer import bert_analyzer
    import torch
    device = "GPU" if torch.cuda.is_available() else "CPU"
    bert_analyzer._ensure_loaded()
    return f"SCHOLAR AI running on {device}"


print("[STARTUP] Building Gradio interface...")
with gr.Blocks(title="SCHOLAR AI") as demo:
    gr.Markdown("# 🎓 SCHOLAR AI Backend")
    gr.Markdown("API endpoints available at `/health`, `/analyze-document`, `/rank-students`")
    inp = gr.Textbox(value="warmup", visible=False)
    out = gr.Textbox(label="Status")
    btn = gr.Button("Check Status")
    btn.click(fn=check_status, inputs=inp, outputs=out)

# Mount FastAPI routes into the Gradio app
# HF ZeroGPU requires `demo` to be the Gradio Blocks object
print("[STARTUP] Mounting FastAPI routes...")
gr.mount_gradio_app(fastapi_app, demo, path="/ui")

print("[STARTUP] Done. App ready.")
