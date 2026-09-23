"""Staff login: server-side password check so the frontend never decides roles."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import verify_staff_password

router = APIRouter()


class LoginIn(BaseModel):
    password: str


@router.post("/login")
def staff_login(body: LoginIn):
    if verify_staff_password(body.password):
        return {"role": "admin"}
    raise HTTPException(status_code=401, detail="invalid staff credentials")
