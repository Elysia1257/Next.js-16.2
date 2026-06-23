"""SQLAlchemy models for the Cubex platform."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text,
    UniqueConstraint, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


def _new_uuid() -> str:
    return uuid.uuid4().hex


# =============================================================================
# User
# =============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    # --- New: role-based access control ---
    role = Column(String(10), nullable=False, default="owner")
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(10), nullable=False, default="active")
    # --- Timestamps ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="owner", foreign_keys="Workflow.owner_id", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="owner", foreign_keys="Asset.owner_id", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="owner", foreign_keys="Task.owner_id", cascade="all, delete-orphan")


# =============================================================================
# Project
# =============================================================================

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    # --- New: creator tracking ---
    created_by = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="projects")
    owner = relationship("User", back_populates="projects", foreign_keys=[owner_id])
    workflows = relationship("Workflow", back_populates="project", cascade="all, delete-orphan")


# =============================================================================
# Workflow
# =============================================================================

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(String(32), ForeignKey("projects.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    nodes_json = Column(Text, nullable=True)
    edges_json = Column(Text, nullable=True)
    # --- New: creator tracking + status ---
    created_by = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(10), nullable=False, default="active")
    # --- Timestamps ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="workflows", foreign_keys=[owner_id])
    project = relationship("Project", back_populates="workflows")


# =============================================================================
# Asset
# =============================================================================

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    workflow_id = Column(String(32), ForeignKey("workflows.id"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    storage_url = Column(String(512), nullable=False)
    mime_type = Column(String(100), nullable=True)
    # --- New: creator tracking ---
    created_by = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="assets", foreign_keys=[owner_id])


# =============================================================================
# Task (rebuilt from legacy stub into full execution record)
# =============================================================================

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    created_by = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    workflow_id = Column(String(32), ForeignKey("workflows.id"), nullable=True, index=True)
    provider = Column(String(50), nullable=False)
    model = Column(String(100), nullable=True)
    task_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    input = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    cost = Column(Integer, nullable=False, default=0)
    provider_task_id = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="tasks", foreign_keys=[owner_id])
    workflow = relationship("Workflow", foreign_keys=[workflow_id])


# =============================================================================
# InviteCode
# =============================================================================

class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    code = Column(String(32), unique=True, nullable=False)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    expire_at = Column(DateTime(timezone=True), nullable=False)
    max_use_count = Column(Integer, nullable=False, default=1)
    used_count = Column(Integer, nullable=False, default=0)
    status = Column(String(10), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")

    __table_args__ = (
        CheckConstraint("used_count <= max_use_count", name="ck_used_le_max"),
    )


# =============================================================================
# CreditAccount (team total balance)
# =============================================================================

class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    owner_id = Column(String(32), ForeignKey("users.id"), primary_key=True)
    balance = Column(Integer, nullable=False, default=0)

    owner = relationship("User")


# =============================================================================
# CreditAllocation (per-member allocation)
# =============================================================================

class CreditAllocation(Base):
    __tablename__ = "credit_allocations"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    member_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    allocated = Column(Integer, nullable=False, default=0)
    used = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    member = relationship("User", foreign_keys=[member_id])

    __table_args__ = (
        UniqueConstraint("owner_id", "member_id", name="uq_owner_member"),
    )


# =============================================================================
# CreditLog (audit trail for all credit operations)
# =============================================================================

class CreditLog(Base):
    __tablename__ = "credit_logs"

    id = Column(String(32), primary_key=True, default=_new_uuid)
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    member_id = Column(String(32), ForeignKey("users.id"), nullable=True)
    action = Column(String(20), nullable=False)
    amount = Column(Integer, nullable=False)
    owner_balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    user = relationship("User", foreign_keys=[user_id])
    member = relationship("User", foreign_keys=[member_id])
