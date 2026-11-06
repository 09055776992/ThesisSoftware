import spaces
import gradio as gr
from main import app as fastapi_app


# ---------------------------------------------------------------------------
# GPU-decorated inference function — required by HF Spaces GPU runtime.
# HF scans for at least one @spaces.GPU function wired to a Gradio component.
# This also serves as a real health-check / warmup endpoint in the UI.
# ---------------------------------------------------------------------------
@spaces.GPU
def check_status(text: str = "warmup") -> str:
    """Run a quick BERT inference to confirm GPU is active."""
    try:
        from bert_analyzer import bert_analyzer
        import torch
        device = "GPU ✅" if torch.cuda.is_available() else "CPU ✅"
        _ = bert_analyzer.analyze_document_text(text)
        return f"SCHOLAR AI is running on {device}"
    except Exception as e:
        return f"Error: {e}"


# ---------------------------------------------------------------------------
# Gradio UI (also acts as the HF Space landing page)
# ---------------------------------------------------------------------------
with gr.Blocks(title="SCHOLAR AI Service") as demo:
    gr.Markdown("# 🎓 SCHOLAR AI Microservice")
    gr.Markdown(
        "Serving ModernBERT document analysis + SHAP explainable ranking. "
        "Use the FastAPI endpoints directly — see `/docs` for the full API."
    )
    with gr.Row():
        inp = gr.Textbox(value="warmup", label="Test input", visible=False)
        out = gr.Textbox(label="Status")
    btn = gr.Button("Check Status")
    btn.click(fn=check_status, inputs=inp, outputs=out)


# ---------------------------------------------------------------------------
# Mount FastAPI alongside Gradio so all /api/* endpoints remain accessible
# ---------------------------------------------------------------------------
app = gr.mount_gradio_app(fastapi_app, demo, path="/ui")
