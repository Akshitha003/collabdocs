from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def now(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)

class Document(Base):
    __tablename__ = 'documents'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150), default='Untitled document')
    content: Mapped[str] = mapped_column(Text, default='{"type":"doc","content":[{"type":"paragraph"}]}')
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    owner: Mapped[User] = relationship()

class Share(Base):
    __tablename__ = 'shares'
    __table_args__ = (UniqueConstraint('document_id', 'user_id'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey('documents.id', ondelete='CASCADE'))
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    role: Mapped[str] = mapped_column(String(12), default='editor')
    user: Mapped[User] = relationship()
