"""
Authentication routes: register, login, me, refresh.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, InviteCode
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    CurrentUser,
    require_owner,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    user_id: str
    email: str
    role: str
    owner_id: str | None = None
    status: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    user_id: str
    email: str
    role: str
    owner_id: str | None = None
    status: str
    display_name: str | None = None

class RefreshRequest(BaseModel):
    refresh_token: str

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or payload.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id, user.email)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        owner_id=user.owner_id,
        status=user.status,
        access_token=access,
        refresh_token=refresh,
    )

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return tokens."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id, user.email)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        owner_id=user.owner_id,
        status=user.status,
        access_token=access,
        refresh_token=refresh,
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserResponse(
        user_id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        owner_id=current_user.owner_id,
        status=current_user.status,
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
    )
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise credentials_exception
        user_id = claims.get("sub")
        email = claims.get("email")
        if not user_id or not email:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id, user.email)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        owner_id=user.owner_id,
        status=user.status,
        access_token=access,
        refresh_token=refresh,
    )


# ---------------------------------------------------------------------------
# Invite-code registration
# ---------------------------------------------------------------------------

class RegisterInviteRequest(BaseModel):
    invite_code: str
    email: str
    password: str
    display_name: str | None = None


@router.post("/register-invite", response_model=TokenResponse, status_code=201)
def register_invite(payload: RegisterInviteRequest, db: Session = Depends(get_db)):
    """Register using an invite code. User becomes a member of the code's owner."""
    # Validate email uniqueness
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate invite code
    invite = db.query(InviteCode).filter(InviteCode.code == payload.invite_code).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )
    if invite.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code is disabled",
        )
    if invite.expire_at and invite.expire_at.replace(tzinfo=None) < __import__("datetime").datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code has expired",
        )
    if invite.used_count >= invite.max_use_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code has reached max uses",
        )

    # Create member user
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or payload.email.split("@")[0],
        role="member",
        owner_id=invite.owner_id,
        status="active",
    )
    db.add(user)

    # Increment invite usage
    invite.used_count += 1

    db.commit()
    db.refresh(user)

    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id, user.email)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        owner_id=user.owner_id,
        status=user.status,
        access_token=access,
        refresh_token=refresh,
    )
