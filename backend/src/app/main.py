import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from mangum import Mangum

from .routers import alerts, auth, cases, copilot, stats

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="CrimeSphere AI API", version="1.0.0")

# CORS is handled by API Gateway (see template.yaml), not here, to avoid duplicate headers.
for module in (auth, cases, alerts, stats, copilot):
    app.include_router(module.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.options("/api/v1/{path:path}")
def preflight(path: str):
    """CORS preflight. The template routes OPTIONS past the JWT authorizer (browsers send no
    token) and API Gateway adds the CORS headers, but the request still reaches this function,
    which must answer with a 2xx or the browser blocks the real call."""
    return Response(status_code=204)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


handler = Mangum(app, lifespan="off")
