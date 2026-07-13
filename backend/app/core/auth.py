"""Two-level password gate for a single-worker local app.

Not cryptographic-grade auth — this is a local desktop app on one PC with one
worker. The goal is simply to stop a worker from *accidentally or casually*
changing rates / deleting rows without the owner's say-so. Passwords are stored
as salted SHA-256 hashes in the `settings` table (never plaintext).

Two passwords:
  - login  : asked when the app opens (normal daily use)
  - edit   : asked for every structural change (rates, units, ingredients,
             office expenses, production, deletes, adds, and the defaults flow)

Defaults on first run: login "1234", edit "admin". The owner changes these in
Settings (changing either requires the current edit password).
"""

import hashlib
import os

from sqlalchemy.orm import Session

from app.core import settings as settings_core

_LOGIN_KEY = "auth.login_hash"
_EDIT_KEY = "auth.edit_hash"

DEFAULT_LOGIN = "1234"
DEFAULT_EDIT = "admin"


def _hash(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}${password}".encode()).hexdigest()


def _encode(password: str) -> str:
    salt = os.urandom(8).hex()
    return f"{salt}:{_hash(password, salt)}"


def _verify(password: str, stored: str) -> bool:
    if not stored or ":" not in stored:
        return False
    salt, digest = stored.split(":", 1)
    return _hash(password, salt) == digest


def ensure_seeded(db: Session) -> None:
    if not settings_core.get(db, _LOGIN_KEY):
        settings_core.set_value(db, _LOGIN_KEY, _encode(DEFAULT_LOGIN))
    if not settings_core.get(db, _EDIT_KEY):
        settings_core.set_value(db, _EDIT_KEY, _encode(DEFAULT_EDIT))


def verify_login(db: Session, password: str) -> bool:
    return _verify(password, settings_core.get(db, _LOGIN_KEY))


def verify_edit(db: Session, password: str) -> bool:
    return _verify(password, settings_core.get(db, _EDIT_KEY))


def set_login(db: Session, new_password: str) -> None:
    settings_core.set_value(db, _LOGIN_KEY, _encode(new_password))


def set_edit(db: Session, new_password: str) -> None:
    settings_core.set_value(db, _EDIT_KEY, _encode(new_password))
