import gradio as gr
from main import app as fastapi_app

with gr.Blocks(title="SCHOLAR AI Service") as demo:
    gr.Markdown("# 🎓 SCHOLAR AI Microservice")
    gr.Markdown("Serving ModernBERT document analysis + SHAP explainable ranking for the SCHOLAR System.")
    gr.Markdown("Status: **Online ✅**")

# Mount Gradio interface alongside FastAPI endpoints
app = gr.mount_gradio_app(fastapi_app, demo, path="/")
