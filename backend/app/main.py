from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.routers import auth, employees, attendance, leaves, payroll, reports, reimbursements, notifications, salary_structures
from app.migrations import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    yield


app = FastAPI(
    title="HR Portal API",
    description="Indian HR Management System — FastAPI Backend",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(payroll.router)
app.include_router(reports.router)
app.include_router(reimbursements.router)
app.include_router(notifications.router)
app.include_router(salary_structures.router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "HR Portal API"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy"}
